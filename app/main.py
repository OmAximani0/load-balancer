import os
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Dict, List
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from app.config import get_settings
from app.health_monitor import HealthMonitor
from app.load_balancer import LoadBalancer
from app.statistics import StatisticsCollector

settings = get_settings()
stats_collector = StatisticsCollector([s.id for s in settings.servers])
load_balancer = LoadBalancer(
    server_configs=settings.servers,
    stats_collector=stats_collector,
    timeout=settings.request_timeout,
)
health_monitor = HealthMonitor(
    load_balancer=load_balancer,
    interval=settings.health_check_interval,
    timeout=settings.request_timeout,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Run initial health check on startup
    await health_monitor.check_all_servers()
    health_monitor.start()
    try:
        yield
    finally:
        await health_monitor.stop()
        await load_balancer.close()


app = FastAPI(
    title="Mini Distributed Load Balancer",
    description="HTTP Load Balancer with Round Robin scheduling and active health monitoring",
    version="1.0.0",
    lifespan=lifespan,
)

dashboard_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dashboard")
if os.path.exists(dashboard_dir):
    app.mount("/static", StaticFiles(directory=dashboard_dir), name="static")


class ToggleServerRequest(BaseModel):
    healthy: bool


class ServerInfo(BaseModel):
    id: str
    url: str
    healthy: bool


class HealthCheckResponse(BaseModel):
    status: str


@app.get("/", response_class=Response)
async def serve_dashboard() -> Response:
    index_file = os.path.join(dashboard_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file, media_type="text/html")
    return JSONResponse(
        content={"message": "Load Balancer Running. Dashboard file not found."},
        status_code=200,
    )


@app.get("/style.css", response_class=Response)
async def serve_css() -> Response:
    css_file = os.path.join(dashboard_dir, "style.css")
    if os.path.exists(css_file):
        return FileResponse(css_file, media_type="text/css")
    return Response(status_code=404)


@app.get("/script.js", response_class=Response)
async def serve_js() -> Response:
    js_file = os.path.join(dashboard_dir, "script.js")
    if os.path.exists(js_file):
        return FileResponse(js_file, media_type="application/javascript")
    return Response(status_code=404)


@app.get("/health", response_model=HealthCheckResponse)
async def health() -> HealthCheckResponse:
    # Own health check does not depend on backends
    return HealthCheckResponse(status="healthy")


@app.get("/proxy")
async def proxy_request(request: Request) -> JSONResponse:
    headers = dict(request.headers)
    body = await request.body()
    result = await load_balancer.forward_request(
        path="/process",
        method=request.method,
        headers=headers,
        content=body if body else None,
    )
    return JSONResponse(content=result["body"], status_code=result["status_code"])


@app.get("/servers", response_model=List[ServerInfo])
async def list_servers() -> List[ServerInfo]:
    return [
        ServerInfo(
            id=s.id,
            url=s.url,
            healthy=s.is_available,
        )
        for s in load_balancer.servers.values()
    ]


@app.get("/stats")
async def get_stats() -> Dict[str, Any]:
    health_map = load_balancer.get_server_health_map()
    return await stats_collector.get_stats(health_map)


@app.post("/servers/{server_id}/toggle")
async def toggle_server(server_id: str, payload: ToggleServerRequest) -> Dict[str, Any]:
    success = load_balancer.set_simulated_health(server_id, payload.healthy)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Server '{server_id}' not found",
        )
    return {
        "server_id": server_id,
        "healthy": payload.healthy,
        "message": f"Server {server_id} simulated health updated to {payload.healthy}",
    }
