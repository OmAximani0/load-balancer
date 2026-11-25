# Mini Distributed Load Balancer

A lightweight distributed load balancing system built with Python, FastAPI, HTTPX and Docker Compose. The system distributes incoming HTTP requests across multiple independent backend servers using the Round Robin scheduling algorithm.

It includes automatic backend health monitoring, failure detection, server recovery, request statistics and a web-based monitoring dashboard.

---

## 1. Project Overview

### Problem Statement

When multiple clients send requests to a single server, that server can become overloaded, resulting in increased response times and reduced availability.

A load balancer distributes incoming requests across multiple backend servers to improve resource utilization and availability.

However, when a backend server becomes unavailable, requests directed towards that server may fail. Therefore, the system must monitor backend health and automatically exclude unhealthy servers from request distribution.

### Proposed Solution

Build a centralized HTTP load balancer that distributes requests across three independent FastAPI backend servers.

The system will use:

- Round Robin scheduling for request distribution.
- HTTPX for asynchronous HTTP communication.
- Periodic health checks for backend monitoring.
- Docker Compose for container orchestration and networking.
- In-memory statistics for request monitoring.
- HTML, CSS and JavaScript for the monitoring dashboard.

### Project Objectives

1. Implement a functional HTTP load balancer.
2. Distribute requests using Round Robin scheduling.
3. Run multiple independent backend servers in Docker containers.
4. Detect unavailable backend servers automatically.
5. Exclude unhealthy servers from request distribution.
6. Automatically detect server recovery.
7. Collect request and response-time statistics.
8. Provide a dashboard to monitor the entire system.

---

## 2. Technology Stack

| Component | Technology |
|---|---|
| Language | Python 3.12 |
| API Framework | FastAPI |
| HTTP Client | HTTPX |
| Asynchronous Programming | asyncio |
| Containerization | Docker |
| Container Orchestration | Docker Compose |
| Frontend | HTML, CSS, JavaScript |
| Communication | HTTP / REST |
| Testing | pytest, pytest-asyncio, HTTPX |

### Important Constraints

Keep the implementation simple.

Do not introduce the following technologies:

- Kubernetes
- Docker Swarm
- Redis
- PostgreSQL or MySQL
- External load balancing services
- Message brokers
- Distributed consensus algorithms
- Machine learning

All statistics should be maintained in memory.

The application must work locally through Docker Compose without requiring external infrastructure.

---

## 3. System Architecture

The system consists of the following services:

| Service | Internal Port | Responsibility |
|---|---:|---|
| load-balancer | 8000 | Request routing and monitoring APIs |
| backend-1 | 8001 | Backend request processing |
| backend-2 | 8002 | Backend request processing |
| backend-3 | 8003 | Backend request processing |

All services must communicate through a shared Docker bridge network.

Only the load balancer should expose a port to the host machine.

### Architecture Flow

