import httpx
import pytest
from app.config import ServerConfig
from app.load_balancer import LoadBalancer
from app.statistics import StatisticsCollector


@pytest.mark.asyncio
async def test_load_balancer_forward_request_success() -> None:
    configs = [ServerConfig(id="server-1", url="http://s1")]
    stats = StatisticsCollector(["server-1"])

    def mock_handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "http://s1/process"
        return httpx.Response(200, json={"server_id": "server-1", "message": "OK"})

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        lb = LoadBalancer(server_configs=configs, stats_collector=stats, client=client)
        result = await lb.forward_request("/process")

        assert result["status_code"] == 200
        assert result["body"]["server_id"] == "server-1"
        assert stats.successful_requests == 1
        assert stats.total_requests == 1


@pytest.mark.asyncio
async def test_load_balancer_all_unhealthy_returns_503() -> None:
    configs = [ServerConfig(id="server-1", url="http://s1")]
    stats = StatisticsCollector(["server-1"])
    lb = LoadBalancer(server_configs=configs, stats_collector=stats)
    lb.servers["server-1"].is_healthy = False

    result = await lb.forward_request("/process")
    assert result["status_code"] == 503
    assert result["body"]["detail"] == "No healthy backend servers available"
    assert stats.failed_requests == 1


@pytest.mark.asyncio
async def test_load_balancer_backend_timeout_and_error() -> None:
    configs = [ServerConfig(id="server-1", url="http://s1")]
    stats = StatisticsCollector(["server-1"])

    def mock_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        lb = LoadBalancer(server_configs=configs, stats_collector=stats, client=client)
        result = await lb.forward_request("/process")

        assert result["status_code"] == 502
        assert lb.servers["server-1"].is_healthy is False
        assert stats.failed_requests == 1
