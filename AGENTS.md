# Agent Instructions

## Virtual Environment & Dependencies
- Always use virtual environment: `python3 -m venv .venv && source .venv/bin/activate`
- Install dependencies: `pip install -r requirements.txt`

## Canonical & File-Scoped Commands
| Task | Command |
|------|---------|
| Run Load Balancer | `uvicorn app.main:app --host 0.0.0.0 --port 8000` |
| Run Backend Node | `SERVER_ID=server-1 uvicorn servers.backend:app --port 8001` |
| Run Full Stack | `docker compose up --build -d` |
| Stop Stack | `docker compose down` |
| Run All Tests | `pytest` |
| Run Single Test | `pytest tests/test_round_robin.py -k <test_name>` |

## Commit Conventions
- Use **Conventional Commits**: `<type>(<scope>): <short description>`
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`
- Example: `docs(plan): set current directory as project root`

## Core Rules & Constraints
- **Imports**: All imports MUST strictly be at the very top of each file. No inline imports unless required by circular dependencies.
- **Environment**: Never inspect, read, or print `.env` files without explicit user consent.
- **Artifacts**: Clean up all temporary test artifacts after testing or task completion.
- **Migrations**: Always specify explicit constraint names for all database constraints and migrations.
