import os
from typing import List
from pydantic import BaseModel, Field


class ServerConfig(BaseModel):
    id: str
    url: str


class Settings(BaseModel):
    health_check_interval: float = Field(default=5.0)
    request_timeout: float = Field(default=5.0)
    servers: List[ServerConfig] = Field(default_factory=list)


def get_default_server_configs() -> List[ServerConfig]:
    # Allows overriding URLs via environment variables while defaulting to Docker Compose service names
    s1_url = os.getenv("BACKEND_1_URL", "http://backend-1:8001")
    s2_url = os.getenv("BACKEND_2_URL", "http://backend-2:8002")
    s3_url = os.getenv("BACKEND_3_URL", "http://backend-3:8003")

    return [
        ServerConfig(id="server-1", url=s1_url),
        ServerConfig(id="server-2", url=s2_url),
        ServerConfig(id="server-3", url=s3_url),
    ]


def get_settings() -> Settings:
    interval = float(os.getenv("HEALTH_CHECK_INTERVAL", "5.0"))
    timeout = float(os.getenv("REQUEST_TIMEOUT", "5.0"))
    return Settings(
        health_check_interval=interval,
        request_timeout=timeout,
        servers=get_default_server_configs(),
    )
