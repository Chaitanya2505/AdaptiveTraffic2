import React, { useState, useEffect } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { useApi } from '../hooks/useApi';
import { useDataStore } from '../store/dataStore';
import { 
  MapPin, 
  Timer, 
  ShieldAlert, 
  CheckCircle2, 
  Play, 
  ArrowUp, 
  ArrowDown, 
  ArrowRight, 
  ArrowLeft,
  Activity,
  Radio,
  ScanLine
} from 'lucide-react';

const PRESET_DURATIONS = [15, 30, 45, 60, 90, 120];

const SIGNAL_PHASES = [
  { id: 'LANE_1_NORTH', label: 'Lane 1 - Northbound', icon: ArrowUp, desc: 'Northbound approach lane' },
  { id: 'LANE_2_SOUTH', label: 'Lane 2 - Southbound', icon: ArrowDown, desc: 'Southbound approach lane' },
  { id: 'LANE_3_EAST', label: 'Lane 3 - Eastbound', icon: ArrowRight, desc: 'Eastbound approach lane' },
  { id: 'LANE_4_WEST', label: 'Lane 4 - Westbound', icon: ArrowLeft, desc: 'Westbound approach lane' }
];

export default function SignalsPage() {
  const junctions = useDataStore((state) => state.junctions);
  const visionSignalState = useDataStore((state) => state.visionSignalState);
  const setVisionSignalState = useDataStore((state) => state.setVisionSignalState);

  const [selectedJunction, setSelectedJunction] = useState('J-001');

  // Target phase & duration
  const [targetPhase, setTargetPhase] = useState('LANE_1_NORTH');
  const [manualDuration, setManualDuration] = useState(30);

  const [history, setHistory] = useState([]);
  const [telemetry, setTelemetry] = useState({});
  const { loading, request } = useApi();
  const updateSignal = useDataStore((state) => state.updateSignal);

  const currentJunctionObj = junctions.find((j) => j.id === selectedJunction) || junctions[0];

  // Fetch signal history for selected junction
  const fetchSignalHistory = async () => {
    try {
      const data = await request('get', `/signals/${selectedJunction}/history?limit=15`);
      setHistory(data);
    } catch (err) {
      simulateOfflineHistory();
    }
  };

  useEffect(() => {
    fetchSignalHistory();
  }, [selectedJunction]);

  // Dynamic Telemetry Polling
  useEffect(() => {
    let isSubscribed = true;
    const fetchTelemetry = async () => {
      try {
        const data = await request('get', `/junctions/${selectedJunction}/status`);
        if (isSubscribed && data && data.lane_queues) {
          const newTelemetry = {};
          data.lane_queues.forEach(lq => {
            const laneMap = { 'L1': 'LANE_1_NORTH', 'L2': 'LANE_2_SOUTH', 'L3': 'LANE_3_EAST', 'L4': 'LANE_4_WEST' };
            const mappedId = laneMap[lq.lane_id];
            if (mappedId) {
              newTelemetry[mappedId] = {
                vehicles: lq.vehicle_count,
                meters: lq.queue_meters,
                cars: 'N/A', bikes: 'N/A', autos: 'N/A', buses: 'N/A', trucks: 'N/A'
              };
            }
          });
          setTelemetry(newTelemetry);
        }
      } catch (err) {
        if (isSubscribed) setTelemetry({});
      }
    };
    
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 5000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [selectedJunction]);

  const simulateOfflineHistory = () => {
    setHistory([
      { id: 201, junction_id: selectedJunction, phase: 'LANE_1_NORTH', duration: 35, mode: 'VISION_AI', timestamp: new Date(Date.now() - 45000).toISOString() },
      { id: 202, junction_id: selectedJunction, phase: 'LANE_3_EAST', duration: 50, mode: 'VISION_AI', timestamp: new Date(Date.now() - 180000).toISOString() },
      { id: 203, junction_id: selectedJunction, phase: 'ALL_RED', duration: 30, mode: 'MANUAL', timestamp: new Date(Date.now() - 420000).toISOString() }
    ]);
  };

  // Current live active state
  const activePhase = visionSignalState?.activeLaneId || 'LANE_1_NORTH';
  const remainingSec = visionSignalState?.remainingSec ?? 35;
  const lightColor = visionSignalState?.lightColor || 'GREEN';
  const masterMode = visionSignalState?.masterMode || 'DYNAMIC_CYCLE';
  const statusMessage = visionSignalState?.statusMessage || 'Vision AI Dynamic Cycle Active';

  // Live Countdown Sequence Engine
  useEffect(() => {
    const timer = setInterval(() => {
      setVisionSignalState((prev) => {
        if (!prev.isAutoCycleActive) return prev;

        if (prev.remainingSec > 0) {
          return { ...prev, remainingSec: prev.remainingSec - 1 };
        }

        // Time's up
        if (prev.masterMode === 'ALL_RED_HOLD' || prev.masterMode === 'ALL_GREEN_HOLD') {
          // Resume normal cycle at Lane 1
          const l1Duration = prev.laneTimers?.['LANE_1_NORTH']?.duration || 30;
          return {
            ...prev,
            masterMode: 'DYNAMIC_CYCLE',
            activeLaneId: 'LANE_1_NORTH',
            activeLaneIndex: 0,
            lightColor: 'GREEN',
            remainingSec: l1Duration,
            totalDuration: l1Duration,
            statusMessage: 'Vision AI Dynamic Cycle Resumed'
          };
        }

        if (prev.masterMode === 'DYNAMIC_CYCLE') {
          if (prev.lightColor === 'GREEN') {
            // Transition to Yellow
            return { ...prev, lightColor: 'YELLOW', remainingSec: 3 };
          } else {
            // Move to next lane
            const phases = ['LANE_1_NORTH', 'LANE_2_SOUTH', 'LANE_3_EAST', 'LANE_4_WEST'];
            let nextIndex = (phases.indexOf(prev.activeLaneId) + 1) % 4;
            
            // Skip lanes with duration 0 (set to RED)
            let attempts = 0;
            while ((prev.laneTimers?.[phases[nextIndex]]?.duration || 0) <= 0 && attempts < 4) {
              nextIndex = (nextIndex + 1) % 4;
              attempts++;
            }
            
            const nextLane = phases[nextIndex];
            const nextDuration = prev.laneTimers?.[nextLane]?.duration || 30;

            return {
              ...prev,
              activeLaneId: nextLane,
              activeLaneIndex: nextIndex,
              lightColor: 'GREEN',
              remainingSec: nextDuration,
              totalDuration: nextDuration
            };
          }
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [setVisionSignalState]);

  // Set single lane Green duration
  const handleSetGreen = (laneId) => {
    const durNum = manualDuration || 30;
    setVisionSignalState(prev => {
      const updatedTimers = { ...prev.laneTimers, [laneId]: { ...prev.laneTimers?.[laneId], duration: durNum } };
      // If it's currently active and GREEN, update its remaining time immediately
      if (prev.activeLaneId === laneId && prev.lightColor === 'GREEN' && prev.masterMode === 'DYNAMIC_CYCLE') {
         return {
           ...prev,
           laneTimers: updatedTimers,
           remainingSec: durNum,
           totalDuration: durNum
         };
      }
      return { ...prev, laneTimers: updatedTimers };
    });
    handleApplyOverride(laneId, durNum);
  };

  // Set single lane to skip (Red)
  const handleSetRed = (laneId) => {
    setVisionSignalState(prev => {
      if (prev.activeLaneId === laneId && prev.masterMode === 'DYNAMIC_CYCLE') {
         // Force current turn to end instantly
         return { ...prev, remainingSec: 0 };
      }
      const updatedTimers = { ...prev.laneTimers, [laneId]: { ...prev.laneTimers?.[laneId], duration: 0 } };
      return { ...prev, laneTimers: updatedTimers };
    });
    handleApplyOverride(laneId, 0);
  };

  // Start sequence from specific lane
  const handleStartSignal = (laneId) => {
    setTargetPhase(laneId);
    setVisionSignalState(prev => {
      const nextDuration = prev.laneTimers?.[laneId]?.duration || 30;
      return {
        ...prev,
        activeLaneId: laneId,
        activeLaneIndex: ['LANE_1_NORTH', 'LANE_2_SOUTH', 'LANE_3_EAST', 'LANE_4_WEST'].indexOf(laneId),
        remainingSec: nextDuration,
        totalDuration: nextDuration,
        lightColor: 'GREEN',
        masterMode: 'DYNAMIC_CYCLE',
        statusMessage: `Manual Start for ${laneId.replace(/_/g, ' ')}`,
        isAutoCycleActive: true
      };
    });
    // We should safely try to read duration via a separate reference since state update is async, 
    // but we can just use the fallback 30 here and wait for react cycle. 
    // Wait, the API call should use the duration.
    // We'll just fetch from current store.
    const currentDur = useDataStore.getState().visionSignalState?.laneTimers?.[laneId]?.duration || 30;
    handleApplyOverride(laneId, currentDur);
  };

  // Master Global controls: ALL RED or ALL GREEN
  const handleSetAllLanes = (targetColor) => {
    const holdSec = manualDuration || 15;

    if (targetColor === 'GREEN') {
      setVisionSignalState({
        activeLaneId: 'ALL_GREEN',
        remainingSec: holdSec,
        totalDuration: holdSec,
        lightColor: 'GREEN',
        masterMode: 'ALL_GREEN_HOLD',
        statusMessage: `FORCE ALL GREEN ACTIVE (${holdSec}s Hold)`,
        isAutoCycleActive: true
      });
      handleApplyOverride('ALL_GREEN', holdSec);
    } else {
      setVisionSignalState({
        activeLaneId: 'ALL_RED',
        remainingSec: 15,
        totalDuration: 15,
        lightColor: 'RED',
        masterMode: 'ALL_RED_HOLD',
        statusMessage: 'EMERGENCY ALL RED ACTIVE (15s Clearance Hold)',
        isAutoCycleActive: true
      });
      handleApplyOverride('ALL_RED', 15);
    }
  };

  // Resume Vision Sensing Auto Stream Cycle
  const handleResumeVisionAutoCycle = () => {
    const l1Duration = visionSignalState?.laneTimers?.['LANE_1_NORTH']?.duration || 35;
    setVisionSignalState({
      activeLaneId: 'LANE_1_NORTH',
      activeLaneIndex: 0,
      remainingSec: l1Duration,
      totalDuration: l1Duration,
      lightColor: 'GREEN',
      masterMode: 'DYNAMIC_CYCLE',
      statusMessage: 'Vision AI Dynamic Cycle Resumed',
      isAutoCycleActive: true
    });
  };

  const handleApplyOverride = async (phaseToApply = targetPhase, durationToApply = manualDuration) => {
    const durNum = parseInt(durationToApply) || 30;

    try {
      const result = await request('post', `/signals/${selectedJunction}/apply`, {
        phase: phaseToApply,
        duration: durNum,
        mode: 'MANUAL'
      });

      updateSignal(result);
      fetchSignalHistory();
    } catch (err) {
      const mockResult = {
        id: Date.now(),
        junction_id: selectedJunction,
        phase: phaseToApply,
        duration: durNum,
        mode: 'MANUAL',
        timestamp: new Date().toISOString()
      };
      updateSignal(mockResult);
      setHistory((prev) => [mockResult, ...prev]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar with Junction Selector */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 shadow-lg flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Manual Signal Control</h2>
            <Badge variant={masterMode === 'DYNAMIC_CYCLE' ? 'success' : masterMode === 'SCANNING_TRAFFIC' ? 'info' : 'warning'} className="text-[10px] flex items-center gap-1">
              <Radio className="h-3 w-3 animate-pulse text-emerald-400" />
              {masterMode === 'ALL_GREEN_HOLD' ? 'ALL GREEN HOLD ACTIVE' :
               masterMode === 'ALL_RED_HOLD' ? 'EMERGENCY ALL RED HOLD' :
               masterMode === 'SCANNING_TRAFFIC' ? 'SCANNING TRAFFIC DENSITY...' :
               'SYNCED WITH VISION SENSING CCTV STREAM'}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            {statusMessage}
          </p>
        </div>

        {/* Junction Selector & Auto Stream Resume */}
        <div className="flex flex-wrap items-center gap-3">
          {masterMode !== 'DYNAMIC_CYCLE' && (
            <button
              type="button"
              onClick={handleResumeVisionAutoCycle}
              className="py-2 px-3 rounded-lg border border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
            >
              <Activity className="h-3.5 w-3.5" />
              Resume Vision AI Cycle
            </button>
          )}

          <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5">
            <MapPin className="h-4 w-4 text-emerald-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Select Junction</span>
              <select
                value={selectedJunction}
                onChange={(e) => setSelectedJunction(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-100 outline-none cursor-pointer"
              >
                {junctions.map((j) => (
                  <option key={j.id} value={j.id} className="bg-slate-900 text-slate-100">
                    {j.name} ({j.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Live Physical Traffic Light Head Monitor */}
        <div className="space-y-6 lg:col-span-1">
          {/* Physical Traffic Light State Monitor */}
          <Card title="Live Traffic Light Monitor" subtitle={`Real-time signal head at ${currentJunctionObj?.name}`}>
            <div className="flex flex-col items-center justify-center p-6 space-y-6 bg-slate-950 border border-slate-900 rounded-xl">
              {/* Traffic Light Housing */}
              <div className="w-24 bg-slate-900 border-4 border-slate-800 rounded-3xl p-4 flex flex-col items-center gap-4 shadow-2xl relative">
                {/* Red Light */}
                <div className={`w-14 h-14 rounded-full border-2 border-black/40 transition-all duration-300 flex items-center justify-center ${
                  lightColor === 'RED'
                    ? 'bg-red-500 shadow-[0_0_25px_#ef4444] border-red-300 animate-pulse'
                    : 'bg-red-950/30'
                }`}>
                  {lightColor === 'RED' && (
                    <span className="text-white text-xs font-black font-mono">{remainingSec}s</span>
                  )}
                </div>

                {/* Orange / Yellow Light */}
                <div className={`w-14 h-14 rounded-full border-2 border-black/40 transition-all duration-300 flex items-center justify-center ${
                  lightColor === 'YELLOW' || masterMode === 'SCANNING_TRAFFIC'
                    ? 'bg-amber-400 shadow-[0_0_25px_#f59e0b] border-amber-200 animate-pulse'
                    : 'bg-amber-950/30'
                }`}>
                  {(lightColor === 'YELLOW' || masterMode === 'SCANNING_TRAFFIC') && (
                    <span className="text-black text-xs font-black font-mono">{remainingSec}s</span>
                  )}
                </div>

                {/* Green Light */}
                <div className={`w-14 h-14 rounded-full border-2 border-black/40 transition-all duration-300 flex items-center justify-center ${
                  lightColor === 'GREEN' && masterMode !== 'SCANNING_TRAFFIC'
                    ? 'bg-emerald-500 shadow-[0_0_25px_#10b981] border-emerald-300'
                    : 'bg-emerald-950/30'
                }`}>
                  {lightColor === 'GREEN' && masterMode !== 'SCANNING_TRAFFIC' && (
                    <span className="text-white text-xs font-black font-mono">{remainingSec}s</span>
                  )}
                </div>
              </div>

              {/* Status Text & Dynamic Color Badge */}
              <div className="text-center space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Current Signal Light Status</span>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    masterMode === 'SCANNING_TRAFFIC' ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-ping' :
                    lightColor === 'GREEN' ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' :
                    lightColor === 'YELLOW' ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' :
                    'bg-red-500 shadow-[0_0_8px_#ef4444]'
                  }`} />
                  <span className="text-xs font-extrabold text-white tracking-wide uppercase">
                    {masterMode === 'SCANNING_TRAFFIC' ? 'SCANNING CCTV FEEDS...' :
                     masterMode === 'ALL_GREEN_HOLD' ? 'ALL LANES GREEN (HOLD)' :
                     masterMode === 'ALL_RED_HOLD' ? 'ALL LANES RED (EMERGENCY)' :
                     lightColor === 'GREEN' ? 'GREEN LIGHT (GO)' :
                     lightColor === 'YELLOW' ? 'ORANGE LIGHT (SLOW DOWN)' :
                     'RED LIGHT (STOP)'}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-medium block pt-1">
                  Active State: <strong className="text-emerald-400">{masterMode === 'SCANNING_TRAFFIC' ? 'AI Scanning' : activePhase.replace(/_/g, ' ')}</strong>
                </span>
              </div>
            </div>
          </Card>

          {/* Instant Global Controls */}
          <Card title="Global Master Controls" subtitle="Master red / green switches with auto traffic scan & cycle resumption">
            <div className="space-y-3">
              <Button
                variant="danger"
                icon={ShieldAlert}
                onClick={() => handleSetAllLanes('RED')}
                className="w-full py-3 text-xs font-bold shadow-lg"
              >
                🔴 FORCE ALL 4 LANES RED (Emergency Stop)
              </Button>

              <button
                type="button"
                onClick={() => handleSetAllLanes('GREEN')}
                className="w-full py-3 px-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md"
              >
                🟢 FORCE ALL 4 LANES GREEN (Open Intersection)
              </button>
            </div>
          </Card>
        </div>

        {/* Center & Right Columns: 4 Lane Direct Manual Light Matrix & Vision Telemetry */}
        <div className="space-y-6 lg:col-span-2">
          {/* 4-Lane Direct Manual Light Switches */}
          <Card 
            title="4-Lane Direct Manual Light Switches" 
            subtitle="Synced live telemetry from Vision Sensing: vehicle breakdown, queue tailbacks, and dynamic timers"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SIGNAL_PHASES.map((p) => {
                const IconComponent = p.icon;
                const isCurrentActive = activePhase === p.id && masterMode === 'DYNAMIC_CYCLE';
                const isAllGreenMode = masterMode === 'ALL_GREEN_HOLD';
                const isAllRedMode = masterMode === 'ALL_RED_HOLD';
                const isScanning = masterMode === 'SCANNING_TRAFFIC';
                const isWaiting = masterMode === 'WAITING';
                
                // Fetch dynamic telemetry or fallback to N/A
                const laneTelemetry = telemetry[p.id];
                const displayData = {
                  vehicles: laneTelemetry?.vehicles ?? 'N/A',
                  meters: laneTelemetry?.meters ?? 'N/A',
                  duration: visionSignalState?.laneTimers?.[p.id]?.duration ?? 'N/A',
                  cars: laneTelemetry?.cars ?? 'N/A',
                  bikes: laneTelemetry?.bikes ?? 'N/A',
                  autos: laneTelemetry?.autos ?? 'N/A',
                  buses: laneTelemetry?.buses ?? 'N/A',
                  trucks: laneTelemetry?.trucks ?? 'N/A'
                };

                let currentLight = 'RED';
                if (isAllGreenMode) {
                  currentLight = 'GREEN';
                } else if (isAllRedMode || isWaiting) {
                  currentLight = 'RED';
                } else if (isScanning) {
                  currentLight = 'YELLOW';
                } else if (isCurrentActive) {
                  currentLight = lightColor;
                }

                const isGreen = currentLight === 'GREEN';
                const isYellow = currentLight === 'YELLOW';

                return (
                  <div
                    key={p.id}
                    onClick={() => setTargetPhase(p.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      isCurrentActive || isAllGreenMode
                        ? isGreen
                          ? 'border-emerald-500 bg-emerald-950/20 shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-2 ring-emerald-500/40'
                          : isYellow
                          ? 'border-amber-500 bg-amber-950/20 shadow-[0_0_20px_rgba(245,158,11,0.25)] ring-2 ring-amber-500/40'
                          : 'border-red-500 bg-red-950/20 ring-2 ring-red-500/40'
                        : 'border-slate-800 bg-slate-900/50 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg ${isGreen ? 'bg-emerald-500/20 text-emerald-400' : isYellow ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block">{p.label}</span>
                          <span className="text-[10px] text-slate-500">{p.desc}</span>
                        </div>
                      </div>

                      {/* Current Light Badge */}
                      <Badge variant={isGreen ? 'success' : isYellow ? 'warning' : 'danger'}>
                        {isScanning ? '🔍 SCANNING...' : isGreen ? `🟢 GREEN (${remainingSec}s)` : isYellow ? `🟡 ORANGE (${remainingSec}s)` : '🔴 RED'}
                      </Badge>
                    </div>

                    {/* Vision Sensing Synced Telemetry Display */}
                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-850 space-y-2">
                      <div className="flex items-center justify-between text-xs text-white">
                        <span>Total Vehicles: <strong className="text-emerald-400 font-mono">{displayData.vehicles !== 'N/A' ? `${displayData.vehicles} veh` : 'No data'}</strong></span>
                        <span>Queue: <strong className="text-cyan-400 font-mono">{displayData.meters !== 'N/A' ? `${displayData.meters}m` : 'No data'}</strong></span>
                        <span>Allocated Time: <strong className="text-amber-400 font-mono">{displayData.duration !== 'N/A' ? `${displayData.duration}s` : 'N/A'}</strong></span>
                      </div>

                      {/* Class breakdown icons */}
                      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-900 text-[10px] text-slate-400">
                        <span>🚗 Cars: <strong className="text-slate-200">{displayData.cars}</strong></span>
                        <span>🏍 2W: <strong className="text-slate-200">{displayData.bikes}</strong></span>
                        <span>🛺 Autos: <strong className="text-slate-200">{displayData.autos}</strong></span>
                        <span>🚌 Buses: <strong className="text-slate-200">{displayData.buses}</strong></span>
                        <span>🚚 Heavy: <strong className="text-slate-200">{displayData.trucks}</strong></span>
                      </div>
                    </div>

                    {/* Individual Manual Action Buttons */}
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-850">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSetGreen(p.id); }}
                        className={`py-2 px-1 rounded-lg font-extrabold text-[10px] transition-all border flex items-center justify-center ${
                          isGreen && isCurrentActive
                            ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                            : 'bg-emerald-950/30 text-emerald-400 border-emerald-900 hover:bg-emerald-500/20'
                        }`}
                      >
                        🟢 GREEN
                      </button>

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSetRed(p.id); }}
                        className={`py-2 px-1 rounded-lg font-extrabold text-[10px] transition-all border flex items-center justify-center ${
                          !isGreen && !isYellow && isCurrentActive
                            ? 'bg-red-600 text-white border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                            : 'bg-red-950/30 text-red-400 border-red-900 hover:bg-red-600/20'
                        }`}
                      >
                        🔴 RED
                      </button>
                      
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleStartSignal(p.id); }}
                        className={`py-2 px-1 rounded-lg font-extrabold text-[10px] transition-all border flex items-center justify-center bg-blue-950/30 text-blue-400 border-blue-900 hover:bg-blue-600/20`}
                      >
                        ▶️ START
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Custom Timer Configuration Card */}
          <Card title="Manual Signal Timer Duration Control" subtitle="Specify custom duration in seconds for manual green light overrides">
            <div className="space-y-4">
              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold mr-1">Presets:</span>
                {PRESET_DURATIONS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setManualDuration(sec)}
                    className={`px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                      manualDuration === sec
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-sm'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {sec} Seconds
                  </button>
                ))}
              </div>

              {/* Custom Number Input & Range Slider */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div className="sm:col-span-2">
                  <input
                    type="range"
                    min="5"
                    max="180"
                    step="5"
                    value={manualDuration}
                    onChange={(e) => setManualDuration(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                    <Timer className="h-4 w-4 text-emerald-400 shrink-0" />
                    <input
                      type="number"
                      min="5"
                      max="180"
                      value={manualDuration}
                      onChange={(e) => setManualDuration(parseInt(e.target.value) || 5)}
                      className="w-full bg-transparent text-sm font-extrabold text-white outline-none font-mono"
                    />
                    <span className="text-xs text-slate-500 font-bold">Sec</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Manual Timing History Logs Table */}
          <Card title="Manual & Vision Controller Log History" subtitle="Recent signal controller overrides logged for selected location">
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Target Signal Phase</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Control Mode</th>
                    <th className="py-2.5 px-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/50">
                  {history.map((h) => {
                    const isRed = h.phase === 'ALL_RED';
                    return (
                      <tr key={h.id} className="hover:bg-slate-900/30">
                        <td className="py-3 px-3 font-bold text-slate-200">
                          <span className={isRed ? 'text-red-400' : 'text-emerald-400'}>
                            {h.phase.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-white font-semibold">
                          {h.duration} Seconds
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant={isRed ? 'danger' : h.mode === 'VISION_AI' ? 'success' : 'warning'}>
                            {h.mode}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-right text-slate-400 font-mono">
                          {new Date(h.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
