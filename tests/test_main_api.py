from typing import Any, Dict
from fastapi import FastAPI
import httpx
import pytest
from httpx import ASGITransport, AsyncClient
from app.config import ServerConfig
from app.load_balancer import LoadBalancer
from app.main import app, load_balancer, stats_collector


@pytest.mark.asyncio
async def test_main_health_endpoint() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}


@pytest.mark.asyncio
async def test_main_servers_endpoint() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/servers")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        ids = [s["id"] for s in data]
        assert "server-1" in ids
        assert "server-2" in ids
        assert "server-3" in ids


@pytest.mark.asyncio
async def test_main_stats_endpoint() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_requests" in data
        assert "successful_requests" in data
        assert "failed_requests" in data
        assert "active_servers" in data
        assert "servers" in data


@pytest.mark.asyncio
async def test_main_toggle_endpoint() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Toggle valid server
        resp_toggle = await client.post("/servers/server-1/toggle", json={"healthy": False})
        assert resp_toggle.status_code == 200
        assert load_balancer.servers["server-1"].is_simulated_down is True

        # Toggle back
        resp_back = await client.post("/servers/server-1/toggle", json={"healthy": True})
        assert resp_back.status_code == 200
        assert load_balancer.servers["server-1"].is_simulated_down is False

        # Toggle invalid server
        resp_invalid = await client.post("/servers/nonexistent/toggle", json={"healthy": False})
        assert resp_invalid.status_code == 404


@pytest.mark.asyncio
async def test_main_proxy_no_servers_available() -> None:
    # Temporarily set all servers unhealthy
    original_health = {s.id: s.is_healthy for s in load_balancer.servers.values()}
    for s in load_balancer.servers.values():
        s.is_healthy = False

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/proxy")
            assert response.status_code == 503
            assert response.json() == {"detail": "No healthy backend servers available"}
    finally:
        for s_id, h in original_health.items():
            load_balancer.servers[s_id].is_healthy = h


@pytest.mark.asyncio
async def test_main_dashboard_assets() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Dashboard HTML
        resp_html = await client.get("/")
        assert resp_html.status_code == 200
        assert "Mini Distributed Load Balancer" in resp_html.text

        # CSS
        resp_css = await client.get("/style.css")
        assert resp_css.status_code == 200

        # JS
        resp_js = await client.get("/script.js")
        assert resp_js.status_code == 200

