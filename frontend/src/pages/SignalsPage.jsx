import React, { useState, useEffect } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { useApi } from '../hooks/useApi';
import { useDataStore } from '../store/dataStore';
import { TrafficCone, Play, AlertTriangle, ShieldAlert } from 'lucide-react';

const PHASES = ['NS_GREEN', 'EW_GREEN', 'NS_LEFT', 'EW_LEFT', 'ALL_RED'];
const MODES = ['RL', 'WEBSTER', 'MANUAL', 'EVENT'];

export default function SignalsPage() {
  const junctions = useDataStore((state) => state.junctions);
  const [selectedJunction, setSelectedJunction] = useState('J-001');
  const [activeMode, setActiveMode] = useState('RL');
  const [manualPhase, setManualPhase] = useState('NS_GREEN');
  const [manualDuration, setManualDuration] = useState(30);
  const [history, setHistory] = useState([]);

  const { loading, error, request } = useApi();
  const updateSignal = useDataStore((state) => state.updateSignal);

  // Fetch signal history for selected junction
  const fetchSignalHistory = async () => {
    try {
      const data = await request('get', `/signals/${selectedJunction}/history?limit=15`);
      setHistory(data);
    } catch (err) {
      console.log("Backend offline, loading mock history.");
      simulateOfflineHistory();
    }
  };

  useEffect(() => {
    fetchSignalHistory();
  }, [selectedJunction]);

  const simulateOfflineHistory = () => {
    setHistory([
      { id: 201, junction_id: selectedJunction, phase: 'NS_GREEN', duration: 45, mode: 'RL', timestamp: new Date(Date.now() - 60000).toISOString() },
      { id: 202, junction_id: selectedJunction, phase: 'EW_GREEN', duration: 35, mode: 'RL', timestamp: new Date(Date.now() - 120000).toISOString() },
      { id: 203, junction_id: selectedJunction, phase: 'NS_GREEN', duration: 40, mode: 'WEBSTER', timestamp: new Date(Date.now() - 240000).toISOString() }
    ]);
  };

  const handleOptimize = async () => {
    try {
      const result = await request('post', '/signals/optimize', {
        junction_id: selectedJunction,
        mode: activeMode
      });
      // Update local Zustand store
      updateSignal(result);
      // Refresh history log list
      fetchSignalHistory();
    } catch (err) {
      // Simulate optimize locally
      const mockResult = {
        id: Date.now(),
        junction_id: selectedJunction,
        phase: Math.random() > 0.5 ? 'NS_GREEN' : 'EW_GREEN',
        duration: Math.floor(Math.random() * 45) + 30,
        mode: activeMode,
        timestamp: new Date().toISOString()
      };
      updateSignal(mockResult);
      setHistory((prev) => [mockResult, ...prev]);
    }
  };

  const handleApplyOverride = async (phase = manualPhase, duration = manualDuration) => {
    try {
      const result = await request('post', `/signals/${selectedJunction}/apply`, {
        phase: phase,
        duration: parseInt(duration),
        mode: 'MANUAL'
      });
      updateSignal(result);
      fetchSignalHistory();
    } catch (err) {
      // Simulate override locally
      const mockResult = {
        id: Date.now(),
        junction_id: selectedJunction,
        phase: phase,
        duration: parseInt(duration),
        mode: 'MANUAL',
        timestamp: new Date().toISOString()
      };
      updateSignal(mockResult);
      setHistory((prev) => [mockResult, ...prev]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-white tracking-tight">Adaptive Signals</h2>
        <p className="text-xs text-slate-500 font-medium">Webster equations and Reinforcement Learning controller management</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Core Controls */}
        <div className="space-y-6">
          <Card title="Junction Selector" subtitle="Select location to query signal controller">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Junction Location</label>
              <select
                value={selectedJunction}
                onChange={(e) => setSelectedJunction(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                {junctions.map((j) => (
                  <option key={j.id} value={j.id}>{j.name} ({j.id})</option>
                ))}
              </select>
            </div>
          </Card>

          <Card title="AI Timing Optimization" subtitle="Trigger real-time neural networks calculation">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Algorithm Mode</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {MODES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setActiveMode(m)}
                      className={`rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                        activeMode === m 
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' 
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {m === 'RL' ? 'Reinforcement Learning' : m}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleOptimize}
                loading={loading}
                icon={Play}
                className="w-full mt-2"
              >
                Trigger AI Optimization
              </Button>
            </div>
          </Card>
        </div>

        {/* Manual Overrides */}
        <div className="space-y-6">
          <Card title="Manual Override Control" subtitle="Apply immediate physical signal timings change">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target Phase</label>
                <select
                  value={manualPhase}
                  onChange={(e) => setManualPhase(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  {PHASES.map((p) => (
                    <option key={p} value={p}>{p.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Duration (Seconds)</label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={manualDuration}
                  onChange={(e) => setManualDuration(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="primary"
                  onClick={() => handleApplyOverride()}
                  className="flex-1"
                >
                  Apply Override
                </Button>
                <Button
                  variant="danger"
                  icon={ShieldAlert}
                  onClick={() => handleApplyOverride('ALL_RED', 30)}
                  className="flex-1"
                >
                  All Red
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* History Log */}
        <Card title="Timing History Logs" subtitle="Recent signal controller actions logged for audited location">
          <div className="max-h-[350px] overflow-y-auto space-y-3 pr-1">
            {history.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-500 text-sm py-10">
                No history logged.
              </div>
            ) : (
              history.map((h) => {
                const isGreen = h.phase.endsWith('GREEN');
                const isYellow = h.phase.endsWith('YELLOW');
                const badgeVariant = h.mode === 'RL' ? 'critical' : h.mode === 'WEBSTER' ? 'info' : 'warning';
                
                let textColor = 'text-red-400';
                if (isGreen) textColor = 'text-green-400';
                else if (isYellow) textColor = 'text-yellow-400';

                return (
                  <div key={h.id} className="rounded-lg border border-slate-850 bg-slate-900/40 p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold uppercase tracking-wider ${textColor}`}>
                        {h.phase.replace('_', ' ')}
                      </span>
                      <Badge variant={badgeVariant}>{h.mode}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Duration: <span className="font-semibold text-slate-200">{h.duration}s</span></span>
                      <span>{new Date(h.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
