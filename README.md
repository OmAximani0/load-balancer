# Mini Distributed Load Balancer

A lightweight distributed load balancing system built with Python, FastAPI, HTTPX, and Docker Compose. It distributes incoming HTTP requests across multiple independent backend servers using the Round Robin scheduling algorithm, featuring automatic health checks, failure detection, server recovery, real-time statistics, and an interactive monitoring dashboard.

---

## Architecture Overview

```text
                    CLIENT
                       |
                  HTTP Request
                       |
                       v
              +------------------+
              |  LOAD BALANCER   |
              |     (:8000)      |
              |  Round Robin     |
              |  Health Monitor  |
              |  Statistics      |
              +------------------+
                       |
          +------------+------------+
          |            |            |
          v            v            v
     +---------+  +---------+  +---------+
     |Backend 1|  |Backend 2|  |Backend 3|
     |  :8001  |  |  :8002  |  |  :8003  |
     +---------+  +---------+  +---------+
          |            |            |
          +------------+------------+
                       |
                  HTTP Response
                       |
                       v
                     CLIENT
```

- **Load Balancer Service**: Exposes port `8000` to the host, runs the Round Robin scheduler, performs background health checks, tracks in-memory metrics, and serves the monitoring dashboard.
- **Backend Nodes (`backend-1`, `backend-2`, `backend-3`)**: Independent FastAPI instances communicating exclusively over the internal `distributed-network` bridge.

---

## Directory Structure

```text
.
├── app/
│   ├── __init__.py
│   ├── config.py            # Environment & backend server configuration
│   ├── health_monitor.py    # Periodic background health checking
│   ├── load_balancer.py     # Round Robin scheduler & HTTP request forwarding
│   ├── main.py              # FastAPI endpoints & application lifecycle
│   └── statistics.py        # In-memory metrics & latency collection
├── servers/
│   ├── __init__.py
│   └── backend.py           # Reusable backend node implementation
├── dashboard/
│   ├── index.html           # Real-time web monitoring interface
│   ├── style.css            # Dashboard styles
│   └── script.js            # Live telemetry polling & controls
├── tests/
│   ├── __init__.py
│   ├── test_backend.py      # Backend endpoint tests
│   ├── test_health_monitor.py # Health check & recovery tests
│   ├── test_load_balancer.py  # Forwarding & 503 error tests
│   ├── test_main_api.py     # Load balancer API tests
│   ├── test_round_robin.py  # Concurrency & scheduling tests
│   └── test_statistics.py   # Latency & request counter tests
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── pytest.ini
├── .dockerignore
└── .gitignore
```

---

## Quick Start (Docker Compose)

### 1. Start Stack
```bash
docker compose up --build -d
```

### 2. Verify Containers
```bash
docker compose ps
```

### 3. Access Dashboard & API
- **Monitoring Dashboard**: [http://localhost:8000](http://localhost:8000)
- **Interactive OpenAPI Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

### 4. Send Requests Through the Load Balancer
```bash
for i in {1..9}; do
  curl -s http://localhost:8000/proxy
  echo
done
```

### 5. Stop Stack
```bash
docker compose down
```

---

## Local Development & Testing

### 1. Setup Virtual Environment
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Run Test Suite
```bash
pytest -v
```

### 3. Run Load Balancer Locally
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## API Endpoints Reference

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Serves the monitoring dashboard |
| `/proxy` | GET | Distributes request to next healthy backend |
| `/health` | GET | Health status of the load balancer itself |
| `/servers` | GET | List configured backends and their health |
| `/stats` | GET | In-memory request metrics and average latency |
| `/stats/reset` | POST | Resets total and per-server traffic statistics |
| `/servers/{server_id}/toggle` | POST | Administrative simulation to toggle backend availability |

---

## Failure Detection & Recovery Demo

1. **Stop backend-2**:
   ```bash
   docker compose stop backend-2
   ```
2. Wait 5 seconds for the health monitor to detect container unavailability.
3. Send requests:
   ```bash
   for i in {1..6}; do curl -s http://localhost:8000/proxy; echo; done
   ```
   Requests will only route to `backend-1` and `backend-3`.
4. **Restore backend-2**:
   ```bash
   docker compose start backend-2
   ```
5. Observe `backend-2` seamlessly rejoin the Round Robin rotation once healthy.
