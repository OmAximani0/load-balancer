import os
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Backend Server Node")


class HealthResponse(BaseModel):
    server_id: str
    status: str


class ProcessResponse(BaseModel):
    server_id: str
    message: str


class ServerInfoResponse(BaseModel):
    server_id: str
    status: str
    message: str


def get_server_id() -> str:
    return os.getenv("SERVER_ID", "server-1")


@app.get("/", response_model=ServerInfoResponse)
async def root() -> ServerInfoResponse:
    server_id = get_server_id()
    return ServerInfoResponse(
        server_id=server_id,
        status="running",
        message=f"Backend server {server_id} running",
    )


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    server_id = get_server_id()
    return HealthResponse(
        server_id=server_id,
        status="healthy",
    )


@app.get("/process", response_model=ProcessResponse)
async def process() -> ProcessResponse:
    server_id = get_server_id()
    return ProcessResponse(
        server_id=server_id,
        message="Request processed successfully",
    )
