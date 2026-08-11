# E-Rakshak Backend Architecture 

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React.js)                       │
│              Dashboard | Maps | Charts | Controls            │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/WebSocket
┌────────────────────────▼────────────────────────────────────┐
│                   FASTAPI BACKEND                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  REST API   │  │ WebSocket   │  │  CORS/Auth  │        │
│  │  Endpoints  │  │  Gateway    │  │  (JWT)      │        │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘        │
│         │                  │                                │
│  ┌──────▼──────────────────▼──────────────────────┐        │
│  │              SERVICE LAYER                       │        │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐│        │
│  │  │ Vision  │ │ Signal  │ │ Predict │ │ Analytics│        │
│  │  │ Service │ │ Service │ │ Service │ │ Service │        │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬───┘│        │
│  └───────┼───────────┼───────────┼───────────┼────┘        │
│          │           │           │           │               │
│  ┌───────▼───────────▼───────────▼───────────▼──────────┐  │
│  │              DATA LAYER (Neon DB / PostgreSQL)        │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │  │
│  │  │ Junction│ │ Detection│ │ Signal  │ │ Violation│       │  │
│  │  │  Data   │ │  Data   │ │  Data   │ │  Data   │       │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack (Minimal)

| Layer | Technology | Why |
|-------|-----------|-----|
| API Framework | **FastAPI** | Async, auto-docs, Python-native |
| Database | **Neon DB (PostgreSQL)** | Cloud-native serverless Postgres |
| ORM | **SQLAlchemy (asyncpg)** | Modern async database abstraction |
| WebSocket | **FastAPI native** | Built-in, no extra deps |
| Auth | **JWT (python-jose)** | Stateless, simple |
| ML | **PyTorch + Ultralytics** | YOLOv11, DeepSORT |
| Simulation | **SUMO + TraCI** | Traffic simulation |
| RL | **Stable-Baselines3** | PPO/DQN agents |
| Deployment | **Docker + Docker Compose** | Single command startup |

---

## 3. Project Structure

```
erakshak-backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry point
│   ├── config.py               # Settings & env vars
│   ├── database.py             # SQLAlchemy setup
│   ├── models/                 # Database models
│   │   ├── __init__.py
│   │   ├── junction.py         # Junction table
│   │   ├── detection.py        # Vehicle detection logs
│   │   ├── signal.py           # Signal timing logs
│   │   ├── violation.py        # BRTS violations
│   │   └── user.py             # Auth users
│   ├── schemas/                # Pydantic models (API request/response)
│   │   ├── __init__.py
│   │   ├── junction.py
│   │   ├── detection.py
│   │   ├── signal.py
│   │   ├── violation.py
│   │   └── prediction.py
│   ├── routers/                # API endpoints
│   │   ├── __init__.py
│   │   ├── junctions.py          # GET /junctions, /junctions/{id}
│   │   ├── vision.py             # POST /detect, /track
│   │   ├── signals.py            # POST /optimize, GET /status
│   │   ├── violations.py         # GET /violations, POST /acknowledge
│   │   ├── predictions.py        # GET /predict/congestion
│   │   ├── analytics.py          # GET /heatmap, /trends
│   │   └── auth.py               # POST /login, /register
│   ├── services/               # Business logic
│   │   ├── __init__.py
│   │   ├── vision_service.py     # YOLO + DeepSORT
│   │   ├── signal_service.py     # RL + Webster
│   │   ├── prediction_service.py # LSTM + GNN
│   │   ├── analytics_service.py  # DBSCAN + heatmaps
│   │   └── alert_service.py      # Notifications
│   ├── ml_models/              # ML model files
│   │   ├── yolov11n/           # YOLO model weights
│   │   ├── deepsort/           # DeepSORT checkpoint
│   │   ├── ppo_agent/          # RL agent weights
│   │   ├── lstm/               # LSTM prediction model
│   │   └── stgcn/              # GNN prediction model
│   ├── utils/                  # Helpers
│   │   ├── __init__.py
│   │   ├── image_processing.py
│   │   ├── queue_estimator.py
│   │   ├── brts_detector.py
│   │   └── geo_utils.py
│   └── dummy_data/             # Seed data for demo
│       ├── junctions.json
│       ├── detections.json
│       ├── signals.json
│       └── violations.json
├── tests/                      # Pytest tests
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── requirements.txt
├── README.md
└── .env.example
```

---

## 4. Database Schema (SQLite Starter)

