import React, { useState, useEffect, useRef } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  BarChart, 
  Bar,
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  Map as MapIcon, 
  Download, 
  FileText, 
  Layers, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  Play, 
  Pause, 
  RotateCcw, 
  Leaf, 
  Fuel,
  Compass,
  Activity,
  Cpu,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Radio,
  Sliders
} from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const CORRIDOR_JUNCTION_META = [
  { id: 'J_SVNIT', name: 'SVNIT / Ichchhanath Circle', shortName: 'SVNIT Circle', code: 'J1', x: 250, y: 200, lat: 21.167790, lon: 72.785022 },
  { id: 'J_GHODDOD', name: 'Ghod Dod Road Commercial Cross', shortName: 'Ghod Dod Cross', code: 'J2', x: 600, y: 200, lat: 21.175400, lon: 72.805200 },
  { id: 'J_MAJURA', name: 'Majura Gate BRTS Multi-Leg Hub', shortName: 'Majura Gate', code: 'J3', x: 950, y: 200, lat: 21.182450, lon: 72.823200 },
  { id: 'J_SAHARA', name: 'Sahara Darwaja Railway Flyover', shortName: 'Sahara Darwaja', code: 'J4', x: 1300, y: 200, lat: 21.196600, lon: 72.846500 }
];

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('junctions'); // 'junctions', 'whatif', 'trends', 'heatmaps', 'bottlenecks', 'recommendations'
  const [selectedJunctionId, setSelectedJunctionId] = useState('ALL'); // 'ALL' or 'J_SVNIT', 'J_GHODDOD', 'J_MAJURA', 'J_SAHARA'
  const [heatmapType, setHeatmapType] = useState('density'); // 'density', 'queue', 'wait'
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);
  const [simStatus, setSimStatus] = useState({
    isPaused: true,
    is5MinRunning: false,
    time: 0.0,
    demoProgress: 0.0,
    scenarioMode: 'adaptive'
  });

  const wsRef = useRef(null);

  // 1. Initial REST API load for historical data
  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiBase}/simulation/analytics`);
      const data = await res.json();
      setAnalyticsData(data);
    } catch (err) {
      console.error("Error loading simulation analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Real-Time WebSocket Telemetry Connection
  useEffect(() => {
    loadAnalytics();

    const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000')
      .replace(/^http/, 'ws') + '/ws/simulation';

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsLiveStreaming(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'state') {
          const state = msg.data;
          setSimStatus({
            isPaused: state.stats?.isPaused ?? true,
            is5MinRunning: state.stats?.is5MinRunning ?? false,
            time: state.time || 0.0,
            demoProgress: state.stats?.demoProgress || 0.0,
            scenarioMode: state.stats?.scenarioMode || 'adaptive'
          });

          // Live update analytics store in real time
          if (state.liveTimeline && state.liveTimeline.length > 0) {
            setAnalyticsData(prev => ({
              ...prev,
              kpis: {
                ...prev?.kpis,
                throughputVph: state.liveWhatIf?.optimized?.throughput ?? prev?.kpis?.throughputVph ?? 0,
                avgSpeedKmh: state.liveWhatIf?.optimized?.avgSpeed ?? prev?.kpis?.avgSpeedKmh ?? 0,
                avgWaitTimeSec: state.liveWhatIf?.optimized?.avgWait ?? prev?.kpis?.avgWaitTimeSec ?? 0,
                maxQueueVehicles: state.liveWhatIf?.optimized?.maxQueue ?? prev?.kpis?.maxQueueVehicles ?? 0,
                totalCO2Kg: state.sustainability?.co2Kg ?? prev?.kpis?.totalCO2Kg ?? 0,
                totalFuelLiters: state.sustainability?.fuelLiters ?? prev?.kpis?.totalFuelLiters ?? 0,
                co2SavedKg: state.liveWhatIf?.improvements?.co2SavedKg ?? prev?.kpis?.co2SavedKg ?? 0,
                fuelSavedLiters: state.liveWhatIf?.improvements?.fuelSavedLiters ?? prev?.kpis?.fuelSavedLiters ?? 0
              },
              junctions: state.liveJunctions || prev?.junctions,
              trends: state.liveTimeline,
              bottlenecks: state.liveBottlenecks || prev?.bottlenecks,
              whatIfComparison: state.liveWhatIf || prev?.whatIfComparison,
              spatialHeatmaps: state.liveHeatmaps || prev?.spatialHeatmaps
            }));
          }
        }
      } catch (err) {
        console.error("Error parsing live analytics payload:", err);
      }
    };

    ws.onclose = () => {
      setIsLiveStreaming(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const sendControl = (payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  const handleTogglePlay = () => {
    sendControl({ type: simStatus.isPaused ? "resume" : "pause" });
  };

  const handleReset = () => {
    sendControl({ type: "reset" });
    loadAnalytics();
  };

  const handleRun5Min = () => {
    sendControl({ type: "run_5min", scenario: "adaptive", demand: "peak" });
  };

  const handleExport = (type) => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    window.open(`${apiBase}/simulation/export/${type}`, '_blank');
  };

  const kpis = analyticsData?.kpis || {
    throughputVph: 0,
    avgSpeedKmh: 0,
    avgWaitTimeSec: 0,
    maxQueueVehicles: 0,
    congestionScore: 0,
    totalCO2Kg: 0,
    totalFuelLiters: 0,
    co2SavedKg: 0,
    fuelSavedLiters: 0
  };

  const junctions = analyticsData?.junctions || {};
  const trends = analyticsData?.trends || [];
  const bottlenecks = analyticsData?.bottlenecks || [];
  const recommendations = analyticsData?.recommendations || [];
  const whatIf = analyticsData?.whatIfComparison || {
    baseline: { throughput: 0, avgSpeed: 0, avgWait: 0, maxQueue: 0, totalCO2Kg: 0, totalFuelLiters: 0 },
    optimized: { throughput: 0, avgSpeed: 0, avgWait: 0, maxQueue: 0, totalCO2Kg: 0, totalFuelLiters: 0 },
    improvements: { throughputGainPct: 0, speedIncreasePct: 0, waitReductionPct: 0, queueReductionPct: 0, co2SavedKg: 0, fuelSavedLiters: 0, co2ReductionPct: 0, fuelReductionPct: 0 },
    junctionComparisons: []
  };

  const heatmapNodes = analyticsData?.spatialHeatmaps?.nodes || CORRIDOR_JUNCTION_META.map(j => ({
    id: j.id,
    name: j.name,
    lat: j.lat,
    lng: j.lon,
    densityIntensity: 0.3,
    queueIntensity: 0.3,
    waitIntensity: 0.3
  }));

  // Helper for rendering LOS Badge
  const renderLosBadge = (los = 'A') => {
    const colors = {
      A: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      B: 'bg-teal-500/20 text-teal-400 border-teal-500/40',
      C: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
      D: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
      E: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
      F: 'bg-red-500/20 text-red-400 border-red-500/40'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-mono font-extrabold border ${colors[los] || colors.A}`}>
        LOS {los}
      </span>
    );
  };

  // Selected junction data
  const selectedJunction = selectedJunctionId !== 'ALL' ? junctions[selectedJunctionId] : null;

  // Approach data prepared for chart
  const approachChartData = selectedJunction?.approaches ? [
    { name: 'North', delay: selectedJunction.approaches.NORTH?.avgDelaySec || 0, queue: selectedJunction.approaches.NORTH?.maxQueue || 0, speed: selectedJunction.approaches.NORTH?.avgSpeedKmh || 0, count: selectedJunction.approaches.NORTH?.vehiclesCount || 0 },
    { name: 'South', delay: selectedJunction.approaches.SOUTH?.avgDelaySec || 0, queue: selectedJunction.approaches.SOUTH?.maxQueue || 0, speed: selectedJunction.approaches.SOUTH?.avgSpeedKmh || 0, count: selectedJunction.approaches.SOUTH?.vehiclesCount || 0 },
    { name: 'East', delay: selectedJunction.approaches.EAST?.avgDelaySec || 0, queue: selectedJunction.approaches.EAST?.maxQueue || 0, speed: selectedJunction.approaches.EAST?.avgSpeedKmh || 0, count: selectedJunction.approaches.EAST?.vehiclesCount || 0 },
    { name: 'West', delay: selectedJunction.approaches.WEST?.avgDelaySec || 0, queue: selectedJunction.approaches.WEST?.maxQueue || 0, speed: selectedJunction.approaches.WEST?.avgSpeedKmh || 0, count: selectedJunction.approaches.WEST?.vehiclesCount || 0 },
  ] : [];

  // All 4 Junctions Comparison Data for Bar Chart
  const allJunctionsComparisonData = CORRIDOR_JUNCTION_META.map(j => {
    const jd = junctions[j.id] || {};
    return {
      name: j.shortName,
      throughput: jd.throughputVph || 0,
      delay: jd.avgDelaySec || 0,
      speed: jd.avgSpeedKmh || 0,
      queue: jd.maxQueueVehicles || 0,
      los: jd.levelOfService || 'A',
      congestion: jd.congestionScore || 0
    };
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header with Live Telemetry & Playback Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              📊 Real-Time SUMO Simulation Analytics & What-If Engine
            </h2>
            <Badge variant={isLiveStreaming ? "success" : "info"}>
              {isLiveStreaming ? "🟢 Live Telemetry Stream" : "Historical Report"}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            4-Junction Surat Arterial Spine • Deep Intersection Diagnostics, HCM Level of Service & Empirical What-If Analysis
          </p>
        </div>

        {/* Action Buttons & Simulation Quick Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            onClick={handleRun5Min}
            disabled={simStatus.is5MinRunning}
            className="py-2 px-3 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
          >
            <Zap className="h-4 w-4 fill-white" />
            <span>{simStatus.is5MinRunning ? 'Simulation Active...' : 'Run 5-Min Demo'}</span>
          </Button>

          <Button
            variant={simStatus.isPaused ? "primary" : "outline"}
            onClick={handleTogglePlay}
            className="py-2 px-3 text-xs font-bold border-slate-700 hover:bg-slate-800 text-slate-200 flex items-center gap-1"
          >
            {simStatus.isPaused ? <Play className="h-3.5 w-3.5 text-emerald-400 fill-emerald-400/30" /> : <Pause className="h-3.5 w-3.5 text-amber-400 fill-amber-400/30" />}
            <span>{simStatus.isPaused ? "Resume" : "Pause"}</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleReset}
            className="p-2 border-slate-700 hover:bg-slate-800 text-slate-300"
            title="Reset Simulation State"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            onClick={() => handleExport('pdf')}
            className="py-2 px-3 text-xs font-bold border-emerald-500/40 bg-emerald-950/20 hover:bg-emerald-900/40 text-emerald-300 flex items-center gap-1.5"
            title="Download Executive 2-Page PDF with Charts"
          >
            <FileText className="h-4 w-4 text-emerald-400" />
            <span>Executive PDF Report</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => handleExport('csv')}
            className="py-2 px-3 text-xs font-bold border-slate-700 hover:bg-slate-800 text-slate-200 flex items-center gap-1.5"
          >
            <Download className="h-4 w-4 text-cyan-400" />
            <span>CSV</span>
          </Button>
        </div>
      </div>

      {/* Live Simulation Progress Banner */}
      {simStatus.is5MinRunning && (
        <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-950/20 backdrop-blur-md shadow-2xl space-y-2 animate-pulse">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-emerald-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE SIMULATION ACTIVE: {simStatus.scenarioMode.toUpperCase()}
            </span>
            <span className="font-mono text-white">
              {Math.floor(simStatus.time / 60)}:{(simStatus.time % 60).toFixed(0).padStart(2, '0')} / 05:00 ({simStatus.demoProgress}%)
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
              style={{ width: `${simStatus.demoProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Top 6 Corridor Aggregate KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 shadow-md">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Corridor Throughput</span>
          <span className="text-lg font-extrabold text-emerald-400 mt-1 block font-mono">
            {kpis.throughputVph} <span className="text-xs text-slate-500 font-normal">vph</span>
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 shadow-md">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Corridor Speed</span>
          <span className="text-lg font-extrabold text-cyan-400 mt-1 block font-mono">
            {kpis.avgSpeedKmh} <span className="text-xs text-slate-500 font-normal">km/h</span>
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 shadow-md">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Avg Network Delay</span>
          <span className="text-lg font-extrabold text-amber-400 mt-1 block font-mono">{kpis.avgWaitTimeSec}s</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 shadow-md">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Peak Queue</span>
          <span className="text-lg font-extrabold text-orange-400 mt-1 block font-mono">
            {kpis.maxQueueVehicles} <span className="text-xs text-slate-500 font-normal">veh</span>
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 shadow-md">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">CO2 Generated</span>
          <span className="text-lg font-extrabold text-teal-400 mt-1 block font-mono">
            {kpis.totalCO2Kg} <span className="text-xs text-slate-500 font-normal">kg</span>
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 shadow-md">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Fuel Saved</span>
          <span className="text-lg font-extrabold text-emerald-400 mt-1 block font-mono">
            {kpis.fuelSavedLiters} <span className="text-xs text-slate-500 font-normal">Liters</span>
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto">
        {[
          { id: 'junctions', name: '🚦 4-Junction Deep-Dive', icon: Activity },
          { id: 'whatif', name: '⚡ What-If Baseline Gains', icon: Zap },
          { id: 'trends', name: '📈 Live Traffic Trends', icon: TrendingUp },
          { id: 'heatmaps', name: '🗺️ Dynamic Spatial Heatmaps', icon: MapIcon },
          { id: 'bottlenecks', name: '⚠️ Dynamic Hotspots Ranking', icon: AlertTriangle },
          { id: 'recommendations', name: '👷 Actionable Recommendations', icon: Layers }
        ].map((t) => {
          const TabIcon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <TabIcon className="h-4 w-4" />
              <span>{t.name}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: 4-JUNCTION DEEP-DIVE ANALYTICS */}
      {activeTab === 'junctions' && (
        <div className="space-y-6">
          {/* Junction Selector Header */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-950/80 p-2 rounded-xl border border-slate-800">
            <span className="text-xs font-bold text-slate-400 px-2 flex items-center gap-1.5">
              <Compass className="h-4 w-4 text-emerald-400" />
              Select Node:
            </span>
            <button
              onClick={() => setSelectedJunctionId('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                selectedJunctionId === 'ALL'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              <span>🌟 All 4 Junctions Overview</span>
            </button>

            {CORRIDOR_JUNCTION_META.map(j => {
              const jd = junctions[j.id];
              const isSelected = selectedJunctionId === j.id;
              return (
                <button
                  key={j.id}
                  onClick={() => setSelectedJunctionId(j.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-850'
                  }`}
                >
                  <span className="font-mono opacity-80">{j.code}:</span>
                  <span>{j.shortName}</span>
                  {jd?.levelOfService && (
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${isSelected ? 'bg-black/30 text-white' : 'bg-slate-800 text-emerald-400'}`}>
                      LOS {jd.levelOfService}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* VIEW A: ALL 4 JUNCTIONS COMPARISON GRID */}
          {selectedJunctionId === 'ALL' && (
            <div className="space-y-6">
              {/* 4 Junction Summary Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {CORRIDOR_JUNCTION_META.map(j => {
                  const jd = junctions[j.id] || {};
                  return (
                    <div 
                      key={j.id}
                      onClick={() => setSelectedJunctionId(j.id)}
                      className="cursor-pointer group rounded-xl border border-slate-850 bg-slate-950 p-4 hover:border-emerald-500/50 transition duration-200 shadow-md hover:shadow-emerald-500/10 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center">
                            {j.code}
                          </span>
                          <span className="font-bold text-sm text-white group-hover:text-emerald-300 transition">
                            {j.shortName}
                          </span>
                        </div>
                        {renderLosBadge(jd.levelOfService || 'A')}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-850/60">
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase block">Throughput</span>
                          <span className="text-base font-extrabold text-emerald-400 font-mono">
                            {jd.throughputVph || 0} <span className="text-[10px] text-slate-500 font-normal">vph</span>
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase block">Avg Delay</span>
                          <span className="text-base font-extrabold text-amber-400 font-mono">
                            {jd.avgDelaySec || 0}s
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase block">Avg Speed</span>
                          <span className="text-base font-extrabold text-cyan-400 font-mono">
                            {jd.avgSpeedKmh || 0} <span className="text-[10px] text-slate-500 font-normal">km/h</span>
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase block">Max Queue</span>
                          <span className="text-base font-extrabold text-orange-400 font-mono">
                            {jd.maxQueueVehicles || 0} <span className="text-[10px] text-slate-500 font-normal">veh</span>
                          </span>
                        </div>
                      </div>

                      {/* Mini Phase Split Bar */}
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>EW Green: <strong className="text-emerald-400">{jd.phaseSplit?.ewGreenPct || 50}%</strong></span>
                          <span>NS Green: <strong className="text-sky-400">{jd.phaseSplit?.nsGreenPct || 50}%</strong></span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
                          <div style={{ width: `${jd.phaseSplit?.ewGreenPct || 50}%` }} className="bg-emerald-500 h-full" />
                          <div style={{ width: `${jd.phaseSplit?.nsGreenPct || 50}%` }} className="bg-sky-500 h-full" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Comparative Charts: Delay & Throughput across 4 Junctions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Junction Average Delay & Congestion Index" subtitle="HCM Delay per vehicle and composite congestion score across the 4 corridor intersections">
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={allJunctionsComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                        <YAxis stroke="#64748b" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                        <Bar dataKey="delay" name="Avg Delay (sec/veh)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="congestion" name="Congestion Score (0-100)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card title="Junction Throughput & Corridor Speed Comparison" subtitle="Processed vehicle volume (vph) vs average approach travel speed">
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={allJunctionsComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                        <YAxis stroke="#64748b" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                        <Bar dataKey="throughput" name="Throughput (veh/hr)" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="speed" name="Approach Speed (km/h)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* VIEW B: INDIVIDUAL JUNCTION DETAILED DIAGNOSTICS */}
          {selectedJunctionId !== 'ALL' && selectedJunction && (
            <div className="space-y-6">
              {/* Junction Hero Card */}
              <div className="p-5 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-mono text-sm font-black">
                        {selectedJunction.id}
                      </span>
                      <h3 className="text-lg font-black text-white">{selectedJunction.name}</h3>
                      {renderLosBadge(selectedJunction.levelOfService)}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Geo Coordinates: {selectedJunction.lat?.toFixed(5)}° N, {selectedJunction.lon?.toFixed(5)}° E • HCM Classification: <strong className="text-emerald-400">{selectedJunction.losDescription}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Congestion Severity</span>
                      <span className="text-xl font-black text-amber-400 font-mono">{selectedJunction.congestionScore}/100</span>
                    </div>
                  </div>
                </div>

                {/* 4 Metric Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-850">
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Junction Capacity</span>
                    <span className="text-lg font-extrabold text-emerald-400 font-mono mt-0.5 block">
                      {selectedJunction.throughputVph} <span className="text-xs text-slate-500 font-normal">vph</span>
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Control Delay</span>
                    <span className="text-lg font-extrabold text-amber-400 font-mono mt-0.5 block">{selectedJunction.avgDelaySec}s / veh</span>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Approach Speed</span>
                    <span className="text-lg font-extrabold text-cyan-400 font-mono mt-0.5 block">{selectedJunction.avgSpeedKmh} km/h</span>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Max Halting Queue</span>
                    <span className="text-lg font-extrabold text-orange-400 font-mono mt-0.5 block">{selectedJunction.maxQueueVehicles} vehicles</span>
                  </div>
                </div>
              </div>

              {/* 4-Approach Directional Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="4-Approach Inbound Delay & Queue Profile" subtitle="Detailed North, South, East, and West approach directional telemetry">
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={approachChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                        <YAxis stroke="#64748b" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                        <Bar dataKey="delay" name="Avg Delay (s)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="queue" name="Max Queue (veh)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="speed" name="Speed (km/h)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* Inbound Approach Detail Table */}
                <Card title="Directional Approach Inflow Matrix" subtitle="Detailed breakdown of vehicles passed, queues, and delay per inbound feeder">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                          <th className="pb-2.5 py-1">Approach Direction</th>
                          <th className="pb-2.5 py-1">Vehicles</th>
                          <th className="pb-2.5 py-1">Avg Delay</th>
                          <th className="pb-2.5 py-1">Max Queue</th>
                          <th className="pb-2.5 py-1">Speed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {Object.entries(selectedJunction.approaches || {}).map(([appKey, appVal]) => (
                          <tr key={appKey} className="hover:bg-slate-900/40">
                            <td className="py-3 font-bold text-white flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              {appKey} Approach
                            </td>
                            <td className="py-3 font-mono">{appVal.vehiclesCount || 0}</td>
                            <td className="py-3 font-mono text-amber-400 font-bold">{appVal.avgDelaySec || 0}s</td>
                            <td className="py-3 font-mono text-orange-400">{appVal.maxQueue || 0} veh</td>
                            <td className="py-3 font-mono text-cyan-400">{appVal.avgSpeedKmh || 0} km/h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {/* Signal Phase Allocation & Modal Split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Adaptive Signal Phase Split Allocation" subtitle="Real-time green light duration distribution under TraCI pressure-based control">
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-emerald-400">East-West Arterial Phase (EW Green)</span>
                        <span className="font-mono text-emerald-400">{selectedJunction.phaseSplit?.ewGreenPct || 50}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800">
                        <div style={{ width: `${selectedJunction.phaseSplit?.ewGreenPct || 50}%` }} className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-sky-400">North-South Cross Feeder Phase (NS Green)</span>
                        <span className="font-mono text-sky-400">{selectedJunction.phaseSplit?.nsGreenPct || 50}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800">
                        <div style={{ width: `${selectedJunction.phaseSplit?.nsGreenPct || 50}%` }} className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-amber-400">Inter-Phase Yellow Change Clearance</span>
                        <span className="font-mono text-amber-400">{selectedJunction.phaseSplit?.yellowPct || 0}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800">
                        <div style={{ width: `${selectedJunction.phaseSplit?.yellowPct || 0}%` }} className="bg-amber-400 h-full" />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Localized Junction What-If */}
                <Card title="Localized Junction What-If Gains" subtitle="Comparative empirical benefits vs Fixed-Time pre-timed controller at this intersection">
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 text-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Throughput Boost</span>
                      <span className="text-lg font-black text-emerald-400 font-mono mt-1 block">
                        +{selectedJunction.whatIf?.throughputGainPct || 0}%
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 text-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Delay Reduction</span>
                      <span className="text-lg font-black text-teal-400 font-mono mt-1 block">
                        -{selectedJunction.whatIf?.delayReductionPct || 0}%
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 text-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Speed Gain</span>
                      <span className="text-lg font-black text-cyan-400 font-mono mt-1 block">
                        +{selectedJunction.whatIf?.speedIncreasePct || 0}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded-xl bg-slate-950/80 border border-slate-850 text-xs text-slate-400 leading-relaxed">
                    <strong className="text-white">Empirical Summary:</strong> Adaptive TraCI signal pressure reduced intersection stop delay from <span className="text-slate-200 font-mono">{selectedJunction.whatIf?.baselineDelay || 0}s</span> to <span className="text-emerald-400 font-mono font-bold">{selectedJunction.avgDelaySec}s</span>, raising capacity to <span className="text-emerald-400 font-mono font-bold">{selectedJunction.throughputVph} vph</span>.
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WHAT-IF BASELINE GAINS */}
      {activeTab === 'whatif' && (
        <div className="space-y-6">
          {/* Gains Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Throughput Gain</span>
              <span className="text-2xl font-extrabold text-emerald-400 mt-1 block font-mono">+{whatIf.improvements.throughputGainPct}%</span>
            </div>
            <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">Speed Increase</span>
              <span className="text-2xl font-extrabold text-cyan-400 mt-1 block font-mono">+{whatIf.improvements.speedIncreasePct}%</span>
            </div>
            <div className="p-4 rounded-xl border border-teal-500/30 bg-teal-950/20">
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block">Delay Reduction</span>
              <span className="text-2xl font-extrabold text-teal-400 mt-1 block font-mono">-{whatIf.improvements.waitReductionPct}%</span>
            </div>
            <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">CO2 Emissions Saved</span>
              <span className="text-2xl font-extrabold text-indigo-400 mt-1 block font-mono">-{whatIf.improvements.co2ReductionPct}%</span>
            </div>
          </div>

          {/* Side by Side Corridor Comparison Table */}
          <Card title="Corridor Ground-Truth Telemetry Comparison" subtitle="Empirical dual-run SUMO measurements against Fixed-Time baseline">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="pb-3 py-2">Performance Metric</th>
                    <th className="pb-3 py-2 text-slate-400">Fixed-Time Baseline</th>
                    <th className="pb-3 py-2 text-emerald-400">Adaptive TraCI Policy</th>
                    <th className="pb-3 py-2 text-right">Empirical Benefit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/50">
                  <tr>
                    <td className="py-3.5 font-semibold text-white">Throughput Capacity Rate</td>
                    <td className="py-3.5 font-mono text-slate-400">{whatIf.baseline.throughput} veh/hr</td>
                    <td className="py-3.5 font-mono text-emerald-400 font-bold">{whatIf.optimized.throughput} veh/hr</td>
                    <td className="py-3.5 font-mono text-emerald-400 text-right font-bold">+{whatIf.improvements.throughputGainPct}%</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 font-semibold text-white">Average Corridor Speed</td>
                    <td className="py-3.5 font-mono text-slate-400">{whatIf.baseline.avgSpeed} km/h</td>
                    <td className="py-3.5 font-mono text-cyan-400 font-bold">{whatIf.optimized.avgSpeed} km/h</td>
                    <td className="py-3.5 font-mono text-cyan-400 text-right font-bold">+{whatIf.improvements.speedIncreasePct}%</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 font-semibold text-white">Average Intersection Stop Delay</td>
                    <td className="py-3.5 font-mono text-slate-400">{whatIf.baseline.avgWait}s</td>
                    <td className="py-3.5 font-mono text-teal-400 font-bold">{whatIf.optimized.avgWait}s</td>
                    <td className="py-3.5 font-mono text-teal-400 text-right font-bold">-{whatIf.improvements.waitReductionPct}%</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 font-semibold text-white">Total CO2 Emissions Generated</td>
                    <td className="py-3.5 font-mono text-slate-400">{whatIf.baseline.totalCO2Kg} kg</td>
                    <td className="py-3.5 font-mono text-emerald-400 font-bold">{whatIf.optimized.totalCO2Kg} kg</td>
                    <td className="py-3.5 font-mono text-emerald-400 text-right font-bold">-{whatIf.improvements.co2ReductionPct}% ({whatIf.improvements.co2SavedKg} kg saved)</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 font-semibold text-white">Total Fuel Consumed</td>
                    <td className="py-3.5 font-mono text-slate-400">{whatIf.baseline.totalFuelLiters} L</td>
                    <td className="py-3.5 font-mono text-emerald-400 font-bold">{whatIf.optimized.totalFuelLiters} L</td>
                    <td className="py-3.5 font-mono text-emerald-400 text-right font-bold">-{whatIf.improvements.fuelReductionPct}% ({whatIf.improvements.fuelSavedLiters} L saved)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* 4-Junction What-If Comparative Table */}
          <Card title="4-Junction Localized What-If Gains" subtitle="Comparative breakdown showing delay reductions and throughput gains for every individual corridor intersection">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="pb-3 py-2">Intersection Node</th>
                    <th className="pb-3 py-2">HCM LOS</th>
                    <th className="pb-3 py-2">Fixed-Time Delay</th>
                    <th className="pb-3 py-2 text-emerald-400">Adaptive Delay</th>
                    <th className="pb-3 py-2">Delay Reduction</th>
                    <th className="pb-3 py-2">Fixed Capacity</th>
                    <th className="pb-3 py-2 text-emerald-400">Adaptive Capacity</th>
                    <th className="pb-3 py-2 text-right">Capacity Gain</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/50">
                  {whatIf.junctionComparisons && whatIf.junctionComparisons.length > 0 ? (
                    whatIf.junctionComparisons.map((jc) => (
                      <tr key={jc.junctionId} className="hover:bg-slate-900/40">
                        <td className="py-3 font-bold text-white">{jc.junctionName}</td>
                        <td className="py-3">{renderLosBadge(jc.levelOfService)}</td>
                        <td className="py-3 font-mono text-slate-400">{jc.baselineDelay}s</td>
                        <td className="py-3 font-mono text-emerald-400 font-bold">{jc.optimizedDelay}s</td>
                        <td className="py-3 font-mono text-teal-400 font-bold">-{jc.delayReductionPct}%</td>
                        <td className="py-3 font-mono text-slate-400">{jc.baselineThroughput} vph</td>
                        <td className="py-3 font-mono text-emerald-400 font-bold">{jc.optimizedThroughput} vph</td>
                        <td className="py-3 font-mono text-emerald-400 text-right font-bold">+{jc.throughputGainPct}%</td>
                      </tr>
                    ))
                  ) : (
                    CORRIDOR_JUNCTION_META.map(j => {
                      const jd = junctions[j.id] || {};
                      const jw = jd.whatIf || {};
                      return (
                        <tr key={j.id} className="hover:bg-slate-900/40">
                          <td className="py-3 font-bold text-white">{j.name}</td>
                          <td className="py-3">{renderLosBadge(jd.levelOfService || 'A')}</td>
                          <td className="py-3 font-mono text-slate-400">{jw.baselineDelay || 0}s</td>
                          <td className="py-3 font-mono text-emerald-400 font-bold">{jd.avgDelaySec || 0}s</td>
                          <td className="py-3 font-mono text-teal-400 font-bold">-{jw.delayReductionPct || 0}%</td>
                          <td className="py-3 font-mono text-slate-400">{jw.baselineThroughput || 0} vph</td>
                          <td className="py-3 font-mono text-emerald-400 font-bold">{jd.throughputVph || 0} vph</td>
                          <td className="py-3 font-mono text-emerald-400 text-right font-bold">+{jw.throughputGainPct || 0}%</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: LIVE REAL-TIME TRENDS CHARTS */}
      {activeTab === 'trends' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Live Volume & Halting Queue Dynamics" subtitle="Real-time vehicle density and halting queue accumulation per second">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="queueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Area type="monotone" dataKey="activeVehicles" stroke="#10b981" fillOpacity={1} fill="url(#volGrad)" name="Active Vehicles" isAnimationActive={false} />
                  <Area type="monotone" dataKey="totalQueue" stroke="#ef4444" fillOpacity={1} fill="url(#queueGrad)" name="Halting Queue" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Corridor Speed vs Multi-Factor Congestion Index" subtitle="TraCI speed progression and dynamic multi-factor congestion score">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line type="monotone" dataKey="avgSpeed" stroke="#38bdf8" strokeWidth={2} dot={false} name="Avg Speed (km/h)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="congestionIndex" stroke="#f59e0b" strokeWidth={2} dot={false} name="Congestion Score (0-100)" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: DYNAMIC SPATIAL HEATMAPS */}
      {activeTab === 'heatmaps' && (
        <Card 
          title="Dynamic Spatial Congestion Heatmap (Surat Corridor)" 
          subtitle="Real-world Surat geographic coordinates with live intensity bubble pulsing"
          action={
            <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              {[
                { id: 'density', label: 'Density' },
                { id: 'queue', label: 'Queues' },
                { id: 'wait', label: 'Delay' }
              ].map((ht) => (
                <button
                  key={ht.id}
                  onClick={() => setHeatmapType(ht.id)}
                  className={`py-1 px-2.5 rounded text-[10px] font-bold transition ${
                    heatmapType === ht.id 
                      ? 'bg-emerald-500 text-white shadow' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {ht.label}
                </button>
              ))}
            </div>
          }
        >
          <div className="h-96 w-full rounded-xl overflow-hidden border border-slate-800 relative">
            <MapContainer center={[21.1820, 72.8150]} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              {heatmapNodes.map((node) => {
                const getRadius = (n) => {
                  if (heatmapType === 'density') return 25 + (n.densityIntensity || 0.5) * 35;
                  if (heatmapType === 'queue') return 20 + (n.queueIntensity || 0.5) * 40;
                  return 20 + (n.waitIntensity || 0.5) * 40;
                };

                const getColor = (n) => {
                  const val = n[`${heatmapType}Intensity`] || 0.5;
                  if (val > 0.8) return '#ef4444';
                  if (val > 0.5) return '#f59e0b';
                  return '#10b981';
                };

                return (
                  <CircleMarker
                    key={node.id}
                    center={[node.lat, node.lng]}
                    radius={getRadius(node)}
                    pathOptions={{
                      color: getColor(node),
                      fillColor: getColor(node),
                      fillOpacity: 0.35,
                      weight: 2
                    }}
                  >
                    <Popup className="custom-popup">
                      <div className="p-2 text-slate-900 text-xs">
                        <div className="font-bold text-sm mb-1">{node.name}</div>
                        <div>Density Intensity: <strong>{(node.densityIntensity * 100).toFixed(0)}%</strong></div>
                        <div>Queue Intensity: <strong>{(node.queueIntensity * 100).toFixed(0)}%</strong></div>
                        <div>Delay Intensity: <strong>{(node.waitIntensity * 100).toFixed(0)}%</strong></div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </Card>
      )}

      {/* TAB 5: DYNAMIC HOTSPOTS RANKING */}
      {activeTab === 'bottlenecks' && (
        <Card title="Corridor Bottleneck Hotspots Ranking" subtitle="Dynamic TraCI sensor ranking based on approach halting queues and localized speed drops">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-850 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="pb-3 py-2">Rank</th>
                  <th className="pb-3 py-2">Junction Location</th>
                  <th className="pb-3 py-2">Congestion Score</th>
                  <th className="pb-3 py-2">Speed</th>
                  <th className="pb-3 py-2">Avg Delay</th>
                  <th className="pb-3 py-2">Severity</th>
                  <th className="pb-3 py-2">Live Sensor Root Cause</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/50">
                {bottlenecks.map((b) => (
                  <tr key={b.rank} className="hover:bg-slate-900/30">
                    <td className="py-4 font-mono font-bold text-slate-500">#{b.rank}</td>
                    <td className="py-4 font-bold text-white">{b.location}</td>
                    <td className="py-4 font-mono text-emerald-400 font-bold">{b.score} / 100</td>
                    <td className="py-4 font-mono text-cyan-400">{b.avgSpeedKmh || 25.0} km/h</td>
                    <td className="py-4 text-slate-300">{b.avgDelay}</td>
                    <td className="py-4">
                      <Badge variant={b.severity === 'Critical' ? 'danger' : b.severity === 'High' ? 'warning' : 'info'}>
                        {b.severity}
                      </Badge>
                    </td>
                    <td className="py-4 text-slate-400">{b.primaryFactor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 6: ACTIONABLE RECOMMENDATIONS */}
      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          <Card title="Data-Driven Contextual Recommendations" subtitle="Rule-triggered engineering interventions based on measured corridor performance">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((rec) => (
                <div key={rec.id} className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-400">{rec.id}</span>
                      <span className="text-[10px] text-slate-500">• {rec.category}</span>
                    </div>
                    <Badge variant={rec.impact === 'Critical' ? 'danger' : rec.impact === 'High' ? 'warning' : 'info'}>
                      {rec.impact} Priority
                    </Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white">{rec.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{rec.description}</p>
                  <div className="pt-2 flex items-center gap-2 text-[11px] text-sky-400">
                    <span>Target: {rec.targetLocation}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
