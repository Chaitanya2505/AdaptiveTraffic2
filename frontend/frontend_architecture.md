# E-Rakshak Frontend Architecture (Starter Version)
## Simplified React Dashboard for Hackathon Implementation

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   REACT 18 + VITE APP                        │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Pages     │  │  Components │  │   Hooks     │        │
│  │             │  │             │  │             │        │
│  │ Dashboard   │  │ Map         │  │ useApi      │        │
│  │ Vision      │  │ Charts      │  │ useWebSocket│        │
│  │ Signals     │  │ Tables      │  │ useAuth     │        │
│  │ Analytics   │  │ Forms       │  │ useRealtime │        │
│  │ Settings    │  │ Cards       │  │ useMap      │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Services  │  │   Store     │  │   Utils     │        │
│  │             │  │  (Zustand)  │  │             │        │
│  │ api.js      │  │             │  │ constants   │        │
│  │ websocket.js│  │ authStore   │  │ formatters  │        │
│  │ auth.js     │  │ dataStore   │  │ validators  │        │
│  │ maps.js     │  │ uiStore     │  │ helpers     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              EXTERNAL LIBRARIES                        │  │
│  │  Leaflet (Maps) | Recharts (Charts) | Axios (HTTP)   │  │
│  │  Tailwind CSS | Lucide Icons | Date-fns | Zustand     │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              BACKEND API (FastAPI)                   │  │
│  │  HTTP REST API + WebSocket /ws/live                  │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack (Minimal)

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| Framework | React | 18.3+ | Component-based, huge ecosystem |
| Build Tool | Vite | 5.4+ | Fast dev server, optimized builds |
| Styling | Tailwind CSS | 3.4+ | Utility-first, rapid UI development |
| State Management | Zustand | 4.5+ | Simple, no boilerplate vs Redux |
| Maps | Leaflet.js | 1.9+ | Open-source, free, lightweight |
| Charts | Recharts | 2.12+ | React-native, declarative |
| HTTP Client | Axios | 1.7+ | Interceptors, request/response config |
| Icons | Lucide React | 0.400+ | Modern, consistent icon set |
| Date Utils | date-fns | 3.6+ | Modular, tree-shakeable |
| Forms | React Hook Form | 7.52+ | Performance, validation |
| Tables | TanStack Table | 8.19+ | Headless, powerful |

---

## 3. Project Structure