```sql
-- Junctions table
CREATE TABLE junctions (
    id TEXT PRIMARY KEY,           -- J-001, J-002, etc.
    name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    num_lanes INTEGER DEFAULT 4,
    has_brts BOOLEAN DEFAULT 0,
    status TEXT DEFAULT 'active',  -- active, maintenance, offline
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vehicle detections
CREATE TABLE detections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    junction_id TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    vehicle_class TEXT,            -- car, bus, auto, truck, 2-wheeler
    confidence REAL,
    bbox_x1 REAL, bbox_y1 REAL, bbox_x2 REAL, bbox_y2 REAL,
    track_id INTEGER,
    lane_id TEXT,                  -- L1, L2, L3, L4
    speed_kmh REAL,
    is_stopped BOOLEAN DEFAULT 0
);

-- Queue lengths (per lane, per junction, per time)
CREATE TABLE queue_lengths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    junction_id TEXT NOT NULL,
    lane_id TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    vehicle_count INTEGER,
    queue_meters REAL,
    avg_wait_seconds REAL
);

-- Signal timing logs
CREATE TABLE signal_phases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    junction_id TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    phase TEXT,                    -- NS_GREEN, EW_GREEN, NS_LEFT, ALL_RED
    duration INTEGER,              -- seconds
    mode TEXT,                     -- RL, WEBSTER, MANUAL, EVENT
    confidence REAL,
    triggered_by TEXT              -- auto, operator, system
);

-- BRTS violations
CREATE TABLE violations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    junction_id TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    vehicle_class TEXT,
    license_plate TEXT,
    plate_confidence REAL,
    image_path TEXT,               -- local path or URL
    status TEXT DEFAULT 'active',  -- active, acknowledged, resolved
    fine_amount REAL DEFAULT 0
);

-- Predictions (congestion forecasts)
CREATE TABLE predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    junction_id TEXT NOT NULL,
    predicted_for TIMESTAMP,       -- future timestamp
    predicted_level TEXT,          -- low, moderate, high, critical
    confidence REAL,
    actual_level TEXT,             -- filled later for validation
    accuracy REAL                  -- MAPE or similar
);

-- Users (simple auth)
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'operator',  -- admin, operator, analyst
    is_active BOOLEAN DEFAULT 1
);
```

---

## 5. API Endpoints (Core)

### 5.1 Junctions
```
GET  /api/junctions              → List all junctions
GET  /api/junctions/{id}         → Get junction details
GET  /api/junctions/{id}/status  → Live status (queue, signal, density)
```

### 5.2 Vision
```
POST /api/vision/detect          → Upload image, get detections
POST /api/vision/track           → Upload frame, get tracks + queues
POST /api/vision/brts/check      → Check BRTS violation in frame
```

### 5.3 Signals
```
POST /api/signals/optimize       → Get optimal signal timing
POST /api/signals/apply          → Apply signal timing (manual override)
GET  /api/signals/{id}/history    → Signal history for junction
```

### 5.4 Violations
```
GET  /api/violations             → List violations (filter by status, date)
GET  /api/violations/{id}        → Get violation details + evidence
POST /api/violations/{id}/ack    → Acknowledge violation
```

### 5.5 Predictions
```
GET  /api/predictions/congestion/{junction_id}?horizon=30
                                 → Predict congestion 30 min ahead
GET  /api/predictions/bottlenecks → Predict city-wide bottlenecks
```

### 5.6 Analytics
```
GET  /api/analytics/heatmap?start=...&end=...
                                 → Get heatmap data
GET  /api/analytics/trends/{junction_id}?days=30
                                 → Get trend analysis
GET  /api/analytics/recommendations/{junction_id}
                                 → Get engineering recommendations
```

### 5.7 Auth
```
POST /api/auth/login             → Login, get JWT token
POST /api/auth/register          → Register new user
GET  /api/auth/me                → Get current user
```

### 5.8 WebSocket
```
WS   /ws/live                    → Real-time updates
  Subscribe: {"action": "subscribe", "junctions": ["J-001", "J-002"]}
  Events: vehicle.detected, signal.changed, violation.alert, prediction.update
```

---

## 6. Dummy Data Flow (Simple Example)

### Scenario: Camera at J-001 detects vehicles

