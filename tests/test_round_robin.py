import asyncio
import pytest
from app.load_balancer import BackendServer, RoundRobinScheduler


@pytest.mark.asyncio
async def test_round_robin_sequential_order() -> None:
    scheduler = RoundRobinScheduler()
    servers = [
        BackendServer(server_id="server-1", url="http://s1"),
        BackendServer(server_id="server-2", url="http://s2"),
        BackendServer(server_id="server-3", url="http://s3"),
    ]

    selected_ids = []
    for _ in range(6):
        server = await scheduler.select_server(servers)
        assert server is not None
        selected_ids.append(server.id)

    assert selected_ids == [
        "server-1",
        "server-2",
        "server-3",
        "server-1",
        "server-2",
        "server-3",
    ]


@pytest.mark.asyncio
async def test_round_robin_skips_unhealthy() -> None:
    scheduler = RoundRobinScheduler()
    s1 = BackendServer(server_id="server-1", url="http://s1")
    s2 = BackendServer(server_id="server-2", url="http://s2")
    s3 = BackendServer(server_id="server-3", url="http://s3")

    s2.is_healthy = False
    servers = [s1, s2, s3]

    selected_ids = []
    for _ in range(4):
        server = await scheduler.select_server(servers)
        assert server is not None
        selected_ids.append(server.id)

    assert selected_ids == ["server-1", "server-3", "server-1", "server-3"]


@pytest.mark.asyncio
async def test_round_robin_all_unhealthy_returns_none() -> None:
    scheduler = RoundRobinScheduler()
    s1 = BackendServer(server_id="server-1", url="http://s1")
    s2 = BackendServer(server_id="server-2", url="http://s2")
    s1.is_healthy = False
    s2.is_healthy = False

    server = await scheduler.select_server([s1, s2])
    assert server is None


@pytest.mark.asyncio
async def test_round_robin_dynamic_recovery() -> None:
    scheduler = RoundRobinScheduler()
    s1 = BackendServer(server_id="server-1", url="http://s1")
    s2 = BackendServer(server_id="server-2", url="http://s2")
    s3 = BackendServer(server_id="server-3", url="http://s3")
    servers = [s1, s2, s3]

    # Initially s2 is down
    s2.is_healthy = False
    s_first = await scheduler.select_server(servers)
    assert s_first is not None and s_first.id == "server-1"
    s_second = await scheduler.select_server(servers)
    assert s_second is not None and s_second.id == "server-3"

    # Now s2 recovers
    s2.is_healthy = True
    selected = []
    for _ in range(3):
        srv = await scheduler.select_server(servers)
        assert srv is not None
        selected.append(srv.id)

    assert "server-2" in selected


@pytest.mark.asyncio
async def test_round_robin_concurrent_selection() -> None:
    scheduler = RoundRobinScheduler()
    servers = [
        BackendServer(server_id="server-1", url="http://s1"),
        BackendServer(server_id="server-2", url="http://s2"),
        BackendServer(server_id="server-3", url="http://s3"),
    ]

    async def pick() -> str:
        s = await scheduler.select_server(servers)
        assert s is not None
        return s.id

    tasks = [pick() for _ in range(300)]
    results = await asyncio.gather(*tasks)

    assert results.count("server-1") == 100
    assert results.count("server-2") == 100
    assert results.count("server-3") == 100