```
erakshak-frontend/
├── public/
│   ├── favicon.ico
│   └── logo.png
├── src/
│   ├── main.jsx                    # Entry point
│   ├── App.jsx                     # Root component + routing
│   ├── index.css                   # Global styles + Tailwind
│   │
│   ├── pages/                      # Page-level components
│   │   ├── Dashboard.jsx           # Main command center
│   │   ├── VisionPage.jsx          # Camera feeds + detection overlay
│   │   ├── SignalsPage.jsx         # Signal control panel
│   │   ├── ViolationsPage.jsx      # BRTS violation list
│   │   ├── AnalyticsPage.jsx       # Heat maps + trends
│   │   ├── PredictionsPage.jsx     # Congestion forecasts
│   │   ├── SimulationPage.jsx      # What-if simulator
│   │   ├── SettingsPage.jsx        # System config
│   │   └── LoginPage.jsx           # Authentication
│   │
│   ├── components/                 # Reusable UI components
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx         # Navigation sidebar
│   │   │   ├── TopBar.jsx          # Header with KPIs
│   │   │   ├── Layout.jsx          # Page wrapper
│   │   │   └── Footer.jsx          # Status bar
│   │   │
│   │   ├── dashboard/
│   │   │   ├── KpiCards.jsx        # 6 KPI summary cards
│   │   │   ├── LiveMap.jsx         # Leaflet map with junctions
│   │   │   ├── AlertFeed.jsx       # Real-time alert stream
│   │   │   ├── SignalStatus.jsx    # Current signal phase display
│   │   │   └── QuickActions.jsx    # Emergency buttons
│   │   │
│   │   ├── vision/
│   │   │   ├── CameraFeed.jsx      # Video player with overlay
│   │   │   ├── DetectionOverlay.jsx # Bounding boxes on video
│   │   │   ├── LaneRoiEditor.jsx   # Polygon drawing for lanes
│   │   │   └── BrtsZoneEditor.jsx  # BRTS corridor polygon editor
│   │   │
│   │   ├── signals/
│   │   │   ├── SignalControl.jsx   # Manual override panel
│   │   │   ├── TimingChart.jsx     # Signal timing Gantt chart
│   │   │   ├── ModeSelector.jsx    # RL / Webster / Manual / Event
│   │   │   └── GreenWaveConfig.jsx # Multi-junction coordination
│   │   │
│   │   ├── analytics/
│   │   │   ├── HeatMap.jsx         # Congestion heat map
│   │   │   ├── TrendChart.jsx      # Time-series line chart
│   │   │   ├── BottleneckList.jsx  # Detected bottleneck table
│   │   │   └── RecommendationCard.jsx # Engineering suggestion
│   │   │
│   │   ├── predictions/
│   │   │   ├── ForecastChart.jsx   # Prediction vs actual
│   │   │   ├── ConfidenceMeter.jsx # Prediction confidence gauge
│   │   │   └── FactorBreakdown.jsx # Contributing factors list
│   │   │
│   │   ├── violations/
│   │   │   ├── ViolationTable.jsx  # Paginated violation list
│   │   │   ├── ViolationDetail.jsx # Evidence viewer modal
│   │   │   └── ViolationStats.jsx  # Stats cards (today/week/month)
│   │   │
│   │   ├── simulation/
│   │   │   ├── ScenarioBuilder.jsx # Slider-based config
│   │   │   ├── SumoVisualizer.jsx  # SUMO simulation canvas
│   │   │   └── ResultsComparison.jsx # Before/after metrics
│   │   │
│   │   └── common/
│   │       ├── Button.jsx          # Styled button variants
│   │       ├── Card.jsx            # Container card
│   │       ├── Badge.jsx           # Status badge
│   │       ├── Table.jsx           # Data table
│   │       ├── Modal.jsx           # Dialog modal
│   │       ├── Toast.jsx           # Notification toast
│   │       ├── LoadingSpinner.jsx  # Loading indicator
│   │       └── ErrorBoundary.jsx   # Error fallback
│   │
│   ├── hooks/                      # Custom React hooks
│   │   ├── useApi.js               # HTTP requests with loading/error states
│   │   ├── useWebSocket.js         # WebSocket connection manager
│   │   ├── useAuth.js              # Authentication state + login/logout
│   │   ├── useRealtime.js          # Subscribe to live data updates
│   │   ├── useMap.js               # Leaflet map initialization + controls
│   │   ├── useChart.js             # Recharts config + data formatting
│   │   └── useInterval.js          # setInterval hook with cleanup
│   │
│   ├── services/                   # API communication layer
│   │   ├── api.js                  # Axios instance + interceptors
│   │   ├── junctionApi.js          # Junction endpoints
│   │   ├── visionApi.js            # Detection endpoints
│   │   ├── signalApi.js            # Signal endpoints
│   │   ├── violationApi.js         # Violation endpoints
│   │   ├── predictionApi.js        # Prediction endpoints
│   │   ├── analyticsApi.js         # Analytics endpoints
│   │   └── authApi.js              # Auth endpoints
│   │
│   ├── store/                      # Zustand state stores
│   │   ├── authStore.js            # User, token, login/logout
│   │   ├── dataStore.js            # Junctions, detections, signals, violations
│   │   ├── uiStore.js              # Theme, sidebar, modals, toasts
│   │   └── realtimeStore.js        # WebSocket data cache
│   │
│   ├── utils/                      # Helper functions
│   │   ├── constants.js            # API URLs, colors, thresholds
│   │   ├── formatters.js           # Date, number, time formatters
│   │   ├── validators.js           # Form validation rules
│   │   ├── geoUtils.js             # Distance, coordinate calculations
│   │   └── colorScales.js          # Congestion color mapping (green→red)
│   │
│   └── dummyData/                  # Mock data for development
│       ├── junctions.js            # 3 sample junctions
│       ├── detections.js           # Sample detection results
│       ├── signals.js              # Sample signal timings
│       ├── violations.js           # Sample violation records
│       ├── predictions.js          # Sample forecast data
│       ├── heatmap.js              # Sample heat map grid
│       └── trends.js               # Sample time-series data
│
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── .env.example
```