```
STEP 1: Frontend uploads image
POST /api/vision/detect
  Body: {image: <base64>, junction_id: "J-001"}

STEP 2: Vision Service processes
  → YOLOv11 detects: 3 cars, 1 bus, 2 autos
  → DeepSORT assigns track IDs
  → Queue estimator: L1=2 cars (10m), L2=1 bus (12m)
  → BRTS check: No violations

STEP 3: Save to database
  INSERT INTO detections (junction_id, vehicle_class, confidence, ...)
  INSERT INTO queue_lengths (junction_id, lane_id, vehicle_count, queue_meters)

STEP 4: Return response
{
  "junction_id": "J-001",
  "timestamp": "2026-07-07T14:30:00Z",
  "detections": [
    {"class": "car", "confidence": 0.95, "bbox": [10,20,100,80], "track_id": 1, "lane": "L1"},
    {"class": "car", "confidence": 0.92, "bbox": [110,20,200,80], "track_id": 2, "lane": "L1"},
    {"class": "bus", "confidence": 0.88, "bbox": [50,100,150,200], "track_id": 3, "lane": "L2"}
  ],
  "queue_lengths": {
    "L1": {"vehicles": 2, "meters": 10},
    "L2": {"vehicles": 1, "meters": 12}
  },
  "violations": []
}

STEP 5: Frontend updates dashboard
  → Map shows J-001 with 3 vehicles
  → Queue bar: L1=10m, L2=12m
  → No alerts

STEP 6: Signal optimization (every 30 seconds)
POST /api/signals/optimize
  Body: {junction_id: "J-001", mode: "RL"}

  → RL agent reads queue_lengths table
  → Computes: extend NS_GREEN by 10 seconds
  → Saves to signal_phases table
  → Returns: {phase: "NS_GREEN", duration: 55, mode: "RL"}

STEP 7: Frontend shows signal status
  → Signal icon: Green (NS), 55 seconds remaining
  → Mode badge: "AI Optimized"
```

---

## 7. Dummy Data (JSON)

### 7.1 Junctions
```json
[
  {"id": "J-001", "name": "Ring Road × BRTS", "latitude": 21.1702, "longitude": 72.8311, "num_lanes": 4, "has_brts": true},
  {"id": "J-002", "name": "Ghod Dod Road", "latitude": 21.1750, "longitude": 72.8350, "num_lanes": 4, "has_brts": false},
  {"id": "J-003", "name": "City Light Junction", "latitude": 21.1650, "longitude": 72.8250, "num_lanes": 6, "has_brts": true}
]
```

### 7.2 Sample Detections (for seeding)
```json
[
  {"junction_id": "J-001", "vehicle_class": "car", "confidence": 0.95, "lane_id": "L1", "is_stopped": true},
  {"junction_id": "J-001", "vehicle_class": "car", "confidence": 0.92, "lane_id": "L1", "is_stopped": true},
  {"junction_id": "J-001", "vehicle_class": "bus", "confidence": 0.88, "lane_id": "L2", "is_stopped": false},
  {"junction_id": "J-001", "vehicle_class": "auto", "confidence": 0.85, "lane_id": "L3", "is_stopped": true}
]
```

### 7.3 Sample Signal History
```json
[
  {"junction_id": "J-001", "phase": "NS_GREEN", "duration": 45, "mode": "RL", "confidence": 0.87},
  {"junction_id": "J-001", "phase": "EW_GREEN", "duration": 35, "mode": "RL", "confidence": 0.82},
  {"junction_id": "J-002", "phase": "NS_GREEN", "duration": 40, "mode": "WEBSTER", "confidence": 0.75}
]
```

### 7.4 Sample Violations
```json
[
  {
    "junction_id": "J-001",
    "vehicle_class": "car",
    "license_plate": "GJ-05-AB-1234",
    "plate_confidence": 0.87,
    "status": "active",
    "fine_amount": 5000
  }
]
```

---

## 8. Quick Start Commands

```bash
# 1. Clone repo
git clone https://github.com/yourteam/erakshak-backend.git
cd erakshak-backend

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Setup database (SQLite auto-creates)
python -c "from app.database import init_db; init_db()"

# 5. Seed dummy data
python -c "from app.dummy_data import seed; seed()"

# 6. Run server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 7. Open API docs
# http://localhost:8000/docs (Swagger UI)
# http://localhost:8000/redoc (ReDoc)

# Docker (alternative)
docker-compose up --build
```

---

## 9. Requirements.txt

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy==2.0.35
pydantic==2.9.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
ultralytics==8.3.0
torch==2.4.0
opencv-python==4.10.0
numpy==1.26.4
pillow==10.4.0
scikit-learn==1.5.0
pandas==2.2.2
matplotlib==3.9.0
seaborn==0.13.2
requests==2.32.0
websockets==12.0
python-dotenv==1.0.0
pytest==8.3.0
httpx==0.27.0
```
