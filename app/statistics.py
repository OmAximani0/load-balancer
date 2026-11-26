import asyncio
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class ServerStats:
    server_id: str
    requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    total_response_time_ms: float = 0.0

    @property
    def avg_response_time_ms(self) -> float:
        if self.successful_requests == 0:
            return 0.0
        return round(self.total_response_time_ms / self.successful_requests, 2)


class StatisticsCollector:
    def __init__(self, server_ids: Optional[List[str]] = None) -> None:
        self._lock = asyncio.Lock()
        self.total_requests: int = 0
        self.successful_requests: int = 0
        self.failed_requests: int = 0
        self._server_stats: Dict[str, ServerStats] = {}
        if server_ids:
            for s_id in server_ids:
                self.register_server(s_id)

    def register_server(self, server_id: str) -> None:
        if server_id not in self._server_stats:
            self._server_stats[server_id] = ServerStats(server_id=server_id)

    async def record_request(
        self,
        server_id: Optional[str],
        success: bool,
        response_time_ms: float = 0.0,
    ) -> None:
        async with self._lock:
            self.total_requests += 1
            if success:
                self.successful_requests += 1
            else:
                self.failed_requests += 1

            if server_id:
                if server_id not in self._server_stats:
                    self._server_stats[server_id] = ServerStats(server_id=server_id)
                stats = self._server_stats[server_id]
                stats.requests += 1
                if success:
                    stats.successful_requests += 1
                    stats.total_response_time_ms += response_time_ms
                else:
                    stats.failed_requests += 1

    async def get_stats(self, server_health_map: Dict[str, bool]) -> Dict[str, Any]:
        async with self._lock:
            active_servers = sum(1 for is_healthy in server_health_map.values() if is_healthy)
            servers_data: List[Dict[str, Any]] = []

            for s_id, s_stats in self._server_stats.items():
                is_healthy = server_health_map.get(s_id, False)
                servers_data.append(
                    {
                        "id": s_id,
                        "requests": s_stats.requests,
                        "healthy": is_healthy,
                        "avg_response_time_ms": s_stats.avg_response_time_ms,
                    }
                )

            return {
                "total_requests": self.total_requests,
                "successful_requests": self.successful_requests,
                "failed_requests": self.failed_requests,
                "active_servers": active_servers,
                "servers": servers_data,
            }

    async def reset(self) -> None:
        async with self._lock:
            self.total_requests = 0
            self.successful_requests = 0
            self.failed_requests = 0
            for stats in self._server_stats.values():
                stats.requests = 0
                stats.successful_requests = 0
                stats.failed_requests = 0
                stats.total_response_time_ms = 0.0