---

## 4. Page Designs (Wireframe Description)

### 4.1 Dashboard Page (Main)
```
┌─────────────────────────────────────────────────────────────┐
│ [LOGO] E-RAKSHAK                    [Alerts 3] [User ▼]    │
├─────────────────────────────────────────────────────────────┤
│ [Sidebar] │ [6 KPI Cards: Active | Wait | Throughput |     │
│           │  Violations | Congestion | Health]             │
│ Dashboard │                                                │
│ Vision    │ ┌─────────────────┐  ┌──────────────────────┐ │
│ Signals   │ │   LIVE MAP      │  │   SIGNAL CONTROL     │ │
│ Violations│ │                 │  │  [Phase: NS_GREEN]   │ │
│ Analytics │ │   [J-001] ●     │  │  Duration: 35s       │ │
│ Predictions││   [J-002] ●     │  │  Mode: [RL ▼]        │ │
│ Simulation││   [J-003] ●     │  │  [Override] [Emergency]│
│ Settings  │ │                 │  └──────────────────────┘ │
│           │ └─────────────────┘                            │
│           │ ┌──────────────────────────────────────────┐  │
│           │ │         ALERT FEED (Real-time)            │  │
│           │ │  [CRIT] BRTS Violation J-001  14:32      │  │
│           │ │  [WARN] Queue >20 J-002       14:30      │  │
│           │ │  [INFO] Signal optimized J-003  14:28      │  │
│           │ └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Vision Page (Camera + Detection)
```
┌─────────────────────────────────────────────────────────────┐
│ [Sidebar] │ CAMERA FEED - J-001 (Ring Road × BRTS)         │
│           │                                                │
│           │ ┌──────────────────────────────────────────┐  │
│           │ │  [Video Frame with Bounding Boxes]       │  │
│           │ │  ┌───┐ Car [95%]                         │  │
│           │ │  ┌───┐ Bus [88%]                         │  │
│           │ │  [Stop Line] ───────────────────────      │  │
│           │ │  Queue: 45m (9 vehicles)                │  │
│           │ │  [BRTS ZONE - red overlay]                │  │
│           │ └──────────────────────────────────────────┘  │
│           │                                                │
│           │ PER-LANE ANALYSIS:                            │
│           │ Lane | Vehicles | Queue | Density | Wait | Status│
│           │ L1   | 3        | 15m   | Low     | 12s  | [OK] │
│           │ L2   | 5        | 25m   | Med     | 28s  | [WARN]│
│           │ L3   | 9        | 45m   | High    | 52s  | [CRIT]│
│           │ L4   | 2        | 8m    | Low     | 8s   | [OK]  │
│           │                                                │
│           │ Detection: YOLOv11 | Conf: 94.2% | FPS: 25   │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Signals Page (Control + Optimization)
```
┌─────────────────────────────────────────────────────────────┐
│ [Sidebar] │ SIGNAL OPTIMIZATION - J-001                     │
│           │                                                │
│           │ MODE: [RL Optimized ▼] [Webster] [Manual] [Event]│
│           │                                                │
│           │ CURRENT PHASE:                                  │
│           │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│           │ │   NS    │ │   EW    │ │  NS Left│ │Pedestrian│
│           │ │ [GREEN] │ │  [RED]  │ │ [YELLOW]│ │  [RED]  │
│           │ │  35s    │ │   0s    │ │   5s    │ │   0s    │
│           │ └─────────┘ └─────────┘ └─────────┘ └────────┘ │
│           │                                                │
│           │ COMPARISON CHART:                               │
│           │ ┌──────────────────────────────────────────┐  │
│           │ │  Wait Time (seconds) - Lower is Better   │  │
│           │ │  Static: ████████ 42s                     │  │
│           │ │  Webster: ██████ 35s                      │  │
│           │ │  RL: █████ 28s  [CURRENT]                │  │
│           │ │  GreenWave: ████ 22s                     │  │
│           │ └──────────────────────────────────────────┘  │
│           │                                                │
│           │ GREEN WAVE: J-001 → J-002 → J-003            │
│           │ Offset: 0s → 15s → 30s | Speed: 40 km/h     │
│           │                                                │
│           │ [Apply Changes] [Reset to Default] [Emergency All-Red]│
└─────────────────────────────────────────────────────────────┘
```

