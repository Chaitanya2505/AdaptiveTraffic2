# E-Rakshak FastAPI Backend

The FastAPI backend for **E-Rakshak**, a data-driven traffic optimization and adaptive infrastructure system. This API powers real-time traffic density sensing simulation, signal light cycle optimization logging, BRTS corridor lane-discipline violation logs, and secure user management.

## Tech Stack
- **Framework:** FastAPI
- **Python Version:** 3.11+ (Fully tested on Python 3.13)
- **Database:** Neon DB / PostgreSQL (exclusive)
- **ORM:** SQLAlchemy 2.0 (Async mode with `asyncpg`)
- **Authentication:** JWT with `python-jose`
- **Password Hashing:** `bcrypt` (direct integration, bypassing `passlib` warnings on newer Python versions)
- **Testing:** `pytest` + `httpx` (using an in-memory SQLite database via `aiosqlite` for isolated offline tests)

---

## File Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app setup with lifespan context
│   ├── config.py            # Settings configuration class (pydantic-settings)
│   ├── database.py          # SQLAlchemy async engine, sessionmaker, and Base
│   ├── models/              # Database models (Junction, Detection, Signal, Violation, User)
│   ├── schemas/             # Pydantic validation schemas
│   ├── routers/             # API routing endpoints (auth, junctions, vision, signals, violations)
│   ├── services/            # Simulated AI services (vision, signal optimization)
│   └── utils/               # Shared dependencies and helper utilities
├── tests/
│   └── test_main.py         # Full integration tests for the API routes
├── .env.example             # Configuration settings template
├── requirements.txt         # Package dependencies
└── README.md                # This file
```

---

## Getting Started

### 1. Prerequisites
Ensure you have Python 3.11 or newer installed.

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the `backend` folder:
```bash
cp .env.example .env
```
Open `.env` and set your Neon DB / PostgreSQL connection string:
```ini
# Neon DB Connection String (with sslmode required)
DATABASE_URL=postgresql+asyncpg://<username>:<password>@<ep-host-name>.region.aws.neon.tech/neondb?sslmode=require

# Secure JWT signing key
SECRET_KEY=supersecretkeyreplaceinproduction1234567890
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Allowed Frontend Origins (CORS)
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000
```

### 3. Install Dependencies
Create a virtual environment and install the required Python packages:

```bash
# Windows
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# macOS/Linux
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Run the Application
Start the development server:
```bash
uvicorn app.main:app --reload --port 8000
```
- The backend automatically initializes Neon DB tables and seeds dummy data if the database is empty.
- Access the interactive API Documentation at: **[http://localhost:8000/docs](http://localhost:8000/docs)**
- Access the ReDoc Documentation at: **[http://localhost:8000/redoc](http://localhost:8000/redoc)**

---

## Seeded Testing Credentials

Upon database initialization, two accounts are seeded automatically for testing:

| Username | Password | Role |
|----------|----------|------|
| `admin` | `adminpassword` | `admin` |
| `operator` | `operatorpassword` | `operator` |

---

## API Router Endpoints

### 1. Authentication
- `POST /auth/register` - Register a new operator, analyst, or admin.
- `POST /auth/login` - Exchange username and password for a JWT token (accepts JSON).
- `GET /auth/me` - Retrieve current user profile (requires Bearer token).

### 2. Traffic Junctions
- `GET /junctions` - Retrieve all registered traffic junctions.
- `GET /junctions/{id}` - Get details of a specific junction.
- `POST /junctions` - Register a new junction (Requires Admin/Operator role).
- `GET /junctions/{id}/status` - Live aggregated status: lane queues, active signal phase, density statistics, and recent active violations.

### 3. Computer Vision Simulation
- `POST /vision/detect` - Upload a camera frame and get simulated YOLOv11 vehicle detections, lane queue length estimations, and automatic BRTS violation logs.
- `POST /vision/track` - Simulated DeepSORT tracking statistics.

### 4. Signal Optimization
- `POST /signals/optimize` - Dynamically optimize a junction's signal cycles ( Webster / RL approach) based on recent database detection history.
- `POST /signals/{junction_id}/apply` - Manually override the green cycle (Requires Admin/Operator role).
- `GET /signals/{junction_id}/history` - Retrieve historical signal timing logs.

### 5. Traffic Violations
- `GET /violations` - Retrieve logged violations (supports filtering by `junction_id` and `status`).
- `GET /violations/{id}` - Retrieve details of a specific violation.
- `POST /violations/{id}/ack` - Acknowledge a violation (Requires Admin/Operator role).

---

## Running Tests

Unit and integration tests run on an isolated in-memory SQLite database (`sqlite+aiosqlite:///:memory:`). This allows you to verify code correctness completely offline:

```bash
python -m pytest tests/test_main.py -v
```
