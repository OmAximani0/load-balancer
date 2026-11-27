import asyncio
import logging
import time
from typing import Any, Dict, List, Optional
import httpx
from app.config import ServerConfig
from app.statistics import StatisticsCollector

logger = logging.getLogger(__name__)


class BackendServer:
    def __init__(self, server_id: str, url: str) -> None:
        self.id = server_id
        self.url = url.rstrip("/")
        self.is_healthy: bool = True
        self.is_simulated_down: bool = False

    @property
    def is_available(self) -> bool:
        return self.is_healthy and not self.is_simulated_down


class RoundRobinScheduler:
    def __init__(self) -> None:
        self._index: int = 0
        self._lock = asyncio.Lock()

    async def select_server(self, servers: List[BackendServer]) -> Optional[BackendServer]:
        available_servers = [s for s in servers if s.is_available]
        if not available_servers:
            return None

        async with self._lock:
            selected = available_servers[self._index % len(available_servers)]
            self._index = (self._index + 1) % 1_000_000_000
            return selected

    async def reset(self) -> None:
        async with self._lock:
            self._index = 0


class LoadBalancer:
    def __init__(
        self,
        server_configs: List[ServerConfig],
        stats_collector: Optional[StatisticsCollector] = None,
        client: Optional[httpx.AsyncClient] = None,
        timeout: float = 5.0,
    ) -> None:
        self.servers: Dict[str, BackendServer] = {
            cfg.id: BackendServer(server_id=cfg.id, url=cfg.url) for cfg in server_configs
        }
        self.scheduler = RoundRobinScheduler()
        self.stats = stats_collector or StatisticsCollector(list(self.servers.keys()))
        self.timeout = timeout
        self._client = client
        self._owns_client = client is None

    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self.timeout)
            self._owns_client = True
        return self._client

    async def close(self) -> None:
        if self._owns_client and self._client and not self._client.is_closed:
            await self._client.aclose()

    def get_healthy_servers(self) -> List[BackendServer]:
        return [s for s in self.servers.values() if s.is_available]

    def get_server_health_map(self) -> Dict[str, bool]:
        return {s.id: s.is_available for s in self.servers.values()}

    async def select_server(self) -> Optional[BackendServer]:
        return await self.scheduler.select_server(list(self.servers.values()))

    def set_simulated_health(self, server_id: str, healthy: bool) -> bool:
        if server_id not in self.servers:
            return False
        self.servers[server_id].is_simulated_down = not healthy
        return True

    async def reset_stats(self) -> None:
        await self.stats.reset()
        await self.scheduler.reset()

    async def forward_request(
        self,
        path: str = "/process",
        method: str = "GET",
        headers: Optional[Dict[str, str]] = None,
        content: Optional[bytes] = None,
    ) -> Dict[str, Any]:
        server = await self.select_server()
        if not server:
            await self.stats.record_request(server_id=None, success=False)
            return {
                "status_code": 503,
                "body": {"detail": "No healthy backend servers available"},
            }

        client = await self.get_client()
        target_url = f"{server.url}{path}"
        start_time = time.perf_counter()

        try:
            req_headers = {k: v for k, v in (headers or {}).items() if k.lower() != "host"}
            response = await client.request(
                method=method,
                url=target_url,
                headers=req_headers,
                content=content,
                timeout=self.timeout,
            )
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0

            if response.status_code >= 500:
                await self.stats.record_request(
                    server_id=server.id,
                    success=False,
                    response_time_ms=elapsed_ms,
                )
            else:
                await self.stats.record_request(
                    server_id=server.id,
                    success=True,
                    response_time_ms=elapsed_ms,
                )

            try:
                json_data = response.json()
            except Exception:
                json_data = {"message": response.text}

            return {
                "status_code": response.status_code,
                "body": json_data,
            }

        except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as exc:
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            server.is_healthy = False
            await self.stats.record_request(
                server_id=server.id,
                success=False,
                response_time_ms=elapsed_ms,
            )
            logger.error("Failed to forward request to %s: %s", server.url, exc)
            return {
                "status_code": 502,
                "body": {"detail": f"Backend server {server.id} error: {exc.__class__.__name__}"},
            }
