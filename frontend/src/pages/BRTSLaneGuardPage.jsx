import React, { useState, useEffect, useRef, useCallback } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import {
  ShieldAlert,
  ShieldCheck,
  Upload,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  RotateCcw,
  Save
} from 'lucide-react';

const BRTS_API = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/brts';
const VIOLATIONS_POLL_MS = 8000; // deliberately gentle - avoids hammering the DB/event loop

// Simple client-side state machine: idle -> uploading -> streaming -> error
export default function BRTSLaneGuardPage() {
  const [phase, setPhase] = useState('idle'); // idle | uploading | streaming | error
  const [errorMsg, setErrorMsg] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null); // { session_id, junction_label, ... }
  const [junctionLabel, setJunctionLabel] = useState('Test Corridor A');
  const [violations, setViolations] = useState([]);
  const [streamKey, setStreamKey] = useState(Date.now());
  const [toast, setToast] = useState(null);

  // ROI drawing state: `roi` is the saved polygon (normalized 0-1 points, from the backend).
  // `drawPoints` is only used while actively drawing a new one (also normalized 0-1).
  const [roi, setRoi] = useState(null);
  const [isDrawingRoi, setIsDrawingRoi] = useState(false);
  const [drawPoints, setDrawPoints] = useState([]);

  const fileInputRef = useRef(null);
  const pollRef = useRef(null);
  const mediaContainerRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // --- On mount: recover whatever session is already active on the backend ---
  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch(`${BRTS_API}/status`);
      const data = await res.json();
      if (data.active) {
        setSessionInfo(data);
        setPhase(data.error ? 'error' : 'streaming');
        if (data.error) setErrorMsg(data.error);
        if (data.roi) setRoi(data.roi);
      } else {
        setSessionInfo(null);
        setRoi(null);
        setPhase('idle');
      }
    } catch (e) {
      console.error('[BRTS] status check failed:', e);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // --- Poll violations only while a video is actively streaming, and only while the tab is visible ---
  const fetchViolations = useCallback(async () => {
    try {
      const res = await fetch(`${BRTS_API}/violations?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setViolations(data.violations || []);
      }
    } catch (e) {
      console.error('[BRTS] fetch violations failed:', e);
    }
  }, []);

  useEffect(() => {
    if (phase !== 'streaming') return undefined;

    fetchViolations();
    const tick = () => {
      if (document.visibilityState === 'visible') fetchViolations();
    };
    pollRef.current = setInterval(tick, VIOLATIONS_POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [phase, fetchViolations]);

  // Also periodically confirm the session is still healthy (catches backend-side errors/end-of-video)
  useEffect(() => {
    if (phase !== 'streaming') return undefined;
    const interval = setInterval(refreshStatus, VIOLATIONS_POLL_MS);
    return () => clearInterval(interval);
  }, [phase, refreshStatus]);

  const handleUpload = async (file) => {
    if (!file) return;
    setPhase('uploading');
    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('junction_label', junctionLabel || 'Test Corridor');

    try {
      const res = await fetch(`${BRTS_API}/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `Upload failed (${res.status})`);
      }
      setSessionInfo(data);
      if (data.roi) setRoi(data.roi);
      setStreamKey(Date.now());
      setPhase('streaming');
      showToast(`"${file.name}" is now streaming with live BRTS detection.`);
    } catch (e) {
      setErrorMsg(e.message || 'Upload failed');
      setPhase('error');
    }
  };

  const handleRemoveVideo = async () => {
    try {
      await fetch(`${BRTS_API}/video`, { method: 'DELETE' });
    } catch (e) {
      console.error('[BRTS] remove video failed:', e);
    } finally {
      setSessionInfo(null);
      setViolations([]);
      setRoi(null);
      setPhase('idle');
      showToast('Video removed. Ready for a new upload.');
    }
  };

  // --- ROI drawing: click up to 4 corner points on the video, then save ---
  const handleStartDrawingRoi = () => {
    setDrawPoints([]);
    setIsDrawingRoi(true);
  };

  const handleCancelDrawingRoi = () => {
    setIsDrawingRoi(false);
    setDrawPoints([]);
  };

  const handleMediaClick = (e) => {
    if (!isDrawingRoi || !mediaContainerRef.current) return;
    const rect = mediaContainerRef.current.getBoundingClientRect();
    // Store as normalized 0-1 coords right away - matches what the backend expects
    // and stays correct across any container resize, no re-measuring needed later.
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setDrawPoints((prev) => {
      if (prev.length >= 4) return [{ x, y }]; // start over once 4 corners are placed
      return [...prev, { x, y }];
    });
  };

  const handleSaveRoi = async () => {
    if (drawPoints.length < 3) return;
    const normalized = drawPoints.map((p) => [p.x, p.y]);

    try {
      const res = await fetch(`${BRTS_API}/roi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: normalized })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to save ROI');
      setRoi(data.roi);
      setIsDrawingRoi(false);
      setDrawPoints([]);
      showToast('BRTS lane ROI updated.');
    } catch (e) {
      showToast(`ROI save failed: ${e.message}`);
    }
  };

  const handleResetRoi = async () => {
    try {
      const res = await fetch(`${BRTS_API}/roi/reset`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setRoi(data.roi);
        showToast('ROI reset to default.');
      }
    } catch (e) {
      console.error('[BRTS] reset ROI failed:', e);
    }
    setIsDrawingRoi(false);
    setDrawPoints([]);
  };

  const handleAckViolation = async (id) => {
    try {
      await fetch(`${BRTS_API}/violations/${id}/ack`, { method: 'POST' });
      fetchViolations();
    } catch (e) {
      console.error('[BRTS] acknowledge failed:', e);
    }
  };

  const streamSrc = `${BRTS_API}/stream?t=${streamKey}`;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-slate-900/95 px-4 py-3 text-sm font-semibold text-emerald-400 shadow-2xl backdrop-blur-md">
          <CheckCircle2 className="h-5 w-5" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border border-slate-800 bg-slate-950 p-5 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-white">SURAT BRTS LANE GUARD</h1>
              <Badge variant="success">UVH-26 Live Detection</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Surat Municipal Corporation &bull; UVH-26 Indian traffic model &bull; real OCR &bull; live BRTS bus vs. intrusion detection
            </p>
          </div>
        </div>

        {phase === 'streaming' && (
          <Button variant="danger" icon={Trash2} onClick={handleRemoveVideo}>
            Remove Video
          </Button>
        )}
      </div>

      {/* Main viewport / upload dropzone */}
      <Card className="overflow-hidden border-slate-800 bg-slate-950 p-0 shadow-xl">
        {phase === 'idle' && (
          <div className="p-8 space-y-5">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Junction / Corridor Label</label>
              <input
                type="text"
                value={junctionLabel}
                onChange={(e) => setJunctionLabel(e.target.value)}
                placeholder="e.g. Majura Gate BRTS Junction"
                className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
              />
            </div>

            <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/40 p-12 text-center cursor-pointer hover:border-cyan-500/50 hover:bg-slate-900/60 transition-all">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/avi,video/webm,video/quicktime"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                className="hidden"
              />
              <Upload className="h-8 w-8 text-cyan-400 mb-2" />
              <p className="text-sm font-semibold text-slate-200">Upload a traffic video to start detection</p>
              <p className="text-xs text-slate-500 mt-1">MP4, AVI, MOV or WEBM &bull; one active video at a time</p>
            </label>
          </div>
        )}

        {phase === 'uploading' && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-300">
            <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
            <p className="text-sm font-semibold">Uploading &amp; initializing detection session&hellip;</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
            <AlertTriangle className="h-8 w-8 text-rose-400" />
            <p className="text-sm font-bold text-rose-400">Something went wrong</p>
            <p className="text-xs text-slate-400 max-w-md">{errorMsg}</p>
            <Button variant="outline" icon={RefreshCw} onClick={() => { setPhase('idle'); setErrorMsg(''); }}>
              Try Again
            </Button>
          </div>
        )}

        {phase === 'streaming' && (
          <>
            {/* ROI toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-3 border-b border-slate-850">
              <span className="text-xs font-bold text-slate-300">
                BRTS Lane ROI &mdash; only vehicles inside this area are checked for intrusion
              </span>
              <div className="flex items-center gap-2">
                {!isDrawingRoi ? (
                  <button
                    onClick={handleStartDrawingRoi}
                    className="py-1.5 px-3 rounded-lg text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-all flex items-center gap-1.5"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Draw ROI
                  </button>
                ) : (
                  <>
                    <span className="text-[11px] text-cyan-400 font-mono">{drawPoints.length}/4 corners placed</span>
                    <button
                      onClick={handleCancelDrawingRoi}
                      className="py-1.5 px-3 rounded-lg text-xs font-bold bg-slate-900 text-slate-400 border border-slate-800 hover:text-white transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveRoi}
                      disabled={drawPoints.length < 3}
                      className="py-1.5 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white transition-all flex items-center gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save ROI
                    </button>
                  </>
                )}
                <button
                  onClick={handleResetRoi}
                  className="py-1.5 px-3 rounded-lg text-xs font-bold bg-slate-900 text-slate-400 border border-slate-800 hover:text-white transition-all flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              </div>
            </div>

            <div
              ref={mediaContainerRef}
              onClick={handleMediaClick}
              className={`relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden ${
                isDrawingRoi ? 'cursor-crosshair' : ''
              }`}
            >
              <img
                key={streamSrc}
                src={streamSrc}
                alt="BRTS Live Detection Stream"
                className="h-full w-full object-contain pointer-events-none"
              />

              {/* ROI overlay - shows the polygon currently being drawn, or the saved one */}
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none z-10">
                {isDrawingRoi ? (
                  <>
                    {drawPoints.length > 1 && (
                      <polygon
                        points={drawPoints.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
                        fill="rgba(245, 158, 11, 0.25)"
                        stroke="#f59e0b"
                        strokeWidth="0.6"
                        strokeDasharray="1.5,1.5"
                      />
                    )}
                    {drawPoints.map((p, i) => (
                      <circle key={i} cx={p.x * 100} cy={p.y * 100} r="1.2" fill="#f59e0b" stroke="#fff" strokeWidth="0.4" />
                    ))}
                  </>
                ) : (
                  roi && roi.length >= 3 && (
                    <polygon
                      points={roi.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}
                      fill="rgba(6, 182, 212, 0.15)"
                      stroke="#06b6d4"
                      strokeWidth="0.6"
                      strokeDasharray="2,1.5"
                    />
                  )
                )}
              </svg>

              <div className="absolute top-3 left-3 flex items-center gap-2 rounded-md bg-slate-950/80 px-2.5 py-1 text-xs font-mono text-white backdrop-blur-sm border border-slate-800 z-20">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                {sessionInfo?.junction_label || junctionLabel}
              </div>
              <button
                onClick={() => setStreamKey(Date.now())}
                className="absolute top-3 right-3 flex items-center gap-1 rounded-md bg-slate-950/80 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white backdrop-blur-sm border border-slate-800 z-20"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reload
              </button>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/60 text-xs text-slate-400 border-t border-slate-800">
              <span>Session: {sessionInfo?.session_id}</span>
              <span className="font-mono text-slate-300">Non-blocking inference &bull; real OCR</span>
            </div>
          </>
        )}
      </Card>

      {/* Violations log */}
      {phase === 'streaming' && (
        <Card className="border-slate-800 bg-slate-950 p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-400" />
              <h2 className="text-sm font-bold text-white">BRTS Corridor Violations Log</h2>
            </div>
            <span className="rounded bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-slate-300 border border-slate-700">
              {violations.length} Records
            </span>
          </div>

          {violations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
              <ShieldCheck className="h-8 w-8 text-emerald-500/40 mb-1.5" />
              <p className="text-xs font-semibold text-slate-300">Dedicated Lane Protected</p>
              <p className="text-[11px] text-slate-500 mt-0.5">No unauthorized (NOT BRTS) vehicle intrusions detected yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Vehicle (NOT BRTS)</th>
                    <th className="py-3 px-4">License Plate</th>
                    <th className="py-3 px-4">Confidence</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-slate-300">
                  {violations.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4">
                        <Badge variant="danger">{v.vehicle_label}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-mono border px-2 py-0.5 rounded font-extrabold ${
                          v.license_plate === 'UNREADABLE'
                            ? 'bg-rose-950/40 border-rose-800 text-rose-400'
                            : 'bg-slate-900 border-slate-800 text-yellow-400'
                        }`}>
                          {v.license_plate}
                        </span>
                        {v.ocr_error && (
                          <p className="mt-1 text-[10px] text-rose-400/80 max-w-[200px]" title={v.ocr_error}>
                            {v.ocr_error}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">{Math.round(v.confidence * 100)}%</td>
                      <td className="py-3 px-4 text-slate-400">
                        {v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : 'Live'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          v.status === 'ISSUED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {v.status !== 'ISSUED' && (
                          <button
                            onClick={() => handleAckViolation(v.id)}
                            className="py-1 px-2.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 font-semibold text-[11px] transition inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Issue Challan
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
      )}
    </div>
  );
}
