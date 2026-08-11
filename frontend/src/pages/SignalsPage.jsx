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
  Power,
  Sliders
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
  const [selectedJunction, setSelectedJunction] = useState('J-001');

  // Target phase & duration
  const [targetPhase, setTargetPhase] = useState('LANE_1_NORTH');
  const [manualDuration, setManualDuration] = useState(30);

  // Individual light state for each of the 4 lanes (L1, L2, L3, L4)
  const [laneLightStates, setLaneLightStates] = useState({
    LANE_1_NORTH: 'GREEN',
    LANE_2_SOUTH: 'RED',
    LANE_3_EAST: 'RED',
    LANE_4_WEST: 'RED'
  });

  // Dynamic Live Signal Light State for the main active lane monitor
  const [activeSignal, setActiveSignal] = useState({
    phase: 'LANE_1_NORTH',
    duration: 30,
    remainingSec: 30,
    lightColor: 'GREEN' // 'GREEN' | 'YELLOW' | 'RED'
  });

  const [history, setHistory] = useState([]);
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

  // Real-time Dynamic Countdown & Auto Light Transition (Green -> Orange/Yellow -> Red)
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSignal((prev) => {
        if (prev.remainingSec <= 0) {
          return {
            ...prev,
            remainingSec: 0,
            lightColor: 'RED'
          };
        }

        const nextSec = prev.remainingSec - 1;
        let nextColor = 'GREEN';

        // When remaining time <= 5 seconds, switch to Orange/Yellow caution light
        if (nextSec <= 5 && nextSec > 0) {
          nextColor = 'YELLOW';
        } else if (nextSec <= 0) {
          nextColor = 'RED';
        }

        // Keep lane matrix state in sync with primary active lane
        setLaneLightStates(lanePrev => ({
          ...lanePrev,
          [prev.phase]: nextColor
        }));

        return {
          ...prev,
          remainingSec: nextSec,
          lightColor: nextColor
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const simulateOfflineHistory = () => {
    setHistory([
      { id: 201, junction_id: selectedJunction, phase: 'LANE_1_NORTH', duration: 45, mode: 'MANUAL', timestamp: new Date(Date.now() - 45000).toISOString() },
      { id: 202, junction_id: selectedJunction, phase: 'LANE_3_EAST', duration: 30, mode: 'MANUAL', timestamp: new Date(Date.now() - 180000).toISOString() },
      { id: 203, junction_id: selectedJunction, phase: 'ALL_RED', duration: 30, mode: 'MANUAL', timestamp: new Date(Date.now() - 420000).toISOString() }
    ]);
  };

  // Set single lane to GREEN or RED directly
  const handleSetLaneLight = (laneId, targetColor) => {
    setTargetPhase(laneId);

    if (targetColor === 'GREEN') {
      const durNum = manualDuration || 30;
      setLaneLightStates({
        LANE_1_NORTH: laneId === 'LANE_1_NORTH' ? 'GREEN' : 'RED',
        LANE_2_SOUTH: laneId === 'LANE_2_SOUTH' ? 'GREEN' : 'RED',
        LANE_3_EAST: laneId === 'LANE_3_EAST' ? 'GREEN' : 'RED',
        LANE_4_WEST: laneId === 'LANE_4_WEST' ? 'GREEN' : 'RED'
      });
      setActiveSignal({
        phase: laneId,
        duration: durNum,
        remainingSec: durNum,
        lightColor: 'GREEN'
      });
      handleApplyOverride(laneId, durNum);
    } else {
      // Set to RED
      setLaneLightStates(prev => ({ ...prev, [laneId]: 'RED' }));
      if (activeSignal.phase === laneId) {
        setActiveSignal(prev => ({ ...prev, remainingSec: 0, lightColor: 'RED' }));
      }
    }
  };

  // Set ALL lanes to RED or ALL lanes to GREEN
  const handleSetAllLanes = (targetColor) => {
    if (targetColor === 'RED') {
      setLaneLightStates({
        LANE_1_NORTH: 'RED',
        LANE_2_SOUTH: 'RED',
        LANE_3_EAST: 'RED',
        LANE_4_WEST: 'RED'
      });
      setActiveSignal(prev => ({ ...prev, phase: 'ALL_RED', remainingSec: 0, lightColor: 'RED' }));
      handleApplyOverride('ALL_RED', 30);
    } else {
      setLaneLightStates({
        LANE_1_NORTH: 'GREEN',
        LANE_2_SOUTH: 'GREEN',
        LANE_3_EAST: 'GREEN',
        LANE_4_WEST: 'GREEN'
      });
      setActiveSignal(prev => ({ ...prev, phase: 'ALL_GREEN', remainingSec: manualDuration, lightColor: 'GREEN' }));
      handleApplyOverride('ALL_GREEN', manualDuration);
    }
  };

  const handleApplyOverride = async (phaseToApply = targetPhase, durationToApply = manualDuration) => {
    const durNum = parseInt(durationToApply) || 30;
    const initialColor = durNum > 5 ? 'GREEN' : durNum > 0 ? 'YELLOW' : 'RED';

    try {
      const result = await request('post', `/signals/${selectedJunction}/apply`, {
        phase: phaseToApply,
        duration: durNum,
        mode: 'MANUAL'
      });

      updateSignal(result);
      setActiveSignal({
        phase: phaseToApply,
        duration: durNum,
        remainingSec: durNum,
        lightColor: phaseToApply === 'ALL_RED' ? 'RED' : initialColor
      });
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
      setActiveSignal({
        phase: phaseToApply,
        duration: durNum,
        remainingSec: durNum,
        lightColor: phaseToApply === 'ALL_RED' ? 'RED' : initialColor
      });
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
            <Badge variant="warning" className="text-[10px]">Manual Override Active</Badge>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Select junction, override signal lights for 4 approach lanes (Green / Red toggles), and set dynamic manual timers.
          </p>
        </div>

        {/* Junction Selector */}
        <div className="flex items-center gap-3">
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
        {/* Left Column: Live Traffic Light Display & Emergency Controls */}
        <div className="space-y-6 lg:col-span-1">
          {/* Physical Traffic Light State Monitor */}
          <Card title="Live Traffic Light Monitor" subtitle={`Real-time signal head at ${currentJunctionObj?.name}`}>
            <div className="flex flex-col items-center justify-center p-6 space-y-6 bg-slate-950 border border-slate-900 rounded-xl">
              {/* Traffic Light Housing */}
              <div className="w-24 bg-slate-900 border-4 border-slate-800 rounded-3xl p-4 flex flex-col items-center gap-4 shadow-2xl relative">
                {/* Red Light */}
                <div className={`w-14 h-14 rounded-full border-2 border-black/40 transition-all duration-300 flex items-center justify-center ${
                  activeSignal.lightColor === 'RED'
                    ? 'bg-red-500 shadow-[0_0_25px_#ef4444] border-red-300 animate-pulse'
                    : 'bg-red-950/30'
                }`}>
                  {activeSignal.lightColor === 'RED' && (
                    <span className="text-white text-xs font-black font-mono">{activeSignal.remainingSec}s</span>
                  )}
                </div>

                {/* Orange / Yellow Light */}
                <div className={`w-14 h-14 rounded-full border-2 border-black/40 transition-all duration-300 flex items-center justify-center ${
                  activeSignal.lightColor === 'YELLOW'
                    ? 'bg-amber-400 shadow-[0_0_25px_#f59e0b] border-amber-200 animate-pulse'
                    : 'bg-amber-950/30'
                }`}>
                  {activeSignal.lightColor === 'YELLOW' && (
                    <span className="text-black text-xs font-black font-mono">{activeSignal.remainingSec}s</span>
                  )}
                </div>

                {/* Green Light */}
                <div className={`w-14 h-14 rounded-full border-2 border-black/40 transition-all duration-300 flex items-center justify-center ${
                  activeSignal.lightColor === 'GREEN'
                    ? 'bg-emerald-500 shadow-[0_0_25px_#10b981] border-emerald-300'
                    : 'bg-emerald-950/30'
                }`}>
                  {activeSignal.lightColor === 'GREEN' && (
                    <span className="text-white text-xs font-black font-mono">{activeSignal.remainingSec}s</span>
                  )}
                </div>
              </div>

              {/* Status Text & Dynamic Color Badge */}
              <div className="text-center space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Current Signal Light Status</span>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    activeSignal.lightColor === 'GREEN' ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' :
                    activeSignal.lightColor === 'YELLOW' ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' :
                    'bg-red-500 shadow-[0_0_8px_#ef4444]'
                  }`} />
                  <span className="text-xs font-extrabold text-white tracking-wide uppercase">
                    {activeSignal.lightColor === 'GREEN' ? 'GREEN LIGHT (GO)' :
                     activeSignal.lightColor === 'YELLOW' ? 'ORANGE LIGHT (SLOW DOWN)' :
                     'RED LIGHT (STOP)'}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-medium block pt-1">
                  Active Lane: <strong className="text-emerald-400">{activeSignal.phase.replace(/_/g, ' ')}</strong>
                </span>
              </div>
            </div>
          </Card>

          {/* Instant Global Controls */}
          <Card title="Global Signal Controls" subtitle="Master red / green controls for junction">
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

        {/* Center & Right Columns: 4 Lane Direct Manual Light Matrix & Custom Timer */}
        <div className="space-y-6 lg:col-span-2">
          {/* 4-Lane Direct Manual Light Matrix */}
          <Card 
            title="4-Lane Direct Manual Light Switches" 
            subtitle="Individually control each approach lane to RED or GREEN state"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SIGNAL_PHASES.map((p) => {
                const IconComponent = p.icon;
                const currentLight = laneLightStates[p.id] || 'RED';
                const isGreen = currentLight === 'GREEN';
                const isYellow = currentLight === 'YELLOW';

                return (
                  <div
                    key={p.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                      isGreen
                        ? 'border-emerald-500/60 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                        : isYellow
                        ? 'border-amber-500/60 bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                        : 'border-slate-800 bg-slate-900/50'
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
                        {isGreen ? '🟢 GREEN' : isYellow ? '🟡 ORANGE' : '🔴 RED'}
                      </Badge>
                    </div>

                    {/* Individual Manual Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-850">
                      <button
                        type="button"
                        onClick={() => handleSetLaneLight(p.id, 'GREEN')}
                        className={`py-2 px-3 rounded-lg font-extrabold text-xs transition-all border flex items-center justify-center gap-1.5 ${
                          isGreen
                            ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                            : 'bg-emerald-950/30 text-emerald-400 border-emerald-900 hover:bg-emerald-500/20'
                        }`}
                      >
                        🟢 SET GREEN
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetLaneLight(p.id, 'RED')}
                        className={`py-2 px-3 rounded-lg font-extrabold text-xs transition-all border flex items-center justify-center gap-1.5 ${
                          !isGreen && !isYellow
                            ? 'bg-red-600 text-white border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                            : 'bg-red-950/30 text-red-400 border-red-900 hover:bg-red-600/20'
                        }`}
                      >
                        🔴 SET RED
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
          <Card title="Manual Signal Override Log History" subtitle="Recent manual controller overrides issued for selected location">
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
                          <Badge variant={isRed ? 'danger' : 'warning'}>MANUAL OVERRIDE</Badge>
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
