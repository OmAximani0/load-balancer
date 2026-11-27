# Mini Distributed Load Balancer

A production-style, lightweight distributed load balancing system built with **Python 3.12**, **FastAPI**, **HTTPX**, and **Docker Compose**. It routes incoming HTTP requests across independent backend nodes using an asynchronous, concurrency-safe **Round-Robin** scheduling algorithm, featuring automated background health checks, failure detection, seamless recovery, live metrics tracking, and a modern web monitoring dashboard.

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

- **Load Balancer Service**: Exposes port `8000` to the host, runs the Round Robin scheduler, performs periodic background health checks, maintains in-memory telemetry, and serves the monitoring dashboard.
- **Backend Nodes (`backend-1`, `backend-2`, `backend-3`)**: Independent FastAPI instances communicating over the internal `distributed-network` Docker bridge.

---

## Directory Structure

```text
.
├── app/
│   ├── __init__.py
│   ├── config.py              # Environment configuration & server definitions
│   ├── health_monitor.py      # Background health monitor with automatic recovery
│   ├── load_balancer.py       # Async Round-Robin scheduler & request proxying
│   ├── main.py                # FastAPI endpoints, static routes, and lifespan hooks
│   └── statistics.py          # Concurrency-safe in-memory metrics collector
├── servers/
│   ├── __init__.py
│   └── backend.py             # Reusable backend node application
├── dashboard/
│   ├── index.html             # Modern SaaS telemetry dashboard
│   ├── style.css              # Responsive styles & pulse animations
│   └── script.js              # Live polling, traffic generator, and outage controls
├── tests/
│   ├── __init__.py
│   ├── test_backend.py        # Backend node unit tests
│   ├── test_health_monitor.py # Periodic health checking & recovery tests
│   ├── test_load_balancer.py  # Forwarding, failure handling & 503 tests
│   ├── test_main_api.py       # Load balancer API & static asset tests
│   ├── test_round_robin.py    # Concurrency-safe Round-Robin unit tests
│   └── test_statistics.py     # Request counting, latency & reset tests
├── Dockerfile                 # Multi-stage optimized application container
├── docker-compose.yml         # Container orchestration & network bridge
├── requirements.txt           # Python dependencies (fastapi, uvicorn, httpx, etc.)
├── pytest.ini                 # Pytest asyncio configuration
├── .dockerignore
├── .gitignore
├── CLAUDE.md                  # Development guidelines & canonical commands
└── README.md                  # Project documentation
```

---

## Quick Start (Docker Compose)

### 1. Start the Full Stack
```bash
docker compose up --build -d
```

### 2. Verify Container Health
```bash
docker compose ps
```
All four services (`load-balancer`, `backend-1`, `backend-2`, `backend-3`) will start and report healthy status.

