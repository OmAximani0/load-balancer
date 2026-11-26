import pytest
from app.statistics import StatisticsCollector


@pytest.mark.asyncio
async def test_statistics_collector_counts() -> None:
    collector = StatisticsCollector(["server-1", "server-2"])

    await collector.record_request(server_id="server-1", success=True, response_time_ms=10.0)
    await collector.record_request(server_id="server-1", success=True, response_time_ms=20.0)
    await collector.record_request(server_id="server-2", success=False, response_time_ms=0.0)
    await collector.record_request(server_id=None, success=False, response_time_ms=0.0)

    health_map = {"server-1": True, "server-2": False}
    stats = await collector.get_stats(health_map)

    assert stats["total_requests"] == 4
    assert stats["successful_requests"] == 2
    assert stats["failed_requests"] == 2
    assert stats["active_servers"] == 1

    s1_data = next(s for s in stats["servers"] if s["id"] == "server-1")
    assert s1_data["requests"] == 2
    assert s1_data["healthy"] is True
    assert s1_data["avg_response_time_ms"] == 15.0

    s2_data = next(s for s in stats["servers"] if s["id"] == "server-2")
    assert s2_data["requests"] == 1
    assert s2_data["healthy"] is False
    assert s2_data["avg_response_time_ms"] == 0.0


@pytest.mark.asyncio
async def test_statistics_reset() -> None:
    collector = StatisticsCollector(["server-1"])
    await collector.record_request(server_id="server-1", success=True, response_time_ms=30.0)
    await collector.reset()

    stats = await collector.get_stats({"server-1": True})
    assert stats["total_requests"] == 0
    assert stats["successful_requests"] == 0
    assert stats["failed_requests"] == 0