```text
                    CLIENT
                       |
                       |
                 HTTP Request
                       |
                       v
              +------------------+
              |  LOAD BALANCER   |
              |                  |
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

### Request Flow

1. Client sends an HTTP request to the load balancer.
2. Load balancer retrieves the current healthy backend servers.
3. Round Robin selects the next available backend.
4. Load balancer forwards the request using HTTPX.
5. Backend processes the request and returns its response.
6. Load balancer returns the backend response to the client.
7. Statistics collector updates request counts and response times.

### Example Distribution

When all three servers are healthy:

```text
Request 1  -> Server 1
Request 2  -> Server 2
Request 3  -> Server 3
Request 4  -> Server 1
Request 5  -> Server 2
Request 6  -> Server 3
```

When Server 2 becomes unavailable:

```text
Request 7  -> Server 1
Request 8  -> Server 3
Request 9  -> Server 1
Request 10 -> Server 3
```

---

## 4. Project Directory Structure

Create the following directory structure:

```text
mini-distributed-load-balancer/
│
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── load_balancer.py
│   ├── health_monitor.py
│   └── statistics.py
│
├── servers/
│   ├── __init__.py
│   └── backend.py
│
├── dashboard/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── tests/
│   ├── __init__.py
│   ├── test_round_robin.py
│   ├── test_health_monitor.py
│   ├── test_load_balancer.py
│   └── test_statistics.py
│
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .dockerignore
├── .gitignore
└── README.md
```

### Module Responsibilities

| File | Responsibility |
|---|---|
| `main.py` | FastAPI application, lifecycle management and API endpoints |
| `config.py` | Backend server configuration |
| `load_balancer.py` | Round Robin scheduling and HTTP request forwarding |
| `health_monitor.py` | Periodic backend health checks |
| `statistics.py` | Request statistics and response-time collection |
| `backend.py` | Reusable backend server application |
| `index.html` | Dashboard structure |
| `style.css` | Dashboard styling |
| `script.js` | Dashboard API integration and updates |
| `docker-compose.yml` | Container orchestration |
| `Dockerfile` | Application image |
| `tests/` | Automated tests |

---

## 5. Functional Requirements

### 5.1 Backend Server Nodes

Implement one reusable FastAPI application.

Docker Compose must start three instances of this application with different environment variables.

Each backend must have a unique server ID.

Environment variables:

```text
SERVER_ID=server-1
```

Each backend must expose the following endpoints:

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Return server information |
| `/health` | GET | Return backend health |
| `/process` | GET | Process a sample request |

Example `/health` response:

```json
{
  "server_id": "server-1",
  "status": "healthy"
}
```

Example `/process` response:

```json
{
  "server_id": "server-1",
  "message": "Request processed successfully"
}
```

The response must include the server ID to identify which backend handled the request.

### 5.2 Load Balancer

Implement a centralized load balancer.

Responsibilities:

- Accept incoming HTTP requests.
- Maintain the configured backend server list.
- Select healthy servers using Round Robin.
- Forward requests using HTTPX.
- Return backend responses.
- Handle connection errors.
- Handle request timeouts.
- Update statistics.

Use asynchronous HTTP communication.

Use an asynchronous lock to protect the Round Robin index and server selection from concurrent requests.

If a backend fails during request forwarding:

1. Mark the backend unhealthy.
2. Record the failed request.
3. Return an appropriate error response.
4. Allow future requests to use other healthy backends.

Do not silently retry the same request against another backend. A retry mechanism can accidentally execute non-idempotent operations more than once.

### 5.3 Round Robin Algorithm

Implement a Round Robin scheduler that selects backend servers sequentially.

Requirements:

- Only healthy servers can be selected.
- Selection must be concurrency-safe.
- The scheduler must handle changes in the healthy server list.
- Unhealthy servers must be skipped.
- Recovered servers must become eligible again.
- Return no server when all backends are unhealthy.

Example pseudocode:

```python
healthy_servers = get_healthy_servers()

if not healthy_servers:
    return None

selected_server = healthy_servers[
    current_index % len(healthy_servers)
]

current_index += 1

return selected_server
```

Implement the actual algorithm using appropriate asynchronous synchronization.

### 5.4 Health Monitoring

Implement a background health monitoring task.

Requirements:

- Check all configured backend servers periodically.
- Use HTTPX asynchronous requests.
- Health-check interval: 5 seconds.
- Use a reasonable request timeout.
- Mark a backend unhealthy when its health check fails.
- Mark it healthy again when a subsequent health check succeeds.
- Handle startup failures gracefully.
- Do not terminate the load balancer if a backend is unavailable.

Example monitoring logic:

```text
START HEALTH MONITOR

REPEAT:
    FOR EACH BACKEND:
        SEND GET /health

        IF RESPONSE IS SUCCESSFUL:
            MARK BACKEND HEALTHY
        ELSE:
            MARK BACKEND UNHEALTHY

    WAIT 5 SECONDS