### 4.4 Analytics Page (Heat Map + Trends)
```
┌─────────────────────────────────────────────────────────────┐
│ [Sidebar] │ CONGESTION ANALYTICS                             │
│           │                                                │
│           │ TIME RANGE: [Today ▼] | GRANULARITY: [5min ▼]   │
│           │                                                │
│           │ ┌──────────────────────────────────────────┐  │
│           │ │         HEAT MAP - Surat City            │  │
│           │ │                                          │  │
│           │ │    ● J-001 [RED]    ● J-002 [YELLOW]     │  │
│           │ │                                          │  │
│           │ │    ● J-003 [GREEN]                       │  │
│           │ │                                          │  │
│           │ └──────────────────────────────────────────┘  │
│           │                                                │
│           │ TREND: J-001 Congestion Index (Last 30 Days)  │
│           │ ┌──────────────────────────────────────────┐  │
│           │ │  0.8 ┤    ╱╲                              │  │
│           │ │  0.6 ┤   ╱  ╲    ╱╲                     │  │
│           │ │  0.4 ┤──╱────╲──╱──╲──                  │  │
│           │ │  0.2 ┤                              │  │
│           │ └──────────────────────────────────────────┘  │
│           │                                                │
│           │ RECOMMENDATIONS:                                │
│           │ [1] Install median divider at J-001 (High Impact)│
│           │ [2] Convert L3 to bus lane at J-002 (Medium)    │
│           │ [3] Extend green wave offset +3s (Low)         │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Component Details

### 5.1 KpiCards Component
```jsx
// components/dashboard/KpiCards.jsx
import { useEffect } from 'react';
import { useRealtime } from '../../hooks/useRealtime';
import { Activity, Clock, TrendingUp, AlertTriangle, Gauge, Server } from 'lucide-react';

const KPI_CONFIG = [
  { key: 'active_junctions', label: 'Active Junctions', icon: Activity, color: 'blue', format: (v) => `${v}/52` },
  { key: 'avg_wait_time', label: 'Avg Wait Time', icon: Clock, color: 'green', format: (v) => `${v}s`, trend: '-18%' },
  { key: 'throughput', label: 'Throughput', icon: TrendingUp, color: 'yellow', format: (v) => `${v.toLocaleString()} veh/hr`, trend: '+12%' },
  { key: 'violations', label: 'BRTS Violations', icon: AlertTriangle, color: 'red', format: (v) => v, trend: '-67%' },
  { key: 'congestion', label: 'Congestion Index', icon: Gauge, color: 'cyan', format: (v) => v },
  { key: 'health', label: 'System Health', icon: Server, color: 'purple', format: (v) => `${v}%` },
];

