import asyncio
import logging
from typing import Dict, Optional
import httpx
from app.load_balancer import BackendServer, LoadBalancer

logger = logging.getLogger(__name__)


class HealthMonitor:
    def __init__(
        self,
        load_balancer: LoadBalancer,
        interval: float = 5.0,
        timeout: float = 3.0,
        client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self.load_balancer = load_balancer
        self.interval = interval
        self.timeout = timeout
        self._client = client
        self._owns_client = client is None
        self._task: Optional[asyncio.Task] = None
        self._is_running: bool = False

    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self.timeout)
            self._owns_client = True
        return self._client

    async def check_server_health(self, server: BackendServer) -> bool:
        client = await self.get_client()
        url = f"{server.url}/health"
        try:
            response = await client.get(url, timeout=self.timeout)
            if response.status_code == 200:
                server.is_healthy = True
                return True
            server.is_healthy = False
            return False
        except (httpx.RequestError, httpx.TimeoutException) as exc:
            server.is_healthy = False
            logger.debug("Health check failed for %s: %s", server.id, exc)
            return False

    async def check_all_servers(self) -> Dict[str, bool]:
        tasks = [
            self.check_server_health(server)
            for server in self.load_balancer.servers.values()
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        health_status: Dict[str, bool] = {}
        for server, result in zip(self.load_balancer.servers.values(), results):
            health_status[server.id] = result is True
        return health_status

    async def _run_loop(self) -> None:
        logger.info("Starting health monitor loop with %ss interval", self.interval)
        try:
            while self._is_running:
                await self.check_all_servers()
                await asyncio.sleep(self.interval)
        except asyncio.CancelledError:
            logger.info("Health monitor loop cancelled")
            raise

    def start(self) -> None:
        if self._is_running:
            return
        self._is_running = True
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        self._is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._owns_client and self._client and not self._client.is_closed:
            await self._client.aclose()
