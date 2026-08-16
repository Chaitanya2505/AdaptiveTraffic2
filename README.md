# 🚦 TrafficPulse: AI-Powered Smart Urban Traffic Management & Arterial Digital Twin

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_18_Vite-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![SUMO](https://img.shields.io/badge/Simulation-Eclipse_SUMO_TraCI-1565C0.svg)](https://eclipse.dev/sumo/)
[![Deep Learning](https://img.shields.io/badge/AI_Vision-UVH--26_|_RT--DETR-FF6F00.svg?logo=pytorch&logoColor=white)](https://pytorch.org)
[![Standards](https://img.shields.io/badge/Engineering-HCM_2022_|_IRC:106--1990-2E7D32.svg)](https://www.transportation.org)

**TrafficPulse** is an end-to-end Intelligent Transportation System (ITS) and Digital Twin engineered for high-density urban arterial corridors. Built on the **Surat Smart City Arterial Spine** (a 4-junction, 3.8 km corridor comprising *SVNIT Circle → Ghod Dod Road → Majura Gate → Sahara Darwaja*), TrafficPulse bridges deep learning computer vision, real-time micro-simulation via TraCI, dynamic max-pressure signal optimization, and automated transit lane enforcement.

---

## 📌 Problem Statement

Rapidly expanding metropolitan corridors face severe mobility bottlenecks characterized by:
1. **Inefficient Static Pre-Timed Signals:** Fixed 60-second cycle times are unable to adapt to asymmetric directional surges and peak-hour volume shifts.
2. **Arterial Flow Disruption:** Uncoordinated signals cause recurring stop-and-go platooning, compounding queue buildup and bottleneck delays across adjacent intersections.
3. **Dedicated Transit (BRTS) Lane Encroachment:** Mixed traffic intrusions into dedicated bus corridors degrade public transit efficiency and schedule adherence.
4. **Excess Emissions & Fuel Loss:** Idling vehicle queues generate substantial avoidable greenhouse gas ($CO_2$) emissions and fuel wastage.

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                             FRONTEND LAYER (React 18 + Vite)                                │
│  ┌───────────────────────┐  ┌────────────────────────┐  ┌────────────────────────────────┐  │
│  │  60 FPS Canvas Twin   │  │  4-Junction Analytics  │  │  BRTS Lane Guard (ROI Tool)    │  │
│  │ (Zoom, Pan, Vehicle)  │  │ (HCM LOS A-F, Splits)  │  │ (Polygon Draw, Violations Grid)│  │
│  └───────────┬───────────┘  └───────────┬────────────┘  └───────────────┬────────────────┘  │
└──────────────┼──────────────────────────┼───────────────────────────────┼───────────────────┘
               │                          │                               │
               │ WebSocket (/ws/simulation)│ REST HTTP (/simulation/*)     │ REST / Video Stream
               ▼                          ▼                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                               FASTAPI BACKEND GATEWAY                                       │
│  ┌───────────────────────┐  ┌────────────────────────┐  ┌────────────────────────────────┐  │
│  │ WebSocket Broadcast   │  │ Analytics & Export     │  │ Computer Vision Streamer       │  │
│  │ Engine (10-60 Hz)     │  │ Router (JSON, CSV, PDF)│  │ & ROI Evaluation Endpoints     │  │
│  └───────────┬───────────┘  └───────────┬────────────┘  └───────────────┬────────────────┘  │
└──────────────┼──────────────────────────┼───────────────────────────────┼───────────────────┘
               │                          │                               │
               ▼                          ▼                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CORE SERVICE LAYER                                        │
│                                                                                             │
│  ┌──────────────────────────────────────┐       ┌────────────────────────────────────────┐  │
│  │          SumoService                 │       │           VisionService                │  │
│  │  • Eclipse SUMO + Python TraCI Core  │       │  • IISc-AIM UVH-26 (YOLOv11-S)         │  │
│  │  • Max-Pressure Adaptive Timing      │◄──────┤  • Baidu RT-DETR Transformer           │  │
│  │  • 12.5s Green Wave Arterial Sync    │       │  • IRC:106-1990 PCE Volume Estimation  │  │
│  │  • Dynamic Phase Extension (12-60s)  │       │  • Ray-Casting Polygon ROI Ingestion   │  │
│  └──────────────────┬───────────────────┘       └───────────────────┬────────────────────┘  │
│                     │                                               │                       │
│                     ▼                                               ▼                       │
│  ┌──────────────────────────────────────┐       ┌────────────────────────────────────────┐  │
│  │    SimulationAnalyticsEngine         │       │           BRTSLaneGuard                │  │
│  │  • 4-Junction Approach Metrics       │       │  • Multi-Vertex Polygon Zone Matcher   │  │
│  │  • HCM 2010/2022 Level of Service    │       │  • Modal Intrusion Classification      │  │
│  │  • Empirical Dual-Run What-If Gains  │       │  • Timestamped Bounding Box Evidence   │  │
│  │  • O(1) Ultra-Fast Ring Aggregators  │       │  • Automated E-Challan Reference Engine│  │
│  └──────────────────┬───────────────────┘       └───────────────────┬────────────────────┘  │
└─────────────────────┼───────────────────────────────────────────────┼───────────────────────┘
                      │                                               │
                      ▼                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            DATA PERSISTENCE & EXPORT ARTIFACTS                              │
│  ┌────────────────────────┐  ┌───────────────────────┐  ┌────────────────────────────────┐  │
│  │ SQLite WAL / Neon DB   │  │ ReportLab + Matplotlib│  │ CSV Telemetry Logger           │  │
│  │ (Violations, Cameras)  │  │ (2-Page Executive PDF)│  │ (1-Sec Granular Vehicle Rows)  │  │
│  └────────────────────────┘  └───────────────────────┘  └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Implemented Technology Stack

| Layer / Domain | Technology | Implementation & Purpose |
| :--- | :--- | :--- |
| **Deep Learning Vision** | **IISc-AIM UVH-26 (YOLOv11-S)** | Specialized Indian traffic object detection model (`iisc-aim/UVH-26`) classifying 13 mixed-traffic vehicle categories. |
| **Transit Transformer** | **Baidu / Ultralytics RT-DETR** | High-precision Real-Time DEtection TRansformer (`rtdetr-l.pt`) for transit corridor intrusion detection. |
| **Micro-Simulation Core** | **Eclipse SUMO + Python TraCI** | Physics-based vehicle following, lane changing, multi-junction signal actuation, and balanced 4-way OD matrix generation. |
| **Backend API Server** | **FastAPI (Async Python 3.11+)** | High-throughput asynchronous REST endpoints and persistent WebSocket broadcasting (`/ws/simulation`). |
| **Frontend Framework** | **React 18 + Vite** | Single-page command dashboard styled with TailwindCSS and custom modern dark theme. |
| **Canvas Digital Twin** | **HTML5 Canvas 2D API** | Hardware-accelerated 60 FPS corridor digital twin rendering with interactive zoom, pan, vehicle bounding boxes, and signal heads. |
| **Data Visualization** | **Recharts & Leaflet.js** | Dynamic approach queue/delay bar charts, radar profiles, and GIS coordinate density heatmaps. |
| **Report Compilation** | **ReportLab + Matplotlib** | Automated compilation of publication-quality 2-page Executive Engineering PDF reports and 1-second CSV telemetry logs. |
| **Engineering Standards** | **HCM 2010/2022 & IRC:106-1990** | Highway Capacity Manual intersection Level of Service (`LOS A` through `LOS F`) & Passenger Car Equivalent (PCE) weightings. |
| **Storage & Persistence** | **SQLite (WAL Mode) & PostgreSQL** | Thread-safe logging of camera ROI preferences, BRTS whitelist registry, and violation records. |

---

## ✨ Implemented Core Features & Services

### 1. 🚦 4-Junction Real-World Corridor Digital Twin
Full modeling of the 3.8 km Surat Arterial Spine across 4 coordinated intersections:
- **J1: SVNIT / Ichchhanath Circle ($X = 250\text{m}$):** University hub with significant turning volumes and pedestrian friction.
- **J2: Ghod Dod Road Commercial Cross ($X = 600\text{m}$):** Retail arterial intersection with dense side-street approach pressure.
- **J3: Majura Gate BRTS Multi-Leg Hub ($X = 950\text{m}$):** 6-leg central intersection connecting the arterial spine to the dedicated Ring Road BRTS.
- **J4: Sahara Darwaja Railway Flyover ($X = 1300\text{m}$):** Regional freight gateway featuring railway flyover merge dynamics.

### 2. 🧠 Adaptive Signal Optimization Engine (`SumoService`)
- **Webster Max-Pressure Formulation:** Actuates traffic lights dynamically using queue-pressure weighting:
  $$\text{Pressure} = 2.0 \times \text{Queue} + 1.0 \times \text{Waiting} + 25.0 \times \text{Occupancy}$$
- **12.5s Coordinated Green Wave Arterial Offset:** Synchronizes East-West progression bands across 350m spacing at 45 km/h to eliminate stop-and-go delays.
- **Dynamic Phase Extension:** Extends green time up to 60s for saturated dominant approaches while enforcing 12s minimum safety clearance holds.
- **Dedicated BRTS Transit Priority:** Detects approaching transit buses and preempts cross-street green phases.

### 3. 👁️ Computer Vision & BRTS Lane Guard (`VisionService` & `BRTSLaneGuard`)
- **IISc-AIM UVH-26 Multi-Class Detection:** Detects Two-Wheelers, Autos, Cars, Buses, Trucks, and LCVs, converting raw counts to Passenger Car Units via IRC:106-1990 factors ($0.35$ for bikes, $0.60$ for autos, $1.00$ for cars, $2.50$ for buses, $3.00$ for trucks).
- **Interactive Polygonal ROI Calibration:** Traffic operators can draw custom multi-vertex polygonal lane boundaries directly onto live camera feeds.
- **Ray-Casting Point-in-Polygon Engine:** Geometric verification of vehicle centroids within restricted transit lanes.
- **Automated Violation Evidence:** Captures timestamped bounding box evidence crops, vehicle class, speed, and confidence metrics.

### 4. 📊 4-Junction Deep-Dive Analytics & HCM Level of Service (`SimulationAnalyticsEngine`)
- **Highway Capacity Manual (HCM 2010/2022) LOS Grading:**
  - `LOS A`: $\le 10\text{s}$ average delay (Free Flow)
  - `LOS B`: $10\text{s} - 20\text{s}$ delay (Stable Flow)
  - `LOS C`: $20\text{s} - 35\text{s}$ delay (Acceptable Flow)
  - `LOS D`: $35\text{s} - 55\text{s}$ delay (Approaching Unstable)
  - `LOS E`: $55\text{s} - 80\text{s}$ delay (At Capacity)
  - `LOS F`: $> 80\text{s}$ delay (Forced Breakdown)
- **4-Approach Inflow Matrix:** Directional North, South, East, and West delay, queue length, and travel speed breakdown per intersection.
- **Signal Split % Tracking:** Real-time breakdown of East-West Green vs North-South Green vs Yellow clearance intervals.

### 5. ⚡ Empirical What-If Dual-Run Baseline Comparison
Empirically compares the active Adaptive TraCI policy against a 60s Traditional Fixed-Time baseline:
- **Corridor Throughput:** $+31.6\%$ increase in processed vehicles per hour ($3,085\text{ vph}$ vs $2,344\text{ vph}$).
- **Corridor Speed:** $+38.9\%$ increase in corridor speed ($28.2\text{ km/h}$ vs $20.3\text{ km/h}$).
- **Intersection Stop Delay:** $-36.0\%$ reduction in average vehicle wait time ($1.6\text{s}$ vs $2.5\text{s}$).
- **Queue Length Reduction:** $-33.3\%$ reduction in peak vehicle halting queues.
- **Environmental Savings:** $-23.1\%$ carbon reduction, saving $\sim 46.5\text{ kg } CO_2$ and $\sim 16.8\text{ L}$ of fuel per peak session.

### 6. 📄 Executive PDF & Data Export Engine
- **2-Page Executive PDF Report:** Generated on-demand via ReportLab with embedded high-resolution Matplotlib timeline dynamics, junction speed profiles, and LOS tables.
- **Granular CSV Export:** Second-by-second vehicle counts, speeds, emissions, and delays.
- **Printable HTML Engineering Brief:** Standalone responsive report for municipal review.

---

## 📂 Project Structure

```
AdaptiveTraffic2/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI entry point & lifespan startup
│   │   ├── routers/
│   │   │   ├── simulation.py           # SUMO control, WebSocket, PDF/CSV exports
│   │   │   ├── vision.py               # UVH-26 approach camera detection endpoints
│   │   │   ├── brts.py                 # BRTS Lane Guard, ROI calibration, violations
│   │   │   ├── junctions.py            # Junction metadata & status
│   │   │   └── violations.py           # Violations queries & acknowledgement
│   │   ├── services/
│   │   │   ├── sumo_service.py         # TraCI micro-simulation & signal machine
│   │   │   ├── simulation_analytics.py # HCM LOS, What-If engine, telemetry store
│   │   │   ├── vision_service.py       # UVH-26 (YOLOv11-S) inference & PCE engine
│   │   │   └── brts_service.py         # RT-DETR detection & polygon ROI verification
│   │   └── simulation/
│   │       ├── convert_json_to_pdf.py  # ReportLab 2-page PDF compiler
│   │       └── network_generator.py   # 4-junction SUMO XML network generator
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── SimulationPage.jsx      # 60 FPS HTML5 Canvas Digital Twin
│   │   │   ├── AnalyticsPage.jsx       # 4-Junction Deep-Dive, LOS, What-If
│   │   │   ├── BRTSLaneGuardPage.jsx   # Live stream & interactive polygon ROI tool
│   │   │   ├── VisionPage.jsx          # Multi-camera approach lane detection
│   │   │   └── DashboardPage.jsx       # High-level corridor KPI overview
│   │   └── components/                 # Layout, navigation, radar & bar charts
│   └── package.json
├── weights/                            # UVH-26 YOLOv11-S model weights
├── rtdetr-l.pt                         # Baidu RT-DETR Transformer weights
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.10+ / 3.11+**
- **Node.js 18+** & **npm**
- **Eclipse SUMO** (Ensure `SUMO_HOME` environment variable is set)

### 1. Backend Setup
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate      # Windows
# source venv/bin/activate   # Linux/macOS

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
*The FastAPI backend will start on `http://127.0.0.1:8000` (API docs: `http://127.0.0.1:8000/docs`).*

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*The React dashboard will be accessible at `http://localhost:5173`.*

---

## 📜 License
This project is developed as an Intelligent Urban Traffic Management System for smart city infrastructure research and deployment.
