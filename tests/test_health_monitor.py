import asyncio
import httpx
import pytest
from app.config import ServerConfig
from app.health_monitor import HealthMonitor
from app.load_balancer import LoadBalancer


@pytest.mark.asyncio
async def test_health_monitor_mark_healthy_and_unhealthy() -> None:
    configs = [
        ServerConfig(id="server-1", url="http://s1"),
        ServerConfig(id="server-2", url="http://s2"),
    ]

    server_status = {"http://s1/health": 200, "http://s2/health": 500}

    def mock_handler(request: httpx.Request) -> httpx.Response:
        status = server_status.get(str(request.url), 500)
        return httpx.Response(status, json={"status": "ok" if status == 200 else "error"})

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        lb = LoadBalancer(server_configs=configs)
        monitor = HealthMonitor(load_balancer=lb, client=client, interval=0.1)

        statuses = await monitor.check_all_servers()

        assert statuses["server-1"] is True
        assert lb.servers["server-1"].is_healthy is True

        assert statuses["server-2"] is False
        assert lb.servers["server-2"].is_healthy is False


@pytest.mark.asyncio
async def test_health_monitor_detects_recovery() -> None:
    configs = [ServerConfig(id="server-1", url="http://s1")]

    current_status = 500

    def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(current_status, json={"status": "state"})

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        lb = LoadBalancer(server_configs=configs)
        monitor = HealthMonitor(load_balancer=lb, client=client, interval=0.1)

        # First check fails
        await monitor.check_all_servers()
        assert lb.servers["server-1"].is_healthy is False

        # Recover server
        current_status = 200
        await monitor.check_all_servers()
        assert lb.servers["server-1"].is_healthy is True


@pytest.mark.asyncio
async def test_health_monitor_handles_timeout() -> None:
    configs = [ServerConfig(id="server-1", url="http://s1")]

    def mock_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("Connection timed out")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        lb = LoadBalancer(server_configs=configs)
        monitor = HealthMonitor(load_balancer=lb, client=client, interval=0.1)

        statuses = await monitor.check_all_servers()
        assert statuses["server-1"] is False
        assert lb.servers["server-1"].is_healthy is False


@pytest.mark.asyncio
async def test_health_monitor_lifecycle() -> None:
    configs = [ServerConfig(id="server-1", url="http://s1")]

    def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "healthy"})

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        lb = LoadBalancer(server_configs=configs)
        monitor = HealthMonitor(load_balancer=lb, client=client, interval=0.05)

        monitor.start()
        assert monitor._is_running is True
        await asyncio.sleep(0.12)
        await monitor.stop()
        assert monitor._is_running is False
        assert lb.servers["server-1"].is_healthy is True
