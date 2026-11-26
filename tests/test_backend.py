import pytest
from httpx import ASGITransport, AsyncClient
from servers.backend import app


@pytest.mark.asyncio
async def test_backend_endpoints(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SERVER_ID", "server-test-1")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Test root /
        resp_root = await client.get("/")
        assert resp_root.status_code == 200
        data_root = resp_root.json()
        assert data_root["server_id"] == "server-test-1"
        assert data_root["status"] == "running"

        # Test /health
        resp_health = await client.get("/health")
        assert resp_health.status_code == 200
        data_health = resp_health.json()
        assert data_health["server_id"] == "server-test-1"
        assert data_health["status"] == "healthy"

        # Test /process
        resp_proc = await client.get("/process")
        assert resp_proc.status_code == 200
        data_proc = resp_proc.json()
        assert data_proc["server_id"] == "server-test-1"
        assert data_proc["message"] == "Request processed successfully"