### 3. Open the Web Dashboard
Navigate to: **[http://localhost:8000](http://localhost:8000)**

Interactive OpenAPI Swagger UI is available at: **[http://localhost:8000/docs](http://localhost:8000/docs)**

### 4. Dispatch Test Requests
Send sequential requests through the load balancer:
```bash
for i in {1..6}; do
  curl -s http://localhost:8000/proxy
  echo
done
```
Output illustrates perfect round-robin routing:
```json
{"server_id":"server-1","message":"Request processed successfully"}
{"server_id":"server-2","message":"Request processed successfully"}
{"server_id":"server-3","message":"Request processed successfully"}
{"server_id":"server-1","message":"Request processed successfully"}
{"server_id":"server-2","message":"Request processed successfully"}
{"server_id":"server-3","message":"Request processed successfully"}
```

### 5. Stop the Stack
```bash
docker compose down
```

---

## Configuration & Environment Variables

The application can be configured via environment variables in `docker-compose.yml` or your local environment:

| Variable | Default Value | Description |
|---|---|---|
| `BACKEND_1_URL` | `http://backend-1:8001` | Full HTTP base URL for backend node 1 |
| `BACKEND_2_URL` | `http://backend-2:8002` | Full HTTP base URL for backend node 2 |
| `BACKEND_3_URL` | `http://backend-3:8003` | Full HTTP base URL for backend node 3 |
| `HEALTH_CHECK_INTERVAL` | `5.0` | Health check interval in seconds |
| `REQUEST_TIMEOUT` | `5.0` | HTTP proxy and health check timeout in seconds |
| `SERVER_ID` | `server-1` | Unique node identifier (passed to backend instances) |

---

## API Endpoints Reference

### Load Balancer Endpoints (`:8000`)

#### `GET /`
Serves the responsive web monitoring dashboard (`index.html`).

#### `GET /health`
Returns the operational health status of the load balancer service itself.
```bash
curl -s http://localhost:8000/health
```
**Response (200 OK):**
```json
{
  "status": "healthy"
}
```

#### `GET /proxy`
Forwards the request to the next available healthy backend node via Round-Robin.
```bash
curl -s http://localhost:8000/proxy
```
**Response (200 OK):**
```json
{
  "server_id": "server-1",
  "message": "Request processed successfully"
}
```
*Note: If no healthy backend servers are available, returns `503 Service Unavailable`:*
```json
{
  "detail": "No healthy backend servers available"
}
```

#### `GET /servers`
Lists all configured backend servers, their target URLs, and their current health status.
```bash
curl -s http://localhost:8000/servers
```
**Response (200 OK):**
```json
[
  {"id": "server-1", "url": "http://backend-1:8001", "healthy": true},
  {"id": "server-2", "url": "http://backend-2:8002", "healthy": true},
  {"id": "server-3", "url": "http://backend-3:8003", "healthy": true}
]
```

#### `GET /stats`
Retrieves cumulative and per-server request metrics and average latency.
```bash
curl -s http://localhost:8000/stats
```
**Response (200 OK):**
```json
{
  "total_requests": 6,
  "successful_requests": 6,
  "failed_requests": 0,
  "active_servers": 3,
  "servers": [
    {"id": "server-1", "requests": 2, "healthy": true, "avg_response_time_ms": 3.12},
    {"id": "server-2", "requests": 2, "healthy": true, "avg_response_time_ms": 2.85},
    {"id": "server-3", "requests": 2, "healthy": true, "avg_response_time_ms": 3.04}
  ]
}
```

#### `POST /stats/reset`
Resets all cumulative request counts and average latencies back to zero.
```bash
curl -s -X POST http://localhost:8000/stats/reset
```
**Response (200 OK):**
```json
{
  "message": "Traffic statistics reset successfully"
}
```

#### `POST /servers/{server_id}/toggle`
Simulates an administrative outage or restoration of a specific backend server without stopping the Docker container.
```bash
# Simulate server-2 outage
curl -s -X POST http://localhost:8000/servers/server-2/toggle \
  -H "Content-Type: application/json" \
  -d '{"healthy": false}'

# Restore server-2 to rotation
curl -s -X POST http://localhost:8000/servers/server-2/toggle \
  -H "Content-Type: application/json" \
  -d '{"healthy": true}'
```
**Response (200 OK):**
```json
{
  "server_id": "server-2",
  "healthy": false,
  "message": "Server server-2 simulated health updated to False"
}
```

---

### Backend Server Node Endpoints (`:8001`, `:8002`, `:8003`)

Each backend node (`servers/backend.py`) exposes:
- **`GET /`**: Server metadata and status (`{"server_id": "server-1", "status": "running", "message": "Backend server server-1 running"}`).
- **`GET /health`**: Health probe used by the load balancer's background health monitor (`{"server_id": "server-1", "status": "healthy"}`).
- **`GET /process`**: Request processing workload simulation endpoint invoked by `/proxy`.

---

## Interactive Monitoring Dashboard

The dashboard provides a modern SaaS telemetry experience with real-time feedback:

- **Cluster Overview KPIs**: Displays cumulative requests, successful requests, failed requests (with success rate badge), and active node counts.
- **Backend Server Fleet Cards**: Displays per-node request counts, proportional traffic share, average latency (ms), and current status badge (`In Rotation` vs `Simulated Down`).
- **Failure Simulation Controls**: Toggle any node offline or back online directly from the UI with instant feedback.
- **Visual Pulse Dispatch Animation**: Whenever a request is forwarded, the target backend card highlights with a color-coded ping animation.
- **Proportional Traffic Distribution Bar**: Color-coded segmented progress bar visually depicting request balance across nodes.
- **Recent Dispatches Activity Stream**: Real-time table displaying the last 10 requests with request number, target backend, latency, status code, and timestamp.
- **Traffic Controls**:
  - `Send Test Request`: Triggers a single test request through `/proxy`.
  - `Auto Traffic`: Automatically streams 1 request per second for load demonstration.
  - `Reset Traffic`: Resets all telemetry counters and logs with an inline confirmation state.

---

## Failure Detection & Recovery Demo

### Scenario 1: UI / REST Simulated Outage
1. Open the dashboard at [http://localhost:8000](http://localhost:8000).
2. Click **"Simulate Failure"** on `server-2`. Its status changes to `Simulated Down`.
3. Click **"Send Test Request"** repeatedly (or enable **"Auto Traffic"**).
4. Notice traffic routes exclusively between `server-1` and `server-3`.
5. Click **"Restore Server"** on `server-2`. It immediately re-enters the Round-Robin cycle.

### Scenario 2: Container Failure & Automatic Health Detection
1. Stop `backend-2` container:
   ```bash
   docker compose stop backend-2
   ```
2. Within 5 seconds, the background health monitor marks `backend-2` unhealthy.
3. Send requests:
   ```bash
   for i in {1..6}; do curl -s http://localhost:8000/proxy; echo; done
   ```
   Requests only route to `backend-1` and `backend-3`.
4. Restart the container:
   ```bash
   docker compose start backend-2
   ```
5. Within 5 seconds, the health monitor probes `http://backend-2:8002/health`, detects recovery, and re-adds `backend-2` to rotation.

---

## Local Development & Testing

### 1. Setup Virtual Environment
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Run Test Suite
Run all 22 automated tests:
```bash
pytest -v
```

Run specific test files:
```bash
pytest tests/test_round_robin.py -v
pytest tests/test_health_monitor.py -v
pytest tests/test_load_balancer.py -v
pytest tests/test_statistics.py -v
pytest tests/test_main_api.py -v
pytest tests/test_backend.py -v
```

### 3. Run Load Balancer Locally (Without Docker)
Start backends in separate terminals:
```bash
# Terminal 1
SERVER_ID=server-1 uvicorn servers.backend:app --port 8001

# Terminal 2
SERVER_ID=server-2 uvicorn servers.backend:app --port 8002

# Terminal 3
SERVER_ID=server-3 uvicorn servers.backend:app --port 8003
```

Start the load balancer pointing to localhost:
```bash
# Terminal 4
BACKEND_1_URL=http://localhost:8001 \
BACKEND_2_URL=http://localhost:8002 \
BACKEND_3_URL=http://localhost:8003 \
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## Operational Commands & Troubleshooting

| Action | Command |
|---|---|
| View Load Balancer Logs | `docker compose logs -f load-balancer` |
| View Backend Node Logs | `docker compose logs -f backend-1` |
| View All Stack Logs | `docker compose logs -f` |
| Rebuild after Code Changes | `docker compose up --build -d` |
| Check Port 8000 Availability | `lsof -i :8000` or `netstat -tuln | grep 8000` |
| Complete Tear Down | `docker compose down -v` |