```

Use an asynchronous background task managed by the FastAPI application lifecycle.

Ensure the task is cancelled cleanly during application shutdown.

### 5.5 Statistics Collector

Maintain application-level statistics in memory.

Collect:

- Total requests received.
- Successful requests.
- Failed requests.
- Requests processed by each backend.
- Current health status of each backend.
- Average response time per backend.
- Current number of healthy backend servers.

Example statistics response:

```json
{
  "total_requests": 100,
  "successful_requests": 98,
  "failed_requests": 2,
  "active_servers": 2,
  "servers": [
    {
      "id": "server-1",
      "requests": 50,
      "healthy": true,
      "avg_response_time_ms": 25.4
    },
    {
      "id": "server-2",
      "requests": 0,
      "healthy": false,
      "avg_response_time_ms": 0
    },
    {
      "id": "server-3",
      "requests": 48,
      "healthy": true,
      "avg_response_time_ms": 29.1
    }
  ]
}
```

The values above are illustrative.

Requirements:

- Maintain separate statistics for each backend.
- Use locks where concurrent updates could cause inconsistent results.
- Measure response times using a monotonic clock.
- Calculate average response time from completed backend requests.
- Do not count health-check requests as client requests.
- Keep statistics in memory; persistence is not required.

---

## 6. API Specification

The load balancer must expose the following API endpoints.

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Serve monitoring dashboard |
| `/proxy` | GET | Forward request to selected backend |
| `/health` | GET | Return load balancer health |
| `/servers` | GET | Return backend health information |
| `/stats` | GET | Return application statistics |
| `/servers/{server_id}/toggle` | POST | Simulate backend availability |

### GET /

Serve the dashboard HTML file.

### GET /proxy

Forward a request to the next healthy backend.

Example response:

```json
{
  "server_id": "server-1",
  "message": "Request processed successfully"
}
```

If no healthy backend is available:

```json
{
  "detail": "No healthy backend servers available"
}
```

Return HTTP 503.

If a backend request times out or fails, return an appropriate HTTP error and update statistics.

### GET /health

Return the load balancer's own health.

This endpoint must not depend on the availability of individual backends.

### GET /servers

Return the configured backend list and their current health status.

### GET /stats

Return all collected application statistics.

### POST /servers/{server_id}/toggle

Provide an administrative simulation mechanism to mark a backend unavailable or available.

Example:

```http
POST /servers/server-2/toggle
```

The endpoint should accept a JSON body:

```json
{
  "healthy": false
}
```

Important:

- This endpoint only changes simulated backend availability.
- It must not actually start or stop Docker containers.
- Actual container failure must also be detectable through periodic health checks.
- Invalid server IDs should return HTTP 404.

---

## 7. Docker Configuration

### Dockerfile

Use Python 3.12 slim as the base image.

Requirements:

- Set `/app` as the working directory.
- Install dependencies from `requirements.txt`.
- Copy application source code.
- Expose port 8000.
- Use Uvicorn to start the application.

### Docker Compose

Create four services:

1. `load-balancer`
2. `backend-1`
3. `backend-2`
4. `backend-3`

All services must use the same application image.

Each backend must receive a unique `SERVER_ID`.

Use a shared Docker bridge network called:

```text
distributed-network
```

Only publish this host port:

```text
8000:8000
```

Do not publish backend ports to the host.

The load balancer must communicate with backends through Docker service names:

```text
http://backend-1:8001
http://backend-2:8002
http://backend-3:8003
```

Important:

- Do not use localhost for container-to-container communication.
- `depends_on` is not a readiness check.
- The health monitor must handle backend startup delays.
- Containers should be independently stoppable and restartable.
- Use appropriate container logging.

---

## 8. Monitoring Dashboard

Build a simple, clean and responsive dashboard.

Do not introduce React, Vue or another frontend framework.

Use plain HTML, CSS and JavaScript.

### Dashboard Layout

The dashboard should contain:

#### A. Overview Cards

Display:

- Total Requests
- Successful Requests
- Failed Requests
- Active Backend Servers

#### B. Backend Server Status

Display three backend cards.

Each card should include:

- Server ID.
- Health status.
- Number of processed requests.
- Average response time.
- Healthy/unhealthy visual indicator.

#### C. Request Distribution

Show request counts for each backend.

Use a simple CSS bar chart or another lightweight visualization.

#### D. System Activity

Display recent request activity, including:

- Request number.
- Selected backend.
- Request status.
- Response time.

#### E. Refresh Behaviour

Fetch dashboard statistics from `/stats` and server information from `/servers`.

Refresh the dashboard automatically every 2–3 seconds.

Display a clear loading or error state if the API is temporarily unavailable.

Do not make the dashboard depend on mock data.

All displayed metrics must come from the actual running application.

---

## 9. Testing Requirements

Write automated tests using pytest and pytest-asyncio.

Test the important business logic independently of Docker.

### Unit Tests

#### Round Robin

- Select servers in sequential order.
- Skip unhealthy servers.
- Return None when no healthy servers exist.
- Correctly handle a changing healthy-server list.
- Handle concurrent selection safely.

#### Health Monitoring

- Mark a server healthy after a successful response.
- Mark a server unhealthy after a failed request.
- Detect recovery.
- Handle connection timeouts.

#### Statistics

- Increment total request counts.
- Increment successful request counts.
- Increment failed request counts.
- Track requests per backend.
- Calculate average response time.
- Exclude health-check requests from client statistics.

#### Load Balancer

- Forward requests successfully.
- Return HTTP 503 when all backends are unavailable.
- Handle backend timeouts.
- Update the appropriate statistics.

### Integration Tests

| Test ID | Scenario | Expected Result |
|---|---|---|
| TC-01 | Start all backend containers | All servers become healthy |
| TC-02 | Send 9 sequential requests | 3 requests per backend |
| TC-03 | Stop backend-2 | Health monitor detects failure |
| TC-04 | Send 6 additional requests | Only backend-1 and backend-3 receive requests |
| TC-05 | Restart backend-2 | Health monitor detects recovery |
| TC-06 | Stop all backend containers | Load balancer returns HTTP 503 |
| TC-07 | Open dashboard | Actual runtime statistics are displayed |

Ensure integration tests use actual Docker Compose services where appropriate.

---

## 10. Application Execution

### Requirements

The development environment requires:

- Python 3.12+
- Docker Engine
- Docker Compose plugin

### Start Application

```bash
docker compose up --build -d
```

### Check Containers

```bash
docker compose ps
```

### View Logs

```bash
docker compose logs -f
```

### Access Dashboard

```text
http://localhost:8000
```

### Access API Documentation

```text
http://localhost:8000/docs
```

### Send Requests

```bash
for i in {1..9}; do
    curl -s http://localhost:8000/proxy
    echo
