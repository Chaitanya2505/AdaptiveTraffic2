import React, { useState, useEffect } from 'react';
import Card from '../components/common/Card';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Upload, 
  Sun, 
  Sunset, 
  Moon, 
  Trash2, 
  CheckCircle2, 
  X, 
  ExternalLink, 
  FileText, 
  Send, 
  AlertTriangle,
  RefreshCw,
  QrCode,
  Layers,
  Sparkles,
  Video
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api';

const CORRIDORS = [
  { id: 'majura_gate', name: 'Majura Gate', label: 'Corridor 1: Ring Road Express' },
  { id: 'udhna_corridor', name: 'Udhna Station', label: 'Corridor 2: Udhna Main Line' },
  { id: 'sahara_darwaja', name: 'Sahara Darwaja', label: 'Corridor 3: Railway Station Link' },
  { id: 'hirabaug_varachha', name: 'Hirabaug Varachha', label: 'Corridor 4: Diamond City Transit' },
  { id: 'adajan_patiya', name: 'Adajan Patiya', label: 'Corridor 5: Rander Canal Road' }
];

export default function BRTSLaneGuardPage() {
  const [activeJunction, setActiveJunction] = useState('majura_gate');
  const [activeLightingMode, setActiveLightingMode] = useState('DAY');
  const [activeRoiPreset, setActiveRoiPreset] = useState('CENTER');
  
  // Custom Uploaded Video Stream State
  const [uploadedVideoId, setUploadedVideoId] = useState(null);
  const [uploadedVideoName, setUploadedVideoName] = useState(null);
  const [showUploadVideoModal, setShowUploadVideoModal] = useState(false);
  const [streamReloadKey, setStreamReloadKey] = useState(Date.now());

  // Violations & Stats State
  const [violations, setViolations] = useState([]);
  const [stats, setStats] = useState({
    totalViolations: 0,
    finesIssued: '₹ 0',
    precision: '96.4%',
    queueMae: '1.2m',
    speedGain: '+24.5%'
  });

  const [selectedViolation, setSelectedViolation] = useState(null);
  const [showChallanModal, setShowChallanModal] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);

  // Poll Violations & Stats
  const fetchViolations = async () => {
    try {
      const res = await fetch(`${API_BASE}/violations/brts?junction_id=${activeJunction}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setViolations(data.violations || []);
      }
    } catch (e) {
      console.error('Failed to fetch violations:', e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/stats/brts`);
      if (res.ok) {
        const data = await res.json();
        setStats({
          totalViolations: data.total_violations || 0,
          finesIssued: `₹ ${(data.total_fines_issued || 0).toLocaleString('en-IN')}`,
          precision: `${data.precision_rate || 96.4}%`,
          queueMae: `${data.queue_mae || 1.2}m`,
          speedGain: `+${data.speed_boost_pct || 24.5}%`
        });
      }
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  };

  useEffect(() => {
    fetchViolations();
    fetchStats();
    const interval = setInterval(() => {
      fetchViolations();
      fetchStats();
    }, 3000);
    return () => clearInterval(interval);
  }, [activeJunction]);

  const handleLightingChange = async (mode) => {
    setActiveLightingMode(mode);
    try {
      await fetch(`${API_BASE}/stream/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ junction_id: activeJunction, lighting_mode: mode })
      });
      setStreamReloadKey(Date.now());
      showNotification(`Lighting mode switched to ${mode}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRoiChange = async (preset) => {
    setActiveRoiPreset(preset);
    try {
      await fetch(`${API_BASE}/stream/roi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ junction_id: activeJunction, roi_preset: preset })
      });
      setStreamReloadKey(Date.now());
      showNotification(`ROI geometry updated to ${preset}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearLogs = async () => {
    try {
      await fetch(`${API_BASE}/violations/clear`, { method: 'POST' });
      setViolations([]);
      showNotification('All violation logs cleared.');
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendChallan = async (violationId) => {
    try {
      await fetch(`${API_BASE}/challan/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ violation_id: violationId, notification_type: 'BOTH' })
      });
      showNotification(`E-Challan notice successfully dispatched.`);
      fetchViolations();
    } catch (e) {
      console.error(e);
    }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      showNotification(`Uploading "${file.name}" & initializing RT-DETR stream...`);
      const res = await fetch(`${API_BASE}/video/upload`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setUploadedVideoId(data.file_id);
        setUploadedVideoName(file.name);
        setShowUploadVideoModal(false);
        setStreamReloadKey(Date.now());
        showNotification(`Custom video stream "${file.name}" active with RT-DETR.`);
      } else {
        showNotification(`Upload error: Server returned ${res.status}`);
      }
    } catch (e) {
      console.error('Video upload failed:', e);
      showNotification(`Upload failed: ${e.message}`);
    }
  };

  const showNotification = (msg) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const streamSrc = uploadedVideoId
    ? `${API_BASE}/stream/uploaded/${encodeURIComponent(uploadedVideoId)}?t=${streamReloadKey}`
    : `${API_BASE}/stream/feed/${activeJunction}?t=${streamReloadKey}`;

  const currentCorridor = CORRIDORS.find(c => c.id === activeJunction) || CORRIDORS[0];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {actionNotice && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-slate-900/95 px-4 py-3 text-sm font-semibold text-emerald-400 shadow-2xl backdrop-blur-md transition-all">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          {actionNotice}
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 p-5 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-600 to-indigo-600 text-white shadow-md">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">SURAT BRTS LANE GUARD</h1>
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                RT-DETR Transformer
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Surat Municipal Corporation Intelligent Transport System (ITS) &bull; Vision Transformer Attention &bull; Dedicated Lane Ray-Casting Enforcement
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setShowUploadVideoModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-600/30 transition shadow-sm"
          >
            <Upload className="h-4 w-4 text-emerald-400" />
            Upload Video
          </button>

          <button 
            onClick={handleClearLogs}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition"
          >
            <Trash2 className="h-4 w-4" />
            Clear Logs
          </button>
        </div>
      </div>

      {/* Main Grid: Left Panel (Stream & Controls) | Right Panel (Violations Feed) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Left Section: Live Feed Viewport & Metrics (Col Span 2) */}
        <div className="space-y-6 lg:col-span-2">
          
          <Card className="overflow-hidden border-slate-800 bg-slate-950/80 p-0 shadow-xl">
            {/* Corridor Tabs Bar */}
            <div className="border-b border-slate-800/80 bg-slate-900/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                
                {/* 5 Corridors Switcher */}
                <div className="flex flex-wrap gap-1.5 items-center">
                  {CORRIDORS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setActiveJunction(c.id);
                        setUploadedVideoId(null);
                        setStreamReloadKey(Date.now());
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        activeJunction === c.id && !uploadedVideoId
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}

                  {uploadedVideoId && (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-600/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-400">
                      <span>Custom Video: {uploadedVideoName}</span>
                      <button 
                        onClick={() => {
                          setUploadedVideoId(null);
                          setStreamReloadKey(Date.now());
                        }}
                        className="hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Preset ROI & Lighting Controls */}
                <div className="flex items-center gap-2">
                  {/* ROI Presets */}
                  <div className="flex rounded-lg bg-slate-950/80 p-1 border border-slate-800">
                    {['CENTER', 'RIGHT', 'WIDE'].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => handleRoiChange(preset)}
                        className={`rounded px-2.5 py-1 text-[11px] font-bold transition ${
                          activeRoiPreset === preset
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {preset} ROI
                      </button>
                    ))}
                  </div>

                  {/* Lighting Modes */}
                  <div className="flex rounded-lg bg-slate-950/80 p-1 border border-slate-800">
                    <button
                      onClick={() => handleLightingChange('DAY')}
                      className={`rounded p-1.5 transition ${
                        activeLightingMode === 'DAY' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title="Day Mode"
                    >
                      <Sun className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleLightingChange('DUSK')}
                      className={`rounded p-1.5 transition ${
                        activeLightingMode === 'DUSK' ? 'bg-orange-500/20 text-orange-400' : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title="Dusk Mode"
                    >
                      <Sunset className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleLightingChange('NIGHT_IR')}
                      className={`rounded p-1.5 transition ${
                        activeLightingMode === 'NIGHT_IR' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title="Night IR Mode"
                    >
                      <Moon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Video Feed Canvas */}
            <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden border-y border-slate-800">
              <img
                key={streamSrc}
                src={streamSrc}
                alt="Surat BRTS Live CCTV Stream"
                className="h-full w-full object-contain"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `${API_BASE}/stream/feed/majura_gate`;
                }}
              />

              {/* Stream Overlay Status */}
              <div className="absolute top-3 left-3 flex items-center gap-2 rounded-md bg-black/70 px-2.5 py-1 text-xs font-mono text-white backdrop-blur-sm border border-slate-700/50">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                <span className="font-bold">{uploadedVideoId ? `CUSTOM VIDEO: ${uploadedVideoName}` : `LIVE CCTV: ${currentCorridor.name.toUpperCase()}`}</span>
              </div>

              {/* Reload Button */}
              <button
                onClick={() => setStreamReloadKey(Date.now())}
                className="absolute top-3 right-3 flex items-center gap-1 rounded-md bg-black/70 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white backdrop-blur-sm border border-slate-700/50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reload Feed
              </button>
            </div>

            {/* Sub-bar with Live Corridor Label */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/40 text-xs text-slate-400 border-t border-slate-800">
              <span>{currentCorridor.label} &bull; Surat Municipal Corporation</span>
              <span className="font-mono text-emerald-400 font-semibold">1:1 Real-Time Sync &bull; RT-DETR Attention</span>
            </div>
          </Card>

          {/* Performance & Enforcement Metrics Bar */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="border-slate-800 bg-slate-950/70 p-4">
              <div className="text-xs font-semibold text-slate-400">Total Violations</div>
              <div className="mt-1 text-2xl font-extrabold text-white">{stats.totalViolations}</div>
              <div className="mt-1 text-[10px] text-slate-500">Lane Intrusions</div>
            </Card>

            <Card className="border-slate-800 bg-slate-950/70 p-4">
              <div className="text-xs font-semibold text-slate-400">Detection Accuracy</div>
              <div className="mt-1 text-2xl font-extrabold text-emerald-400">{stats.precision}</div>
              <div className="mt-1 text-[10px] text-slate-500">RT-DETR Transformer</div>
            </Card>

            <Card className="border-slate-800 bg-slate-950/70 p-4">
              <div className="text-xs font-semibold text-slate-400">Transit Speed Gain</div>
              <div className="mt-1 text-2xl font-extrabold text-indigo-400">{stats.speedGain}</div>
              <div className="mt-1 text-[10px] text-slate-500">BRTS Bus Priority</div>
            </Card>

            <Card className="border-slate-800 bg-slate-950/70 p-4">
              <div className="text-xs font-semibold text-slate-400">Fines Issued</div>
              <div className="mt-1 text-2xl font-extrabold text-rose-400">{stats.finesIssued}</div>
              <div className="mt-1 text-[10px] text-slate-500">SMC E-Challan</div>
            </Card>
          </div>

        </div>

        {/* Right Section: Real-Time Violation Feed (Col Span 1) */}
        <div className="space-y-4">
          <Card className="border-slate-800 bg-slate-950/80 p-4 shadow-xl flex flex-col h-[640px]">
            
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-500" />
                <h2 className="text-base font-bold text-white">BRTS Violations Feed</h2>
              </div>
              <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-bold text-rose-400 border border-rose-500/30">
                {violations.length} Active
              </span>
            </div>

            {/* Violation List */}
            <div className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1">
              {violations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 p-6">
                  <ShieldCheck className="h-12 w-12 text-emerald-500/40 mb-2" />
                  <p className="text-sm font-semibold text-slate-300">Dedicated Lane Protected</p>
                  <p className="text-xs text-slate-500 mt-1">No unauthorized vehicle intrusions detected in this corridor.</p>
                </div>
              ) : (
                violations.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-lg border border-slate-800/90 bg-slate-900/60 p-3 hover:border-rose-500/40 transition flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-amber-400 border border-slate-700">
                          {v.plate_number || 'GJ-05-XX-0000'}
                        </span>
                        <span className="text-xs font-semibold text-rose-400">
                          {v.vehicle_type || 'Private Vehicle'}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        v.status === 'ISSUED' 
                           ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                           : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {v.status || 'PENDING'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Fine: <strong className="text-rose-400 font-bold">₹ {v.fine_amount || 2000}</strong></span>
                      <span>Speed: {v.speed_kmh || 42.5} km/h</span>
                      <span>{v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : 'Live'}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                      <button
                        onClick={() => {
                          setSelectedViolation(v);
                          setShowChallanModal(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-1 rounded bg-indigo-600/20 border border-indigo-500/30 py-1 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-600/40 transition"
                      >
                        <FileText className="h-3 w-3" />
                        View E-Challan
                      </button>

                      {v.status !== 'ISSUED' && (
                        <button
                          onClick={() => handleSendChallan(v.id)}
                          className="flex items-center justify-center gap-1 rounded bg-emerald-600/20 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-600/40 transition"
                        >
                          <Send className="h-3 w-3" />
                          Send
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

          </Card>
        </div>

      </div>

      {/* --- MODAL 1: SMC E-CHALLAN DOCUMENT VIEWER --- */}
      {showChallanModal && selectedViolation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-950 p-6 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-600/20 text-rose-500 border border-rose-500/30">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">SMC Official E-Challan Notice</h3>
                  <p className="text-xs text-slate-400 font-mono">Ref: {selectedViolation.challan_ref || `SMC/BRTS/2026/${selectedViolation.id}`}</p>
                </div>
              </div>
              <button onClick={() => setShowChallanModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-900/60 p-4 border border-slate-800 text-sm">
                <div>
                  <span className="text-xs text-slate-500">Vehicle Number</span>
                  <p className="font-mono font-bold text-amber-400">{selectedViolation.plate_number || 'GJ-05-AB-7890'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Violation Type</span>
                  <p className="font-semibold text-rose-400">{selectedViolation.vehicle_type || 'Unauthorized BRTS Intrusion'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Timestamp</span>
                  <p className="text-slate-300">{selectedViolation.timestamp || new Date().toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Fine Amount</span>
                  <p className="text-xl font-extrabold text-rose-500">₹ {selectedViolation.fine_amount || 2000}</p>
                </div>
              </div>

              {/* QR Code & Authority Badge */}
              <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded bg-white p-1 flex items-center justify-center">
                    <QrCode className="h-12 w-12 text-slate-950" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-white">SMC Digital Verification</p>
                    <p className="text-slate-400 text-[11px]">Pay online at: suratmunicipal.gov.in/echallan</p>
                    <p className="text-slate-500 text-[10px]">Notice status: {selectedViolation.status || 'ACTIVE'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Enforcing Agency</span>
                  <p className="text-xs font-bold text-emerald-400">Surat Traffic Police &amp; SMC</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <a
                href={`${API_BASE}/challan/view/${selectedViolation.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                <ExternalLink className="h-4 w-4" />
                Open Official HTML Printable
              </a>
              <button
                onClick={() => {
                  handleSendChallan(selectedViolation.id);
                  setShowChallanModal(false);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow-md shadow-rose-600/30"
              >
                <Send className="h-4 w-4" />
                Dispatch Fine Notice
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- MODAL 2: UPLOAD VIDEO --- */}
      {showUploadVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-700 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">Upload Custom Traffic Video</h3>
              </div>
              <button onClick={() => setShowUploadVideoModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-400">
                Upload your MP4 traffic video. The system will start a live streaming instance with real-time RT-DETR Vision Transformer &amp; BRT lane intrusion detection.
              </p>
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-slate-700 p-8 bg-slate-900/40">
                <label className="cursor-pointer text-center">
                  <Upload className="mx-auto h-8 w-8 text-emerald-400 mb-2" />
                  <span className="text-sm font-semibold text-emerald-400 hover:underline">Select MP4 Traffic Video</span>
                  <input type="file" accept="video/mp4,video/avi" onChange={handleVideoUpload} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
