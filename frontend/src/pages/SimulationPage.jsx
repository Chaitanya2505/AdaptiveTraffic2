import React, { useState, useEffect, useRef } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { 
  Play, 
  Pause, 
  SkipForward, 
  RefreshCw, 
  Clock, 
  Compass, 
  TrendingUp, 
  Terminal, 
  Activity 
} from 'lucide-react';

export default function SimulationPage() {
  // Stats
  const [stats, setStats] = useState({
    time: 0.0,
    activeVehicles: 0,
    avgSpeed: 0.0
  });

  // SUMO configuration states
  const [configState, setConfigState] = useState({
    isPaused: true,
    spawnRate: 30.0,
    speedMultiplier: 1.0,
    isManualTl: false
  });

  // Client-side states
  const [wsStatus, setWsStatus] = useState('connecting'); // connecting, connected, disconnected
  const [hasGeometry, setHasGeometry] = useState(false);
  const [tlsStates, setTlsStates] = useState({});
  const [logs, setLogs] = useState([]);

  // Refs for canvas and drawing
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const networkGeomRef = useRef(null);
  const simStateRef = useRef(null);
  const configStateRef = useRef({
    isPaused: true,
    spawnRate: 30.0,
    speedMultiplier: 1.0,
    isManualTl: false
  });

  // Canvas Viewport Refs
  const baseScaleRef = useRef(1.0);
  const zoomLevelRef = useRef(1.0);
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const centerOffsetRef = useRef({ x: 0, y: 0 });
  const networkBoundsRef = useRef({ minX: 0, maxX: 0, minY: 0, maxY: 0 });

  // Mouse Interaction Refs
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  // Logging system
  const logMessage = (text, type = 'system') => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => {
      const nextLogs = [...prev, { id: Date.now() + Math.random(), timestamp, text, type }];
      if (nextLogs.length > 50) {
        return nextLogs.slice(nextLogs.length - 50);
      }
      return nextLogs;
    });
  };

  // Coordinate transforms
  const worldToScreen = (wx, wy, canvas) => {
    const cx = canvas.width / 2 + panOffsetRef.current.x;
    const cy = canvas.height / 2 + panOffsetRef.current.y;
    
    const sx = cx + (wx - centerOffsetRef.current.x) * baseScaleRef.current * zoomLevelRef.current;
    const sy = cy - (wy - centerOffsetRef.current.y) * baseScaleRef.current * zoomLevelRef.current;
    return { x: sx, y: sy };
  };

  const resetViewport = () => {
    const canvas = canvasRef.current;
    if (!canvas || !networkGeomRef.current || networkGeomRef.current.lanes.length === 0) return;
    
    panOffsetRef.current = { x: 0, y: 0 };
    zoomLevelRef.current = 0.95;
    
    const minX = networkBoundsRef.current.minX;
    const maxX = networkBoundsRef.current.maxX;
    const minY = networkBoundsRef.current.minY;
    const maxY = networkBoundsRef.current.maxY;
    
    const w = maxX - minX;
    const h = maxY - minY;
    
    const pad = 60;
    const scaleX = (canvas.width - pad) / (w || 1);
    const scaleY = (canvas.height - pad) / (h || 1);
    baseScaleRef.current = Math.min(scaleX, scaleY);
    
    logMessage("Viewport reset to fit road network.", "system");
    draw();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Grid background
    drawGrid(ctx, canvas);
    
    if (!networkGeomRef.current) {
      ctx.fillStyle = "#8e9bb5";
      ctx.font = "14px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Waiting for simulation geometry...", canvas.width / 2, canvas.height / 2);
      return;
    }
    
    drawRoads(ctx, canvas);
    drawTrafficLights(ctx, canvas);
    drawVehicles(ctx, canvas);
  };

  const drawGrid = (ctx, canvas) => {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
    ctx.lineWidth = 1;
    
    const gridSpacing = 40 * zoomLevelRef.current;
    const startX = panOffsetRef.current.x % gridSpacing;
    const startY = panOffsetRef.current.y % gridSpacing;
    
    for (let x = startX; x < canvas.width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    for (let y = startY; y < canvas.height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  };

  const drawRoads = (ctx, canvas) => {
    const geom = networkGeomRef.current;
    if (!geom || !geom.lanes) return;
    
    // Draw outer asphalt
    geom.lanes.forEach(lane => {
      if (lane.shape.length < 2) return;
      
      ctx.beginPath();
      const start = worldToScreen(lane.shape[0][0], lane.shape[0][1], canvas);
      ctx.moveTo(start.x, start.y);
      
      for (let i = 1; i < lane.shape.length; i++) {
        const pt = worldToScreen(lane.shape[i][0], lane.shape[i][1], canvas);
        ctx.lineTo(pt.x, pt.y);
      }
      
      ctx.strokeStyle = "#1b1d28"; // Asphalt
      ctx.lineWidth = lane.width * baseScaleRef.current * zoomLevelRef.current;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    });
    
    // Draw lane lines
    geom.lanes.forEach(lane => {
      if (lane.shape.length < 2) return;
      
      const laneIdx = parseInt(lane.id.split('_').pop() || '0');
      
      ctx.beginPath();
      const start = worldToScreen(lane.shape[0][0], lane.shape[0][1], canvas);
      ctx.moveTo(start.x, start.y);
      
      for (let i = 1; i < lane.shape.length; i++) {
        const pt = worldToScreen(lane.shape[i][0], lane.shape[i][1], canvas);
        ctx.lineTo(pt.x, pt.y);
      }
      
      if (laneIdx === 0) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1.5 * zoomLevelRef.current;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1.0 * zoomLevelRef.current;
        ctx.setLineDash([4 * zoomLevelRef.current, 6 * zoomLevelRef.current]);
      }
      ctx.stroke();
    });
    
    ctx.setLineDash([]);
  };

  const drawTrafficLights = (ctx, canvas) => {
    const geom = networkGeomRef.current;
    const sim = simStateRef.current;
    if (!geom || !geom.trafficLights || !sim || !sim.tls) return;
    
    for (const [tlsId, tlsState] of Object.entries(sim.tls)) {
      const tlsConfig = geom.trafficLights[tlsId];
      if (!tlsConfig) continue;
      
      const stateStr = tlsState.state;
      for (let i = 0; i < stateStr.length; i++) {
        const char = stateStr[i];
        const controlled = tlsConfig.controlledLinks[i];
        if (!controlled || controlled.length === 0) continue;
        
        let color = "#ef4444"; // Red
        if (char === 'G' || char === 'g') {
          color = "#10b981"; // Green
        } else if (char === 'Y' || char === 'y') {
          color = "#f59e0b"; // Yellow
        }
        
        controlled.forEach(link => {
          const laneId = link.incoming;
          const lane = geom.lanes.find(l => l.id === laneId);
          if (!lane || lane.shape.length < 2) return;
          
          const lastIdx = lane.shape.length - 1;
          const stopPt = lane.shape[lastIdx];
          
          const screenPt = worldToScreen(stopPt[0], stopPt[1], canvas);
          
          ctx.beginPath();
          ctx.arc(screenPt.x, screenPt.y, 2.5 * baseScaleRef.current * zoomLevelRef.current, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          
          ctx.beginPath();
          ctx.arc(screenPt.x, screenPt.y, 4.5 * baseScaleRef.current * zoomLevelRef.current, 0, 2 * Math.PI);
          ctx.strokeStyle = color + "44";
          ctx.lineWidth = 2 * zoomLevelRef.current;
          ctx.stroke();
        });
      }
    }
  };

  const drawVehicles = (ctx, canvas) => {
    const sim = simStateRef.current;
    if (!sim || !sim.vehicles) return;
    
    sim.vehicles.forEach(veh => {
      const screenPt = worldToScreen(veh.x, veh.y, canvas);
      const wLen = veh.length * baseScaleRef.current * zoomLevelRef.current;
      const wWid = veh.width * baseScaleRef.current * zoomLevelRef.current;
      const canvasAngleRad = (veh.angle - 90) * Math.PI / 180;
      
      ctx.save();
      ctx.translate(screenPt.x, screenPt.y);
      ctx.rotate(canvasAngleRad);
      
      let color = "#06b6d4"; // Default cyan (car)
      if (veh.type === "truck") {
        color = "#eab308"; // Yellow
      } else if (veh.type === "bus") {
        color = "#f97316"; // Orange
      }
      
      ctx.shadowColor = color;
      ctx.shadowBlur = 6 * zoomLevelRef.current;
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-wLen / 2, -wWid / 2, wLen, wWid, 2 * zoomLevelRef.current);
      ctx.fill();
      
      ctx.shadowBlur = 0;
      
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      if (veh.type === "truck") {
        ctx.fillRect(wLen / 4, -wWid / 2.2, wLen / 5, wWid / 1.1);
      } else if (veh.type === "bus") {
        for (let ox = -wLen / 2.5; ox < wLen / 2; ox += wLen / 5) {
          ctx.fillRect(ox, -wWid / 2.2, wLen / 12, wWid / 1.1);
        }
      } else {
        ctx.fillRect(wLen / 8, -wWid / 2.4, wLen / 5, wWid / 1.2);
        ctx.fillRect(-wLen / 3, -wWid / 2.4, wLen / 8, wWid / 1.2);
      }
      
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(wLen / 2, -wWid / 3, 1 * zoomLevelRef.current, 0, 2 * Math.PI);
      ctx.arc(wLen / 2, wWid / 3, 1 * zoomLevelRef.current, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.restore();
      
      if (zoomLevelRef.current > 1.2) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.font = `${9 * zoomLevelRef.current}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(veh.id, screenPt.x, screenPt.y - wWid - 4);
      }
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
      
      logMessage("Connecting to SUMO backend WebSocket...", "system");
      setWsStatus('connecting');
      
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        if (!isMounted) return;
        setWsStatus('connected');
        logMessage("WebSocket connected successfully.", "success");
      };
      
      ws.onclose = () => {
        if (!isMounted) return;
        setWsStatus('disconnected');
        logMessage("WebSocket disconnected. Retrying in 2 seconds...", "error");
        simStateRef.current = null;
        setHasGeometry(false);
        draw();
        reconnectTimer = setTimeout(connect, 2000);
      };
      
      ws.onerror = (err) => {
        logMessage("WebSocket error encountered.", "error");
      };
      
      ws.onmessage = (event) => {
        if (!isMounted) return;
        const msg = JSON.parse(event.data);
        
        if (msg.type === "geometry") {
          networkGeomRef.current = msg.data;
          setHasGeometry(true);
          logMessage(`Loaded SUMO road network: ${msg.data.lanes.length} lanes, ${msg.data.nodes.length} nodes.`, "success");
          
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          msg.data.lanes.forEach(lane => {
            lane.shape.forEach(pt => {
              const x = pt[0];
              const y = pt[1];
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            });
          });
          
          networkBoundsRef.current = { minX, maxX, minY, maxY };
          centerOffsetRef.current = {
            x: (minX + maxX) / 2 || 0,
            y: (minY + maxY) / 2 || 0
          };
          
          resetViewport();
        } else if (msg.type === "config") {
          configStateRef.current = msg.data;
          setConfigState(msg.data);
        } else if (msg.type === "state") {
          simStateRef.current = msg.data;
          setStats({
            time: msg.data.time,
            activeVehicles: msg.data.stats.activeVehicles,
            avgSpeed: msg.data.stats.avgSpeed
          });
          setTlsStates(msg.data.tls);
          draw();
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

  // Canvas Resize Handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = 480;
      draw();
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [hasGeometry]);

  // Canvas Wheel zoom listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const handleWheelEvent = (e) => {
      e.preventDefault();
      const zoomFactor = 1.15;
      const oldZoom = zoomLevelRef.current;
      
      if (e.deltaY < 0) {
        zoomLevelRef.current = Math.min(30.0, zoomLevelRef.current * zoomFactor);
      } else {
        zoomLevelRef.current = Math.max(0.1, zoomLevelRef.current / zoomFactor);
      }
      
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      
      panOffsetRef.current = {
        x: mx - canvas.width / 2 - (mx - canvas.width / 2 - panOffsetRef.current.x) * (zoomLevelRef.current / oldZoom),
        y: my - canvas.height / 2 - (my - canvas.height / 2 - panOffsetRef.current.y) * (zoomLevelRef.current / oldZoom)
      };
      
      draw();
    };
    
    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheelEvent);
    };
  }, []);

  // Mouse Drag Listeners
  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...panOffsetRef.current };
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    panOffsetRef.current = {
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy
    };
    draw();
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // WebSocket Controls sending
  const sendControlMessage = (obj) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(obj));
    } else {
      logMessage("Cannot send control action. WebSocket disconnected.", "error");
    }
  };

  const handleTogglePlay = () => {
    if (configState.isPaused) {
      sendControlMessage({ type: "resume" });
      logMessage("Simulation resumed by operator.", "system");
    } else {
      sendControlMessage({ type: "pause" });
      logMessage("Simulation paused by operator.", "system");
    }
  };

  const handleStep = () => {
    sendControlMessage({ type: "step" });
    logMessage("Stepped simulation (0.1s).", "system");
  };

  const handleSpawnRateChange = (e) => {
    const val = parseFloat(e.target.value);
    setConfigState(prev => ({ ...prev, spawnRate: val }));
  };

  const handleSpawnRateCommit = (e) => {
    const val = parseFloat(e.target.value);
    sendControlMessage({ type: "set_spawn_rate", value: val });
    logMessage(`Updated spawn rate to ${val} vehicles/minute.`, "system");
  };

  const handleSpeedMultiplierChange = (e) => {
    const val = parseFloat(e.target.value);
    setConfigState(prev => ({ ...prev, speedMultiplier: val }));
  };

  const handleSpeedMultiplierCommit = (e) => {
    const val = parseFloat(e.target.value);
    sendControlMessage({ type: "set_speed_multiplier", value: val });
    logMessage(`Updated simulation speed multiplier to ${val.toFixed(1)}x.`, "system");
  };

  const handleTlModeToggle = (e) => {
    const mode = e.target.checked ? "manual" : "auto";
    sendControlMessage({ type: "set_tl_mode", mode: mode });
    logMessage(`Traffic light controller set to ${mode.toUpperCase()} mode.`, "system");
  };

  const handleSelectPhase = (tlsId, index) => {
    sendControlMessage({
      type: "set_tl_phase",
      tlsId: tlsId,
      phaseIndex: index
    });
    logMessage(`Overrode TLS ${tlsId} phase to Phase ${index}.`, "system");
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <span>🚦</span> Real-time SUMO Micro-Simulation
        </h2>
        <p className="text-xs text-slate-500 font-medium">
          Control, modify parameters, and visualize Eclipse SUMO traffic flows and signals dynamically over WebSockets
        </p>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Simulation Time</span>
            <span className="text-xl font-extrabold text-white">{stats.time.toFixed(1)}s</span>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-900/30 text-emerald-400">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Active Vehicles</span>
            <span className="text-xl font-extrabold text-white">{stats.activeVehicles}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-900/30 text-cyan-400">
            <Compass className="h-5 w-5 animate-pulse" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Average Speed</span>
            <span className="text-xl font-extrabold text-white">{(stats.avgSpeed * 3.6).toFixed(1)} km/h</span>
          </div>
          <div className="p-2.5 rounded-lg bg-orange-950/30 border border-orange-900/30 text-orange-400">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Grid: Controls vs Visualizer */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Controls Column */}
        <div className="space-y-6 lg:col-span-1">
          {/* Simulation Controls */}
          <Card title="Simulation Controls" subtitle="Execute and manipulate TraCI stepping">
            <div className="space-y-5">
              <div className="flex gap-2">
                <Button
                  variant={configState.isPaused ? "primary" : "outline"}
                  onClick={handleTogglePlay}
                  className="flex-1 py-2"
                >
                  {configState.isPaused ? (
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
                  disabled={!configState.isPaused}
                  className="flex-1 py-2"
                >
                  <SkipForward className="h-4 w-4" />
                  <span>Step</span>
                </Button>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">WebSocket Connection</span>
                {wsStatus === 'connected' ? (
                  <Badge variant="success">Connected</Badge>
                ) : wsStatus === 'connecting' ? (
                  <Badge variant="warning">Connecting</Badge>
                ) : (
                  <Badge variant="danger">Disconnected</Badge>
                )}
              </div>
            </div>
          </Card>

          {/* Parameters */}
          <Card title="Flow Parameters" subtitle="Configure microscopic parameters">
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span className="text-slate-400 uppercase tracking-wider">Vehicle Spawn Rate</span>
                  <span className="text-white font-bold">{configState.spawnRate} veh/min</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="5"
                  value={configState.spawnRate}
                  onChange={handleSpawnRateChange}
                  onMouseUp={handleSpawnRateCommit}
                  onTouchEnd={handleSpawnRateCommit}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span className="text-slate-400 uppercase tracking-wider">Simulation Speed</span>
                  <span className="text-white font-bold">{configState.speedMultiplier.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="5.0"
                  step="0.1"
                  value={configState.speedMultiplier}
                  onChange={handleSpeedMultiplierChange}
                  onMouseUp={handleSpeedMultiplierCommit}
                  onTouchEnd={handleSpeedMultiplierCommit}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>
          </Card>

          {/* Traffic Light Mode */}
          <Card title="Signal Controller" subtitle="Override traffic light scheduling">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-900 bg-slate-950">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Controller Mode</span>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold ${configState.isManualTl ? 'text-orange-400' : 'text-emerald-400'}`}>
                    {configState.isManualTl ? 'MANUAL' : 'AUTO'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={configState.isManualTl}
                      onChange={handleTlModeToggle}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-emerald-500/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white peer-checked:after:border-transparent"></div>
                  </label>
                </div>
              </div>

              {configState.isManualTl && networkGeomRef.current?.trafficLights && (
                <div className="space-y-3 pt-2 border-t border-slate-900 animate-fadeIn">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Phase Selection</span>
                  {Object.entries(networkGeomRef.current.trafficLights).map(([tlsId, info]) => (
                    <div key={tlsId} className="space-y-2">
                      <span className="text-[10px] text-slate-400 font-bold block">Junction TLS: {tlsId}</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {info.phases.map((phase, idx) => {
                          const isActive = tlsStates[tlsId]?.phase === idx;
                          return (
                            <button
                              key={idx}
                              onClick={() => handleSelectPhase(tlsId, idx)}
                              className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all truncate ${
                                isActive 
                                  ? 'bg-orange-500/20 border-orange-500 text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.15)]'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
                              }`}
                              title={`State: ${phase.state} (${phase.duration}s)`}
                            >
                              Phase {idx}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Visualizer Column */}
        <div className="lg:col-span-2 space-y-6">
          <Card 
            title="SUMO Micro-Simulation Grid" 
            subtitle="Real-time rendered vehicular nodes and edges"
            action={
              <Button
                variant="outline"
                onClick={resetViewport}
                className="p-2 border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white"
                title="Reset Viewport"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            }
          >
            <div className="relative rounded-xl border border-slate-850 bg-slate-950 overflow-hidden select-none">
              <div className="absolute top-4 left-4 z-10 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg backdrop-blur-md">
                <span className="text-[10px] text-slate-400 font-medium">Drag to Pan • Scroll to Zoom</span>
              </div>
              
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="w-full h-[480px] bg-[#0b0c13] block cursor-grab active:cursor-grabbing"
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Details Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Traffic Light States */}
        <Card title="Traffic Light Signal States" subtitle="Active phases and monitored junctions">
          <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
            {Object.keys(tlsStates).length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                Waiting for simulation active traffic light states...
              </div>
            ) : (
              Object.entries(tlsStates).map(([tlsId, info]) => {
                const hasRed = info.state.includes('r') || info.state.includes('R') || info.state.includes('u');
                const hasYellow = info.state.includes('y') || info.state.includes('Y');
                const hasGreen = info.state.includes('g') || info.state.includes('G');

                return (
                  <div key={tlsId} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-900 bg-slate-950/40">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-white block">TLS Node: {tlsId}</span>
                      <span className="text-[10px] text-slate-500 font-medium block">
                        Phase {info.phase} • Active: <code className="text-slate-300 bg-slate-900 px-1 py-0.5 rounded font-mono">{info.state}</code>
                      </span>
                    </div>
                    
                    <div className="flex gap-2 bg-slate-900 border border-slate-800/80 px-4 py-2 rounded-xl">
                      {/* Red */}
                      <span className={`w-3.5 h-3.5 rounded-full border border-black/40 transition-all ${
                        hasRed 
                          ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' 
                          : 'bg-red-950/20'
                      }`} />
                      {/* Yellow */}
                      <span className={`w-3.5 h-3.5 rounded-full border border-black/40 transition-all ${
                        hasYellow 
                          ? 'bg-yellow-500 shadow-[0_0_10px_#eab308]' 
                          : 'bg-yellow-950/20'
                      }`} />
                      {/* Green */}
                      <span className={`w-3.5 h-3.5 rounded-full border border-black/40 transition-all ${
                        hasGreen 
                          ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' 
                          : 'bg-emerald-950/20'
                      }`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Live Logs */}
        <Card title="TraCI Output Live Log" subtitle="Real-time terminal stream from Eclipse SUMO API">
          <div className="rounded-xl border border-slate-900 bg-slate-950 p-4">
            <div className="flex items-center gap-2 mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <Terminal className="h-3.5 w-3.5" />
              <span>Operator console</span>
            </div>
            
            <div className="h-36 overflow-y-auto font-mono text-[10px] space-y-1.5 pr-2 select-text">
              {logs.length === 0 ? (
                <div className="text-slate-600 italic">No output logged yet...</div>
              ) : (
                logs.map(log => {
                  let colorClass = 'text-slate-400';
                  if (log.type === 'success') colorClass = 'text-emerald-400';
                  if (log.type === 'error') colorClass = 'text-red-400';
                  
                  return (
                    <div key={log.id} className="flex gap-2 leading-relaxed">
                      <span className="text-slate-600">[{log.timestamp}]</span>
                      <span className={colorClass}>{log.text}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