done
```

### Simulate Backend Failure

```bash
docker compose stop backend-2
```

Wait for health monitoring to detect the failure.

Send more requests:

```bash
for i in {1..6}; do
    curl -s http://localhost:8000/proxy
    echo
done
```

Only healthy backend servers should receive requests.

### Recover Backend

```bash
docker compose start backend-2
```

Wait for the health monitor to detect recovery.

### Stop Application

```bash
docker compose down
```

---

## 11. Implementation Guidelines for the Coding Agent

Follow these guidelines throughout development.

### Code Quality

- Use Python type hints.
- Use asynchronous functions for network operations.
- Keep modules separated according to their responsibilities.
- Avoid unnecessary abstractions.
- Use descriptive variable and function names.
- Handle exceptions explicitly.
- Use Python logging instead of print statements.
- Avoid global mutable state where practical.
- Reuse a shared HTTPX AsyncClient instead of creating a new client for every request.
- Properly close HTTP clients during application shutdown.

### Architecture

- Keep the load balancer separate from backend application logic.
- Keep health monitoring separate from request routing.
- Keep statistics collection separate from business logic.
- Use dependency injection or shared application state where appropriate.
- Ensure concurrent requests cannot corrupt shared state.
- Ensure health-check operations do not block client requests.

### Error Handling

Handle:

- Backend connection refused.
- Backend request timeout.
- Invalid backend response.
- No healthy backend servers.
- Invalid server ID.
- Docker backend startup delays.

### Dashboard

- Keep the interface simple and responsive.
- Do not use mock statistics.
- Use actual API responses.
- Display meaningful error messages.
- Make backend health status visually distinguishable.

### Scope Control

Do not implement features outside the specified project scope.

Do not introduce additional infrastructure or dependencies without a clear requirement.

---

## 12. Acceptance Criteria

The project is considered complete only when all the following conditions are satisfied.

### Backend

- [ ] Three backend instances run independently.
- [ ] Each backend returns its unique server ID.
- [ ] All required backend endpoints work.

### Load Balancer

- [ ] Incoming requests are forwarded correctly.
- [ ] Round Robin distributes requests sequentially.
- [ ] Unhealthy servers are excluded.
- [ ] Concurrent request handling is safe.
- [ ] No healthy backends results in HTTP 503.

### Health Monitoring

- [ ] Backend health is checked periodically.
- [ ] Actual container failures are detected.
- [ ] Recovered backends are automatically included again.

### Statistics

- [ ] Request counts are accurate.
- [ ] Successful and failed requests are tracked.
- [ ] Backend response times are calculated.
- [ ] Health-check requests are excluded from client metrics.

### Docker

- [ ] All four services start using Docker Compose.
- [ ] All services communicate through the shared network.
- [ ] Only the load balancer is exposed to the host.
- [ ] Individual backend containers can be stopped and restarted.

### Dashboard

- [ ] Displays total requests.
- [ ] Displays successful and failed requests.
- [ ] Displays backend health.
- [ ] Displays request distribution.
- [ ] Displays response times.
- [ ] Refreshes automatically using real API data.

### Documentation and Testing

- [ ] Automated unit tests pass.
- [ ] Integration scenarios are verified.
- [ ] README includes setup and execution instructions.
- [ ] Project architecture is documented.
- [ ] No placeholder implementation remains.

---

## 13. Expected Final Deliverables

The coding agent must produce:

1. Complete Python application source code.
2. Three independent FastAPI backend instances.
3. Functional Round Robin load balancer.
4. Automatic health monitoring.
5. Failure detection and recovery.
6. In-memory statistics collector.
7. Responsive monitoring dashboard.
8. Dockerfile.
9. Docker Compose configuration.
10. Automated test suite.
11. Updated project README.
12. Instructions for running and testing the application.

---

## 14. Final Instructions to the Coding Agent

Treat this README as the primary implementation specification.

Before writing code:

1. Understand the complete architecture.
2. Inspect the existing repository, if one exists.
3. Identify missing files and components.
4. Follow the specified directory structure unless the repository already has a sensible equivalent.

During implementation:

1. Implement the backend server first.
2. Implement Round Robin scheduling.
3. Implement HTTP request forwarding.
4. Implement health monitoring.
5. Implement statistics collection.
6. Integrate the modules into the FastAPI application.
7. Implement the monitoring dashboard.
8. Configure Docker and Docker Compose.
9. Write and execute automated tests.

After implementation:

1. Build the Docker image.
2. Start all services using Docker Compose.
3. Verify that all three backends become healthy.
4. Verify sequential request distribution.
5. Stop an individual backend and verify failure detection.
6. Verify that requests continue through healthy backends.
7. Restart the failed backend and verify recovery.
8. Verify that the dashboard displays actual runtime statistics.
9. Fix any errors discovered during testing.

**Important:** Do not merely generate code that looks correct. Run the application, verify the actual behaviour and fix implementation issues before declaring the project complete.

Prioritize correctness, simplicity, readability and a reliable demonstration over unnecessary features.

The final application must be runnable with a single command:

```bash
docker compose up --build -d
```

And accessible at:

```text
http://localhost:8000
```
