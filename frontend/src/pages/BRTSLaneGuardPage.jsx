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
  Gauge,
  Clock
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
      const res = await fetch(`${API_BASE}/violations/brts?junction_id=${activeJunction}&limit=50`);
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
      showNotification(`ROI preset changed to ${preset}`);
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

      {/* Header Banner - Clean Unified Dark Theme */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border border-slate-800 bg-slate-950 p-5 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-white">SURAT BRTS LANE GUARD</h1>
              <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                RT-DETR Transformer
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Surat Municipal Corporation &bull; Intelligent Transport System &bull; Dedicated Lane Enforcement
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setShowUploadVideoModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 transition shadow-sm"
          >
            <Upload className="h-4 w-4 text-emerald-400" />
            Upload Video
          </button>

          <button 
            onClick={handleClearLogs}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition"
          >
            <Trash2 className="h-4 w-4" />
            Clear Logs
          </button>
        </div>
      </div>

      {/* 1. Main Live Video Stream Viewport (Full Width) */}
      <Card className="overflow-hidden border-slate-800 bg-slate-950 p-0 shadow-xl">
        {/* Corridor Tabs Bar */}
        <div className="border-b border-slate-800 bg-slate-900/70 p-3">
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
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeJunction === c.id && !uploadedVideoId
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
                  }`}
                >
                  {c.name}
                </button>
              ))}

              {uploadedVideoId && (
                <div className="flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-semibold text-emerald-400">
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
          <div className="absolute top-3 left-3 flex items-center gap-2 rounded-md bg-slate-950/80 px-2.5 py-1 text-xs font-mono text-white backdrop-blur-sm border border-slate-800">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold">{uploadedVideoId ? `CUSTOM VIDEO: ${uploadedVideoName}` : `LIVE CCTV: ${currentCorridor.name.toUpperCase()}`}</span>
          </div>

          {/* Reload Button */}
          <button
            onClick={() => setStreamReloadKey(Date.now())}
            className="absolute top-3 right-3 flex items-center gap-1 rounded-md bg-slate-950/80 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white backdrop-blur-sm border border-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload Feed
          </button>
        </div>

        {/* Sub-bar with Live Corridor Label */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/60 text-xs text-slate-400 border-t border-slate-800">
          <span>{currentCorridor.label} &bull; Surat Municipal Corporation</span>
          <span className="font-mono text-slate-300 font-semibold">1:1 Real-Time Sync &bull; RT-DETR Attention</span>
        </div>
      </Card>

      {/* 3. Real-Time Violations Feed (Full-Width Section Below Stream) */}
      <Card className="border-slate-800 bg-slate-950 p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <h2 className="text-sm font-bold text-white">BRTS Corridor Violations Log</h2>
          </div>
          <span className="rounded bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-slate-300 border border-slate-700">
            {violations.length} Active Records
          </span>
        </div>

        {violations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
            <ShieldCheck className="h-8 w-8 text-emerald-500/40 mb-1.5" />
            <p className="text-xs font-semibold text-slate-300">Dedicated Lane Protected</p>
            <p className="text-[11px] text-slate-500 mt-0.5">No unauthorized vehicle intrusions currently detected in this corridor.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Ref Challan #</th>
                  <th className="py-3 px-4">License Plate</th>
                  <th className="py-3 px-4">Offending Vehicle</th>
                  <th className="py-3 px-4">Fine Amount</th>
                  <th className="py-3 px-4">Speed</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-slate-300">
                {violations.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {v.challan_ref || `SMC/BRTS/2026/00${v.id}`}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-yellow-400 font-extrabold">
                        {v.plate_number || 'GJ-05-XX-0000'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-200">
                      {v.vehicle_type || 'Private Vehicle'}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-rose-400">
                      ₹ {v.fine_amount || 1000}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {v.speed_kmh || 42.5} km/h
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : 'Live'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        v.status === 'ISSUED' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        {v.status || 'PENDING'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedViolation(v);
                          setShowChallanModal(true);
                        }}
                        className="py-1 px-2.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-[11px] transition inline-flex items-center gap-1"
                      >
                        <FileText className="h-3 w-3" /> View E-Challan
                      </button>

                      {v.status !== 'ISSUED' && (
                        <button
                          onClick={() => handleSendChallan(v.id)}
                          className="py-1 px-2.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 font-semibold text-[11px] transition inline-flex items-center gap-1"
                        >
                          <Send className="h-3 w-3" /> Send
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* --- MODAL 1: SMC E-CHALLAN DOCUMENT VIEWER --- */}
      {showChallanModal && selectedViolation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-rose-400 border border-slate-700">
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
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition shadow-sm"
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
          <div className="relative w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
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
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-slate-800 p-8 bg-slate-900/40">
                <label className="cursor-pointer text-center">
                  <Upload className="mx-auto h-8 w-8 text-emerald-400 mb-2" />
                  <span className="text-sm font-semibold text-slate-200 hover:text-emerald-400 hover:underline">Select MP4 Traffic Video</span>
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