export default function KpiCards() {
  const { data } = useRealtime('kpi');

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {KPI_CONFIG.map(kpi => (
        <div key={kpi.key} className={`bg-slate-800 rounded-lg p-4 border-l-4 border-${kpi.color}-500`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">{kpi.label}</p>
              <p className="text-2xl font-bold text-white mt-1">
                {kpi.format(data?.[kpi.key] || 0)}
              </p>
              {kpi.trend && (
                <p className={`text-sm mt-1 ${kpi.trend.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                  {kpi.trend} vs last week
                </p>
              )}
            </div>
            <kpi.icon className={`w-8 h-8 text-${kpi.color}-400`} />
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 5.2 LiveMap Component
```jsx
// components/dashboard/LiveMap.jsx
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useRealtime } from '../../hooks/useRealtime';

const JUNCTION_STATUS = {
  normal: { color: '#10B981', radius: 8 },
  moderate: { color: '#F59E0B', radius: 10 },
  high: { color: '#EF4444', radius: 12 },
  critical: { color: '#7C3AED', radius: 14 },
};

export default function LiveMap() {
  const mapRef = useRef(null);
  const { data: junctions } = useRealtime('junctions');

  useEffect(() => {
    if (!mapRef.current) return;

    const map = L.map(mapRef.current).setView([21.1702, 72.8311], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // Add junction markers
    junctions?.forEach(j => {
      const status = JUNCTION_STATUS[j.status] || JUNCTION_STATUS.normal;
      L.circleMarker([j.lat, j.lon], {
        radius: status.radius,
        fillColor: status.color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(map).bindPopup(`<b>${j.name}</b><br>Status: ${j.status}`);
    });

    return () => map.remove();
  }, [junctions]);

  return <div ref={mapRef} className="h-96 rounded-lg overflow-hidden" />;
}
```

### 5.3 AlertFeed Component
```jsx
// components/dashboard/AlertFeed.jsx
import { useRealtime } from '../../hooks/useRealtime';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

const SEVERITY_CONFIG = {
  CRITICAL: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-900/30' },
  WARNING: { icon: AlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  INFO: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-900/30' },
};

export default function AlertFeed() {
  const { data: alerts } = useRealtime('alerts');

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <h3 className="text-white font-bold mb-3">Live Alerts</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {alerts?.map(alert => {
          const config = SEVERITY_CONFIG[alert.severity];
          const Icon = config.icon;
          return (
            <div key={alert.id} className={`${config.bg} rounded p-3 flex items-start gap-3`}>
              <Icon className={`w-5 h-5 ${config.color} mt-0.5`} />
              <div className="flex-1">
                <p className={`text-sm font-medium ${config.color}`}>
                  [{alert.severity}] {alert.type}
                </p>
                <p className="text-slate-300 text-sm">{alert.message}</p>
                <p className="text-slate-500 text-xs mt-1">{alert.timestamp}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### 5.4 SignalControl Component
```jsx
// components/signals/SignalControl.jsx
import { useState } from 'react';
import { signalApi } from '../../services/signalApi';

const PHASES = ['NS_GREEN', 'EW_GREEN', 'NS_LEFT', 'EW_LEFT', 'ALL_RED'];
const MODES = ['RL', 'WEBSTER', 'MANUAL', 'EVENT'];

export default function SignalControl({ junctionId }) {
  const [mode, setMode] = useState('RL');
  const [currentPhase, setCurrentPhase] = useState('NS_GREEN');
  const [duration, setDuration] = useState(45);

  const handleOptimize = async () => {
    const result = await signalApi.optimize(junctionId, mode);
    setCurrentPhase(result.recommended_phase);
    setDuration(result.recommended_duration);
  };

  const handleOverride = async (phase) => {
    await signalApi.apply(junctionId, { phase, duration, mode: 'MANUAL' });
    setCurrentPhase(phase);
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold">Signal Control</h3>
        <select 
          value={mode} 
          onChange={(e) => setMode(e.target.value)}
          className="bg-slate-700 text-white rounded px-3 py-1"
        >
          {MODES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-4">
        {PHASES.map(phase => (
          <button
            key={phase}
            onClick={() => handleOverride(phase)}
            className={`p-3 rounded text-sm font-bold ${
              currentPhase === phase 
                ? 'bg-green-500 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {phase.replace('_', ' ')}
            {currentPhase === phase && <div className="text-xs mt-1">{duration}s</div>}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button 
          onClick={handleOptimize}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded py-2"
        >
          AI Optimize
        </button>
        <button 
          onClick={() => handleOverride('ALL_RED')}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded py-2"
        >
          Emergency Stop
        </button>
      </div>
    </div>
  );
}
```

---

## 6. Hooks

### 6.1 useApi Hook
```jsx
// hooks/useApi.js
import { useState, useCallback } from 'react';
import { api } from '../services/api';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const request = useCallback(async (method, url, body = null) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api[method](url, body);
      setData(response.data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, data, request };
}
```

### 6.2 useWebSocket Hook
```jsx
// hooks/useWebSocket.js
import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebSocket(url) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages(prev => [...prev.slice(-50), data]); // Keep last 50
    };

    return () => ws.close();
  }, [url]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const subscribe = useCallback((topics) => {
    send({ action: 'subscribe', topics });
  }, [send]);

  return { connected, messages, send, subscribe };
}
```

---

## 7. Services (API Layer)

### 7.1 API Setup
```js
// services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### 7.2 Vision API
```js
// services/visionApi.js
import api from './api';

export const visionApi = {
  detect: (imageFile, junctionId) => {
    const formData = new FormData();
    formData.append('file', imageFile);
    formData.append('junction_id', junctionId);
    return api.post('/vision/detect', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  track: (frameData, junctionId) => 
    api.post('/vision/track', { frame_data: frameData, junction_id: junctionId }),

  checkBrts: (frameData, junctionId) => 
    api.post('/vision/brts/check', { frame_data: frameData, junction_id: junctionId }),
};
```

### 7.3 Signal API
```js
// services/signalApi.js
import api from './api';

export const signalApi = {
  optimize: (junctionId, mode = 'RL') => 
    api.post('/signals/optimize', { junction_id: junctionId, mode }),

  apply: (junctionId, signalPlan) => 
    api.post('/signals/apply', { junction_id: junctionId, ...signalPlan }),

  getStatus: (junctionId) => 
    api.get(`/signals/${junctionId}/status`),

  getHistory: (junctionId, limit = 100) => 
    api.get(`/signals/${junctionId}/history?limit=${limit}`),
};
```

---

## 8. State Management (Zustand)

### 8.1 Auth Store
```js
// store/authStore.js
import { create } from 'zustand';
import { authApi } from '../services/authApi';

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),

  login: async (username, password) => {
    const { token, user } = await authApi.login(username, password);
    localStorage.setItem('token', token);
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      const user = await authApi.me();
      set({ user, isAuthenticated: true });
    } catch {
      set({ user: null, token: null, isAuthenticated: false });
    }
  }
}));
```

### 8.2 Data Store
```js
// store/dataStore.js
import { create } from 'zustand';

export const useDataStore = create((set, get) => ({
  junctions: [],
  detections: [],
  signals: [],
  violations: [],
  predictions: [],
  alerts: [],

  setJunctions: (junctions) => set({ junctions }),
  addDetection: (detection) => set(state => ({ 
    detections: [...state.detections.slice(-100), detection] 
  })),
  updateSignal: (signal) => set(state => ({
    signals: state.signals.map(s => s.junction_id === signal.junction_id ? signal : s)
  })),
  addViolation: (violation) => set(state => ({
    violations: [violation, ...state.violations.slice(-99)]
  })),
  addAlert: (alert) => set(state => ({
    alerts: [alert, ...state.alerts.slice(-49)]
  })),

  // Computed
  getJunctionById: (id) => get().junctions.find(j => j.id === id),
  getActiveAlerts: () => get().alerts.filter(a => a.status === 'ACTIVE'),
}));
```

---

## 9. Dummy Data (For Development)

```js
// dummyData/junctions.js
export const dummyJunctions = [
  { id: 'J-001', name: 'Ring Road × BRTS', lat: 21.1702, lon: 72.8311, status: 'critical', num_lanes: 4, has_brts: true },
  { id: 'J-002', name: 'Ghod Dod Road', lat: 21.1750, lon: 72.8350, status: 'moderate', num_lanes: 4, has_brts: false },
  { id: 'J-003', name: 'City Light', lat: 21.1650, lon: 72.8250, status: 'normal', num_lanes: 6, has_brts: true },
];

// dummyData/detections.js
export const dummyDetections = [
  { junction_id: 'J-001', vehicle_class: 'car', confidence: 0.95, lane: 'L1', is_stopped: true },
  { junction_id: 'J-001', vehicle_class: 'car', confidence: 0.92, lane: 'L1', is_stopped: true },
  { junction_id: 'J-001', vehicle_class: 'bus', confidence: 0.88, lane: 'L2', is_stopped: false },
  { junction_id: 'J-001', vehicle_class: 'auto', confidence: 0.85, lane: 'L3', is_stopped: true },
  { junction_id: 'J-001', vehicle_class: 'truck', confidence: 0.83, lane: 'L2', is_stopped: true },
];

// dummyData/alerts.js
export const dummyAlerts = [
  { id: 'A001', severity: 'CRITICAL', type: 'BRTS_VIOLATION', message: 'Truck in BRTS corridor J-001', timestamp: '18:32:15', junction_id: 'J-001' },
  { id: 'A002', severity: 'WARNING', type: 'QUEUE_LENGTH', message: 'Queue >20 vehicles at J-002', timestamp: '18:30:00', junction_id: 'J-002' },
  { id: 'A003', severity: 'INFO', type: 'OPTIMIZATION', message: 'Signal optimized at J-003 (+15% throughput)', timestamp: '18:28:00', junction_id: 'J-003' },
];

// dummyData/predictions.js
export const dummyPredictions = [
  { junction_id: 'J-001', predicted_level: 'CRITICAL', confidence: 0.84, horizon: '30 min', factors: ['Peak hour', 'Festival', 'Rain forecast'] },
  { junction_id: 'J-002', predicted_level: 'MODERATE', confidence: 0.72, horizon: '30 min', factors: ['Peak hour'] },
  { junction_id: 'J-003', predicted_level: 'LOW', confidence: 0.91, horizon: '30 min', factors: ['Off-peak'] },
];
```

---

## 10. Quick Start

```bash
# 1. Create project
npm create vite@latest erakshak-frontend -- --template react

# 2. Install dependencies
cd erakshak-frontend
npm install

# 3. Install additional packages
npm install axios zustand leaflet react-leaflet recharts lucide-react date-fns react-hook-form @tanstack/react-table tailwindcss postcss autoprefixer

# 4. Setup Tailwind
npx tailwindcss init -p

# 5. Configure tailwind.config.js
# content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]

# 6. Add to index.css
# @tailwind base;
# @tailwind components;
# @tailwind utilities;

# 7. Copy project structure from above

# 8. Add .env
# VITE_API_URL=http://localhost:8000/api
# VITE_WS_URL=ws://localhost:8000/ws/live

# 9. Start dev server
npm run dev

# 10. Open http://localhost:5173
```

---

## 11. Package.json

```json
{
  "name": "erakshak-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.25.1",
    "axios": "^1.7.2",
    "zustand": "^4.5.4",
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1",
    "recharts": "^2.12.7",
    "lucide-react": "^0.400.0",
    "date-fns": "^3.6.0",
    "react-hook-form": "^7.52.1",
    "@tanstack/react-table": "^8.19.3",
    "tailwind-merge": "^2.4.0",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.6",
    "vite": "^5.3.4",
    "vitest": "^2.0.3"
  }
}
```

---

## 12. Integration with Backend

### 12.1 Data Flow
```
Frontend Action → API Call → Backend Processing → Database → Response → UI Update
     ↓              ↓             ↓                ↓           ↓          ↓
  User clicks    Axios POST   FastAPI route    SQLAlchemy   JSON      Zustand
  "Detect"       /detect      vision.py        query        response  store update
                                                           ↓
                                                    WebSocket broadcast
                                                           ↓
                                                    Real-time UI update
```

### 12.2 WebSocket Events
```js
// Frontend subscribes to real-time updates
const { connected, messages, subscribe } = useWebSocket('ws://localhost:8000/ws/live');

useEffect(() => {
  subscribe(['junctions', 'alerts', 'predictions']);
}, []);

useEffect(() => {
  messages.forEach(msg => {
    switch(msg.event) {
      case 'vehicle.detected':
        dataStore.addDetection(msg.data);
        break;
      case 'signal.changed':
        dataStore.updateSignal(msg.data);
        break;
      case 'violation.alert':
        dataStore.addViolation(msg.data);
        toast.error(`Violation: ${msg.data.message}`);
        break;
      case 'prediction.update':
        dataStore.updatePrediction(msg.data);
        break;
    }
  });
}, [messages]);
```