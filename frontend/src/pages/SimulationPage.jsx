import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { 
  Play, 
  Pause, 
  SkipForward, 
  RotateCcw,
  RefreshCw, 
  Clock, 
  TrendingUp, 
  Terminal, 
  Activity,
  AlertTriangle,
  Zap,
  Shield,
  Layers,
  ChevronRight,
  BarChart3,
  Sliders,
  CheckCircle2,
  FileText,
  Compass,
  ArrowRight,
  Radio,
  Eye,
  Maximize2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

const SCENARIOS = [
  { 
    id: 'adaptive', 
    name: 'Adaptive Traffic Control', 
    desc: 'Uses real-time traffic conditions (queue length, vehicle density, waiting time, occupancy). Dynamically optimizes signal timing to reduce wait time and increase throughput.', 
    icon: Zap, 
    color: 'text-emerald-400', 
    badge: 'Dynamic' 
  },
  { 
    id: 'fixed', 
    name: 'Traditional Fixed-Time Control', 
    desc: 'Predefined fixed signal cycle (60s). Same timing regardless of current traffic. Acts as the uncoordinated comparative baseline.', 
    icon: Clock, 
    color: 'text-slate-400', 
    badge: 'Baseline' 
  }
];

const DEMAND_PRESETS = [
  { id: 'low', name: 'Low', rate: 15, color: 'text-emerald-400 border-emerald-500/30' },
  { id: 'normal', name: 'Normal', rate: 30, color: 'text-cyan-400 border-cyan-500/30' },
  { id: 'heavy', name: 'Heavy', rate: 60, color: 'text-amber-400 border-amber-500/30' },
  { id: 'peak', name: 'Peak', rate: 90, color: 'text-rose-400 border-rose-500/30' }
];

// Physical Node Coordinates in net.net.xml:
// W_ENTRY: (0, 200), SVNIT: (250, 200), GHODDOD: (600, 200), MAJURA: (950, 200), SAHARA: (1300, 200), E_ENTRY: (1550, 200)
// North nodes: Y = 400, South nodes: Y = 0
const CORRIDOR_JUNCTIONS = [
  { id: 'J_SVNIT', name: 'J1: SVNIT', full: 'SVNIT / Ichchhanath Circle', x: 250, y: 200 },
  { id: 'J_GHODDOD', name: 'J2: GHOD DOD', full: 'Ghod Dod Road Commercial Cross', x: 600, y: 200 },
  { id: 'J_MAJURA', name: 'J3: MAJURA', full: 'Majura Gate BRTS Multi-Leg Hub', x: 950, y: 200 },
  { id: 'J_SAHARA', name: 'J4: SAHARA', full: 'Sahara Darwaja Railway Flyover', x: 1300, y: 200 }
];

export default function SimulationPage() {
  const navigate = useNavigate();

  // Top KPIs
  const [stats, setStats] = useState({
    time: 0.0,
    activeVehicles: 0,
    completedVehicles: 0,
    avgSpeed: 0.0,
    spawnRate: 60.0,
    isPaused: true,
    speedMultiplier: 1.0,
    scenarioMode: 'adaptive',
    is5MinRunning: false,
    demoProgress: 0.0
  });

  // Client-side UI states
  const [wsStatus, setWsStatus] = useState('connecting');
  const [hasGeometry, setHasGeometry] = useState(false);
  const [tlsStates, setTlsStates] = useState({});
  const [signalIntel, setSignalIntel] = useState({});
  const [selectedJunction, setSelectedJunction] = useState('J_MAJURA');
  const [selectedScenario, setSelectedScenario] = useState('adaptive');
  const [selectedDemand, setSelectedDemand] = useState('peak');
  const [alerts, setAlerts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedReport, setCompletedReport] = useState(null);

  // Canvas Refs & Viewport
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const networkGeomRef = useRef(null);
  const simStateRef = useRef(null);

  // Viewport navigation (Centered at X=775, Y=200 for 1550m corridor)
  const baseScaleRef = useRef(0.62);
  const zoomLevelRef = useRef(1.0);
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const centerOffsetRef = useRef({ x: 775, y: 200 });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  const logMessage = (text, type = 'system') => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => {
      const nextLogs = [...prev, { id: Date.now() + Math.random(), timestamp, text, type }];
      return nextLogs.length > 40 ? nextLogs.slice(nextLogs.length - 40) : nextLogs;
    });
  };

  // Coordinate transforms (Y is inverted for standard 2D cartesian to screen pixels)
  const worldToScreen = (wx, wy, canvas) => {
    const cx = canvas.width / 2 + panOffsetRef.current.x;
    const cy = canvas.height / 2 + panOffsetRef.current.y;
    const scale = baseScaleRef.current * zoomLevelRef.current;
    const sx = cx + (wx - centerOffsetRef.current.x) * scale;
    const sy = cy - (wy - centerOffsetRef.current.y) * scale;
    return { x: sx, y: sy };
  };

  const resetViewport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    panOffsetRef.current = { x: 0, y: 0 };
    zoomLevelRef.current = 1.0;
    centerOffsetRef.current = { x: 775, y: 200 };

    const scaleX = (canvas.width - 60) / 1600;
    const scaleY = (canvas.height - 60) / 440;
    baseScaleRef.current = Math.min(scaleX, scaleY) * 1.12;
    draw();
  };

  // Canvas Drawing Routine
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, canvas);

    if (!networkGeomRef.current) {
      ctx.fillStyle = "#8e9bb5";
      ctx.font = "14px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Connecting to SUMO 4-Junction Corridor...", canvas.width / 2, canvas.height / 2);
      return;
    }

    drawRoads(ctx, canvas);
    drawTrafficLights(ctx, canvas);
    drawVehicles(ctx, canvas);
    drawJunctionHUD(ctx, canvas);
  };

  const drawGrid = (ctx, canvas) => {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
    ctx.lineWidth = 1;
    const spacing = 40 * zoomLevelRef.current;
    const startX = (canvas.width / 2 + panOffsetRef.current.x) % spacing;
    const startY = (canvas.height / 2 + panOffsetRef.current.y) % spacing;

    for (let x = startX; x < canvas.width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = startY; y < canvas.height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  };

  const drawRoads = (ctx, canvas) => {
    const geom = networkGeomRef.current;
    const sim = simStateRef.current;
    if (!geom || !geom.lanes) return;

    const scale = baseScaleRef.current * zoomLevelRef.current;

    // 1. Draw outer road surface with congestion coloring
    geom.lanes.forEach(lane => {
      if (lane.shape.length < 2) return;
      ctx.beginPath();
      const start = worldToScreen(lane.shape[0][0], lane.shape[0][1], canvas);
      ctx.moveTo(start.x, start.y);

      for (let i = 1; i < lane.shape.length; i++) {
        const pt = worldToScreen(lane.shape[i][0], lane.shape[i][1], canvas);
        ctx.lineTo(pt.x, pt.y);
      }

      const laneMetrics = sim?.lanes?.[lane.id];
      const cLevel = laneMetrics?.congestionLevel || "low";

      let roadColor = "#141722"; // Crisp dark slate asphalt
      if (lane.isBrts) roadColor = "#2d1254"; // High-contrast Deep Indigo for BRTS Lane
      else if (cLevel === "critical") roadColor = "#450a0a"; // Red glow for critical queue
      else if (cLevel === "congested") roadColor = "#422006"; // Amber glow for congestion

      ctx.strokeStyle = roadColor;
      ctx.lineWidth = (lane.width || 3.5) * scale * 1.25;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    });

    // 2. Draw lane dividers & distinct BRTS boundary
    geom.lanes.forEach(lane => {
      if (lane.shape.length < 2) return;
      ctx.beginPath();
      const start = worldToScreen(lane.shape[0][0], lane.shape[0][1], canvas);
      ctx.moveTo(start.x, start.y);

      for (let i = 1; i < lane.shape.length; i++) {
        const pt = worldToScreen(lane.shape[i][0], lane.shape[i][1], canvas);
        ctx.lineTo(pt.x, pt.y);
      }

      if (lane.isBrts) {
        // Glowing dashed boundary for BRTS lane
        ctx.strokeStyle = "rgba(168, 85, 247, 0.85)";
        ctx.lineWidth = 2.0 * zoomLevelRef.current;
        ctx.setLineDash([8 * zoomLevelRef.current, 6 * zoomLevelRef.current]);
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 1.0 * zoomLevelRef.current;
        ctx.setLineDash([4 * zoomLevelRef.current, 6 * zoomLevelRef.current]);
      }
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // 3. Draw subtle Direction Flow Arrows on lanes
    geom.lanes.forEach(lane => {
      if (lane.shape.length < 2 || lane.id.startsWith(":")) return;
      const midIdx = Math.floor(lane.shape.length / 2);
      const p1 = lane.shape[Math.max(0, midIdx - 1)];
      const p2 = lane.shape[midIdx];
      const sp1 = worldToScreen(p1[0], p1[1], canvas);
      const sp2 = worldToScreen(p2[0], p2[1], canvas);

      const dx = sp2.x - sp1.x;
      const dy = sp2.y - sp1.y;
      const len = Math.hypot(dx, dy);
      if (len < 10) return;

      const ux = dx / len;
      const uy = dy / len;
      const arrowX = sp1.x + dx * 0.5;
      const arrowY = sp1.y + dy * 0.5;
      const arrowSize = 4.5 * scale;

      ctx.beginPath();
      ctx.moveTo(arrowX - ux * arrowSize - uy * arrowSize * 0.5, arrowY - uy * arrowSize + ux * arrowSize * 0.5);
      ctx.lineTo(arrowX, arrowY);
      ctx.lineTo(arrowX - ux * arrowSize + uy * arrowSize * 0.5, arrowY - uy * arrowSize - ux * arrowSize * 0.5);
      ctx.strokeStyle = lane.isBrts ? "rgba(192, 132, 252, 0.4)" : "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1.2 * zoomLevelRef.current;
      ctx.stroke();
    });
  };

  const drawTrafficLights = (ctx, canvas) => {
    const geom = networkGeomRef.current;
    const sim = simStateRef.current;
    if (!geom || !sim || !sim.tls) return;

    const scale = baseScaleRef.current * zoomLevelRef.current;

    for (const [tlsId, tlsData] of Object.entries(sim.tls)) {
      const curPhase = tlsData.phase; // 0 = EW Green, 1 = EW Yellow, 2 = NS Green, 3 = NS Yellow
      const junc = CORRIDOR_JUNCTIONS.find(j => j.id === tlsId);
      if (!junc) continue;

      const pt = worldToScreen(junc.x, junc.y, canvas);

      // Determine active EW and NS colors
      const ewColor = curPhase === 0 ? "#10b981" : curPhase === 1 ? "#f59e0b" : "#ef4444";
      const nsColor = curPhase === 2 ? "#10b981" : curPhase === 3 ? "#f59e0b" : "#ef4444";

      // 1. East-West Signal Head (Horizontal)
      ctx.fillStyle = "#090d16";
      ctx.strokeStyle = ewColor;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(pt.x - 26 * scale, pt.y - 10 * scale, 52 * scale, 20 * scale, 5 * scale);
      ctx.fill();
      ctx.stroke();

      // EW Light Bulbs
      ctx.fillStyle = ewColor;
      ctx.shadowColor = ewColor;
      ctx.shadowBlur = 10 * scale;
      ctx.beginPath();
      ctx.arc(pt.x - 14 * scale, pt.y, 5 * scale, 0, 2 * Math.PI);
      ctx.arc(pt.x + 14 * scale, pt.y, 5 * scale, 0, 2 * Math.PI);
      ctx.fill();
      ctx.shadowBlur = 0;

      // 2. North-South Signal Head (Vertical)
      ctx.fillStyle = "#090d16";
      ctx.strokeStyle = nsColor;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(pt.x - 10 * scale, pt.y - 26 * scale, 20 * scale, 52 * scale, 5 * scale);
      ctx.fill();
      ctx.stroke();

      // NS Light Bulbs
      ctx.fillStyle = nsColor;
      ctx.shadowColor = nsColor;
      ctx.shadowBlur = 10 * scale;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y - 14 * scale, 5 * scale, 0, 2 * Math.PI);
      ctx.arc(pt.x, pt.y + 14 * scale, 5 * scale, 0, 2 * Math.PI);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  };

  const drawVehicles = (ctx, canvas) => {
    const sim = simStateRef.current;
    if (!sim || !sim.vehicles) return;

    const scale = baseScaleRef.current * zoomLevelRef.current;

    sim.vehicles.forEach(veh => {
      const screenPt = worldToScreen(veh.x, veh.y, canvas);
      const wLen = (veh.length || 4.8) * scale * 1.25;
      const wWid = (veh.width || 1.8) * scale * 1.25;
      const angleRad = (veh.angle - 90) * Math.PI / 180;

      ctx.save();
      ctx.translate(screenPt.x, screenPt.y);
      ctx.rotate(angleRad);

      let color = "#06b6d4"; // Cyan for cars
      if (veh.type === "motorcycle") color = "#10b981"; // Emerald for bikes
      else if (veh.type === "brts_bus") color = "#c084fc"; // Purple/Violet for BRTS Bus
      else if (veh.type === "bus") color = "#f97316"; // Orange for City Bus
      else if (veh.type === "truck") color = "#eab308"; // Amber for Trucks

      if (veh.isIntruding) {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-wLen / 2 - 2, -wWid / 2 - 2, wLen + 4, wWid + 4);
      }

      ctx.shadowColor = color;
      ctx.shadowBlur = 6 * zoomLevelRef.current;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-wLen / 2, -wWid / 2, wLen, wWid, 2.5 * zoomLevelRef.current);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Windshield & Headlights
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fillRect(wLen / 8, -wWid / 2.4, wLen / 4.5, wWid / 1.2);
      ctx.restore();
    });
  };

  const drawJunctionHUD = (ctx, canvas) => {
    const sim = simStateRef.current;
    const scale = baseScaleRef.current * zoomLevelRef.current;

    CORRIDOR_JUNCTIONS.forEach(j => {
      const pt = worldToScreen(j.x, j.y, canvas);
      const tls = sim?.tls?.[j.id];
      const phaseName = tls?.phaseName || "EW GREEN";
      const isGreen = phaseName.endsWith("GREEN");
      const isYellow = phaseName.endsWith("YELLOW");
      const timer = tls?.remainingSec || 0;

      const isSelected = selectedJunction === j.id;

      // Top Junction Title Badge
      const badgeW = 120 * scale;
      const badgeH = 26 * scale;
      ctx.fillStyle = isSelected ? "rgba(15, 23, 42, 0.95)" : "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = isSelected ? "#38bdf8" : "#334155";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(pt.x - badgeW / 2, pt.y - 48 * scale, badgeW, badgeH, 5 * scale);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isSelected ? "#38bdf8" : "#ffffff";
      ctx.font = `bold ${10 * scale}px Outfit, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(j.name, pt.x, pt.y - 32 * scale);

      // Bottom Status & Countdown Badge
      const statusW = 110 * scale;
      const statusH = 24 * scale;
      ctx.fillStyle = "rgba(10, 15, 28, 0.9)";
      ctx.strokeStyle = isGreen ? "#10b981" : isYellow ? "#f59e0b" : "#ef4444";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(pt.x - statusW / 2, pt.y + 28 * scale, statusW, statusH, 5 * scale);
      ctx.fill();
      ctx.stroke();

      const statusColor = isGreen ? "#34d399" : isYellow ? "#fbbf24" : "#f87171";
      ctx.fillStyle = statusColor;
      ctx.font = `bold ${9 * scale}px Outfit, sans-serif`;
      ctx.fillText(`${phaseName} (${timer.toFixed(0)}s)`, pt.x, pt.y + 44 * scale);
    });
  };

  // WebSocket Connection
  useEffect(() => {
    let ws;
    let reconnectTimer;
    let isMounted = true;

    const connect = () => {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const wsUrl = apiBase.replace(/^http/, 'ws') + '/ws/simulation';

      setWsStatus('connecting');
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setWsStatus('connected');
        logMessage("Connected to SUMO TraCI Micro-Simulation Engine.", "success");
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setWsStatus('disconnected');
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        const msg = JSON.parse(event.data);

        if (msg.type === "geometry") {
          networkGeomRef.current = msg.data;
          setHasGeometry(true);
          resetViewport();
        } else if (msg.type === "state") {
          simStateRef.current = msg.data;
          const simTime = typeof msg.data?.time === 'number' ? msg.data.time : 0.0;
          setStats(prev => ({
            ...prev,
            ...(msg.data?.stats || {}),
            time: simTime
          }));
          setTlsStates(msg.data?.tls || {});
          if (msg.data?.signalIntelligence) setSignalIntel(msg.data.signalIntelligence);
          if (msg.data?.alerts) setAlerts(msg.data.alerts);
          draw();
        } else if (msg.type === "config") {
          setStats(prev => ({ ...prev, ...(msg.data || {}) }));
          if (typeof msg.data?.brtsPriorityEnabled === 'boolean') {
            setBrtsPriorityEnabled(msg.data.brtsPriorityEnabled);
          }
        } else if (msg.type === "simulation_complete") {
          setCompletedReport(msg.data);
          setShowCompletionModal(true);
          logMessage("5-Minute Simulation Run Complete. Analytics generated.", "success");
        }
      };
    };

    connect();
    return () => {
      isMounted = false;
      if (ws) ws.close();
      clearTimeout(reconnectTimer);
    };
  }, []);

  // Handle Window Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        canvas.width = container.clientWidth || 900;
        canvas.height = 500;
        resetViewport();
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Canvas Mouse Interactions (Pan & Click Junction)
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check if clicked near a junction HUD
    CORRIDOR_JUNCTIONS.forEach(j => {
      const pt = worldToScreen(j.x, j.y, canvas);
      const dist = Math.hypot(clickX - pt.x, clickY - pt.y);
      if (dist < 45) {
        setSelectedJunction(j.id);
        logMessage(`Inspecting Approach Metrics for: ${j.full}`, "system");
      }
    });

    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...panOffsetRef.current };
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    panOffsetRef.current = { x: panStartRef.current.x + dx, y: panStartRef.current.y + dy };
    draw();
  };

  const handleMouseUp = () => { isDraggingRef.current = false; };

  // Mouse Wheel Zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    zoomLevelRef.current = Math.max(0.6, Math.min(2.5, zoomLevelRef.current * zoomFactor));
    draw();
  };

  // Controls Dispatch
  const sendControl = (payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  const handleTogglePlay = () => {
    sendControl({ type: stats.isPaused ? "resume" : "pause" });
  };

  const handleStep = () => {
    sendControl({ type: "step" });
  };

  const handleReset = () => {
    sendControl({ type: "reset" });
    logMessage("Simulation environment reset to initial state.", "system");
  };

  const handleRun5Min = () => {
    sendControl({
      type: "run_5min",
      scenario: selectedScenario,
      demand: selectedDemand
    });
    logMessage(`Started 5-minute demonstration run (${selectedScenario.toUpperCase()}, ${selectedDemand.toUpperCase()}).`, "success");
  };

  const handleSelectScenario = (scId) => {
    setSelectedScenario(scId);
    sendControl({ type: "set_scenario", scenario: scId });
    logMessage(`Switched scenario to: ${scId}`, "system");
  };

  const handleSelectDemand = (dId) => {
    setSelectedDemand(dId);
    sendControl({ type: "set_demand_preset", preset: dId });
  };

  const handleSpeedChange = (val) => {
    sendControl({ type: "set_speed_multiplier", value: val });
  };

  const handleToggleBrtsPriority = () => {
    const nextVal = !brtsPriorityEnabled;
    setBrtsPriorityEnabled(nextVal);
    sendControl({ type: "set_brts_priority", enabled: nextVal });
    logMessage(`BRTS Signal Priority: ${nextVal ? 'ENABLED' : 'DISABLED'}`, "system");
  };

  const activeIntel = signalIntel[selectedJunction] || {
    phaseName: 'EW GREEN',
    remainingSec: 18.0,
    ewPressure: 38.5,
    nsPressure: 14.2,
    reason: 'Dynamic queue-pressure adaptive extension',
    approaches: {
      NORTH: { vehicles: 12, queue: 4, speed: 18.2, wait: 14.5, pressure: 22.1 },
      SOUTH: { vehicles: 9, queue: 2, speed: 22.0, wait: 9.8, pressure: 16.4 },
      EAST: { vehicles: 21, queue: 7, speed: 28.5, wait: 12.0, pressure: 36.2 },
      WEST: { vehicles: 26, queue: 9, speed: 31.0, wait: 16.5, pressure: 41.0 }
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>🚦</span> Real-time SUMO Micro-Simulation Corridor
            </h2>
            <Badge variant="success">TraCI Adaptive Control</Badge>
          </div>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            4-Junction Surat Arterial Corridor (SVNIT → Ghod Dod → Majura Gate → Sahara Darwaja)
          </p>
        </div>

        {/* 5-Minute Demo Action */}
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={handleRun5Min}
            disabled={stats.is5MinRunning}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2"
          >
            <Zap className="h-4 w-4 fill-white" />
            <span>{stats.is5MinRunning ? 'Running 5-Min Demo...' : 'Run 5-Minute Simulation'}</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('/analytics')}
            className="py-2.5 px-4 text-xs font-bold border-slate-700 hover:bg-slate-800 text-slate-300 flex items-center gap-1.5"
          >
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            <span>View Analytics</span>
          </Button>
        </div>
      </div>

      {/* 5-Minute Demo Progress Bar (When Active) */}
      {stats.is5MinRunning && (
        <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/20 backdrop-blur-md shadow-2xl space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-emerald-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              5-Minute Simulation in Progress: {stats.scenarioMode?.toUpperCase()}
            </span>
            <span className="font-mono text-white">
              {Math.floor((stats?.time || 0) / 60)}:{((stats?.time || 0) % 60).toFixed(0).padStart(2, '0')} / 05:00 ({stats?.demoProgress || 0}%)
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
              style={{ width: `${stats?.demoProgress || 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Top Real-Time KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 shadow-md">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Simulation Time</span>
          <span className="text-lg font-extrabold text-white mt-1 block font-mono">{(stats?.time || 0).toFixed(1)}s</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 shadow-md">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Active Vehicles</span>
          <span className="text-lg font-extrabold text-cyan-400 mt-1 block font-mono">{stats?.activeVehicles || 0}</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 shadow-md">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Throughput (Trips)</span>
          <span className="text-lg font-extrabold text-emerald-400 mt-1 block font-mono">{stats?.completedVehicles || 0} veh</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 shadow-md">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Average Speed</span>
          <span className="text-lg font-extrabold text-orange-400 mt-1 block font-mono">{((stats?.avgSpeed || 0) * 3.6).toFixed(1)} km/h</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 shadow-md">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Corridor Flow</span>
          <span className="text-lg font-extrabold text-indigo-400 mt-1 block font-mono">{stats?.spawnRate || 60} veh/min</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 shadow-md">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">TraCI Engine</span>
          <div className="mt-1">
            {wsStatus === 'connected' ? (
              <Badge variant="success">Online (SUMO)</Badge>
            ) : (
              <Badge variant="danger">Connecting</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Horizontal Live Corridor Strip */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
          <span>SURAT SPINE:</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1 w-full">
          {CORRIDOR_JUNCTIONS.map((j) => {
            const intel = signalIntel[j.id];
            const phaseName = intel?.phaseName || "EW GREEN";
            const isGreen = phaseName.endsWith("GREEN");
            const isYellow = phaseName.endsWith("YELLOW");
            const isSelected = selectedJunction === j.id;

            return (
              <button
                key={j.id}
                onClick={() => setSelectedJunction(j.id)}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-slate-900 border-sky-500 shadow-md shadow-sky-500/10'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white">{j.name}</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${isGreen ? 'bg-emerald-400' : isYellow ? 'bg-amber-400' : 'bg-rose-400'}`} />
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-slate-400">{phaseName}</span>
                  <span className="font-mono text-emerald-400 font-bold">{(intel?.remainingSec || 0).toFixed(0)}s</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Controls & Visualizer */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Scenarios & Controls */}
        <div className="space-y-6 lg:col-span-1">
          {/* Scenario Selector */}
          <Card title="Traffic Optimization Scenarios" subtitle="Select active TraCI control policy">
            <div className="space-y-2.5">
              {SCENARIOS.map((sc) => {
                const IconComponent = sc.icon;
                const isSelected = selectedScenario === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => handleSelectScenario(sc.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                      isSelected 
                        ? 'bg-slate-900 border-emerald-500 shadow-md shadow-emerald-500/10' 
                        : 'bg-slate-950 border-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <div className={`p-2 rounded-lg bg-slate-900 border border-slate-800 mt-0.5 ${sc.color}`}>
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate">{sc.name}</span>
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${isSelected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                          {sc.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{sc.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Traffic Demand Presets */}
          <Card title="Traffic Demand Configuration" subtitle="4-way vehicle volume spawned along corridor">
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {DEMAND_PRESETS.map((dp) => (
                  <button
                    key={dp.id}
                    onClick={() => handleSelectDemand(dp.id)}
                    className={`py-2 px-1 text-center rounded-lg border text-xs font-bold transition-all ${
                      selectedDemand === dp.id 
                        ? 'bg-slate-800 text-white ' + dp.color 
                        : 'bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    <div>{dp.name}</div>
                    <div className="text-[10px] font-normal opacity-70">{dp.rate}/m</div>
                  </button>
                ))}
              </div>

              {/* Simulation Speed Buttons */}
              <div className="pt-2 border-t border-slate-900">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Execution Speed Multiplier</span>
                <div className="flex gap-2">
                  {[1.0, 2.0, 5.0, 10.0].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => handleSpeedChange(spd)}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition ${
                        stats.speedMultiplier === spd 
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Playback Controls */}
          <Card title="Simulation Controls" subtitle="TraCI step execution & reset">
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  variant={stats.isPaused ? "primary" : "outline"}
                  onClick={handleTogglePlay}
                  className="flex-1 py-2"
                >
                  {stats.isPaused ? (
                    <>
                      <Play className="h-4 w-4 text-emerald-400 fill-emerald-400/30" />
                      <span>Resume</span>
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 text-orange-400 fill-orange-400/30" />
                      <span>Pause</span>
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleStep}
                  disabled={!stats.isPaused}
                  className="flex-1 py-2"
                >
                  <SkipForward className="h-4 w-4" />
                  <span>Step (0.1s)</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="p-2 border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white"
                  title="Reset Corridor Simulation"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Center/Right Column: Canvas & Intelligence Panels */}
        <div className="lg:col-span-2 space-y-6">
          <Card 
            title="SUMO Micro-Simulation Corridor Grid" 
            subtitle="Surat 4-Junction Spine (Lane 0: Purple BRTS • Lane 1-2: General Mixed)"
            action={
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  onClick={resetViewport}
                  className="py-1.5 px-2.5 text-xs border-slate-800 hover:bg-slate-900 text-slate-300 flex items-center gap-1"
                  title="Fit Corridor View (Reset Scale & Center)"
                >
                  <Maximize2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Fit View</span>
                </Button>
              </div>
            }
          >
            <div 
              ref={containerRef}
              className="relative rounded-xl border border-slate-850 bg-slate-950 overflow-hidden select-none"
            >
              {/* Canvas Overlay Header */}
              <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 bg-slate-900/95 border border-slate-800 px-3 py-1.5 rounded-lg backdrop-blur-md text-[11px] text-slate-300 shadow-lg">
                <span className="font-semibold text-emerald-400">4 Active Junctions</span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>Car</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>Bike</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>BRTS Bus</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>Truck</span>
                <span className="text-slate-600">•</span>
                <span className="text-sky-400 font-medium">Scroll to Zoom • Drag to Pan</span>
              </div>

              <canvas
                ref={canvasRef}
                width={1000}
                height={500}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                className="w-full h-[500px] bg-[#0b0c13] block cursor-grab active:cursor-grabbing"
              />
            </div>
          </Card>

          {/* Signal Intelligence & Approach Metrics Split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Live Signal Intelligence Reasoning */}
            <Card title="Signal Intelligence Reasoning" subtitle={`Why ${selectedJunction} changed its phase`}>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-850">
                  <span className="text-xs font-bold text-white">{CORRIDOR_JUNCTIONS.find(j => j.id === selectedJunction)?.full}</span>
                  <Badge variant={activeIntel.phaseName.endsWith("GREEN") ? "success" : "warning"}>
                    {activeIntel.phaseName}
                  </Badge>
                </div>

                {/* Queue Pressure Comparison */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">East-West Pressure</span>
                    <span className="text-base font-extrabold text-cyan-400 mt-0.5 block font-mono">{activeIntel.ewPressure}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">North-South Pressure</span>
                    <span className="text-base font-extrabold text-orange-400 mt-0.5 block font-mono">{activeIntel.nsPressure}</span>
                  </div>
                </div>

                {/* Explainable Decision Text */}
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-850">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">TraCI Adaptive Decision</span>
                  <p className="text-xs text-emerald-400 font-medium leading-relaxed">{activeIntel.reason}</p>
                </div>
              </div>
            </Card>

            {/* 4-Way Approach Live Telemetry */}
            <Card title="4-Way Approach Metrics" subtitle={`Live SUMO sensors for ${selectedJunction}`}>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {['NORTH', 'SOUTH', 'EAST', 'WEST'].map((dir) => {
                  const app = activeIntel.approaches?.[dir] || { vehicles: 0, queue: 0, speed: 0, wait: 0, pressure: 0 };
                  return (
                    <div key={dir} className="p-2 rounded-lg bg-slate-950 border border-slate-850 space-y-1">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-white">{dir}</span>
                        <span className="text-emerald-400 font-mono">P: {app.pressure}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 space-y-0.5">
                        <div className="flex justify-between"><span>Vehicles:</span><span className="text-slate-200">{app.vehicles}</span></div>
                        <div className="flex justify-between"><span>Queue:</span><span className="text-rose-400 font-bold">{app.queue} veh</span></div>
                        <div className="flex justify-between"><span>Avg Speed:</span><span className="text-cyan-400">{app.speed} km/h</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Completion Modal Popup */}
      {showCompletionModal && completedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">5-Minute Simulation Complete</h3>
                <p className="text-xs text-slate-400">{completedReport.configuration.scenarioName}</p>
              </div>
            </div>

            {/* Performance Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Throughput</span>
                <span className="text-lg font-extrabold text-emerald-400">{completedReport.kpis.throughputVph} veh/hr</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Avg Speed</span>
                <span className="text-lg font-extrabold text-cyan-400">{completedReport.kpis.avgSpeedKmh} km/h</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Avg Delay</span>
                <span className="text-lg font-extrabold text-orange-400">{completedReport.kpis.avgWaitTimeSec}s</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Peak Queue</span>
                <span className="text-lg font-extrabold text-indigo-400">{completedReport.kpis.maxQueueVehicles} veh</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                onClick={() => {
                  setShowCompletionModal(false);
                  navigate('/analytics');
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 font-bold text-white flex items-center justify-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                <span>Open Full Analytics Report</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCompletionModal(false)}
                className="py-2.5 px-4 font-bold border-slate-700 text-slate-300"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
