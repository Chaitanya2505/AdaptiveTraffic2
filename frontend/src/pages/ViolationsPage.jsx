import React, { useState, useRef } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { useApi } from '../hooks/useApi';
import { useDataStore } from '../store/dataStore';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Filter, 
  Check, 
  FileText, 
  X, 
  Download, 
  AlertTriangle, 
  MapPin, 
  Camera, 
  Zap, 
  Gauge, 
  ExternalLink,
  Plus,
  Pencil,
  RotateCcw,
  Save,
  Crosshair
} from 'lucide-react';

const DEFAULT_ROIS = {
  'J-001': [
    { x: 120, y: 380 },
    { x: 380, y: 380 },
    { x: 300, y: 120 },
    { x: 180, y: 120 }
  ],
  'J-002': [
    { x: 140, y: 390 },
    { x: 360, y: 390 },
    { x: 320, y: 140 },
    { x: 200, y: 140 }
  ],
  'J-003': [
    { x: 100, y: 400 },
    { x: 400, y: 400 },
    { x: 340, y: 110 },
    { x: 160, y: 110 }
  ]
};

const SAMPLE_INTRUSIONS = [
  {
    id: 101,
    junction_id: 'J-001',
    junction_name: 'Ring Road × BRTS Corridor',
    vehicle_class: 'Private Car',
    license_plate: 'GJ-05-AB-1234',
    status: 'active',
    fine_amount: 1000,
    challan_ref: 'SMC/BRTS/2026/00101',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    evidence_image: '/sample_cctv/lane2.jpg',
    gps: '21.1702° N, 72.8311° E',
    speed_boost_gain: '+32.4%'
  },
  {
    id: 102,
    junction_id: 'J-002',
    junction_name: 'Ghod Dod Road Junction',
    vehicle_class: 'Motorbike',
    license_plate: 'GJ-05-MC-4812',
    status: 'active',
    fine_amount: 1000,
    challan_ref: 'SMC/BRTS/2026/00102',
    timestamp: new Date(Date.now() - 450000).toISOString(),
    evidence_image: '/sample_cctv/lane1.jpg',
    gps: '21.1812° N, 72.8190° E',
    speed_boost_gain: '+28.0%'
  },
  {
    id: 103,
    junction_id: 'J-003',
    junction_name: 'City Light BRTS Crossing',
    vehicle_class: 'Auto-Rickshaw',
    license_plate: 'GJ-05-CD-5678',
    status: 'acknowledged',
    fine_amount: 1000,
    challan_ref: 'SMC/BRTS/2026/00103',
    timestamp: new Date(Date.now() - 1200000).toISOString(),
    evidence_image: '/sample_cctv/lane3.jpg',
    gps: '21.1590° N, 72.7980° E',
    speed_boost_gain: '+35.2%'
  }
];

export default function ViolationsPage() {
  const junctions = useDataStore((state) => state.junctions);
  const addAlert = useDataStore((state) => state.addAlert);

  const [selectedJunction, setSelectedJunction] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [violationsList, setViolationsList] = useState(SAMPLE_INTRUSIONS);
  const [selectedChallan, setSelectedChallan] = useState(null);

  // BRTS ROI Interactive Configuration States per Camera
  const [activeRoiJunction, setActiveRoiJunction] = useState('J-001');
  const [cameraRois, setCameraRois] = useState(DEFAULT_ROIS);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [roiSavedMessage, setRoiSavedMessage] = useState(null);

  const imageContainerRef = useRef(null);

  // Active ROI points for selected camera
  const currentRoiPoints = cameraRois[activeRoiJunction] || DEFAULT_ROIS['J-001'];

  const handleImageClick = (e) => {
    if (!isDrawingMode || !imageContainerRef.current) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    // If 4 points already exist, reset and start fresh drawing
    setCameraRois(prev => {
      const existing = prev[activeRoiJunction] || [];
      const updated = existing.length >= 4 ? [{ x, y }] : [...existing, { x, y }];
      return {
        ...prev,
        [activeRoiJunction]: updated
      };
    });
  };

  const handleSaveRoi = () => {
    setIsDrawingMode(false);
    setRoiSavedMessage(`BRTS ROI Boundary configured & saved for ${activeRoiJunction}`);
    setTimeout(() => setRoiSavedMessage(null), 4000);

    addAlert({
      id: `ROI-SAVE-${Date.now()}`,
      severity: 'INFO',
      type: 'BRTS ROI Updated',
      message: `Custom BRTS lane ROI polygon updated for camera ${activeRoiJunction}`,
      timestamp: new Date().toLocaleTimeString(),
      junction_id: activeRoiJunction
    });
  };

  const handleResetRoi = () => {
    setCameraRois(prev => ({
      ...prev,
      [activeRoiJunction]: DEFAULT_ROIS[activeRoiJunction] || DEFAULT_ROIS['J-001']
    }));
    setIsDrawingMode(false);
  };

  // Filter violations list locally
  const filteredViolations = violationsList.filter(v => {
    if (selectedJunction !== 'ALL' && v.junction_id !== selectedJunction) return false;
    if (selectedStatus !== 'ALL' && v.status !== selectedStatus) return false;
    return true;
  });

  const handleAcknowledge = (id) => {
    setViolationsList(prev => prev.map(v => v.id === id ? { ...v, status: 'acknowledged' } : v));
  };

  // Simulate instant BRTS Lane Intrusion Test Event
  const handleSimulateIntrusion = () => {
    const randomPlates = ['GJ-05-XY-8821', 'GJ-05-KR-3319', 'GJ-05-ZZ-9012'];
    const randomClasses = ['Private Car', 'Motorbike', 'SUV'];
    const newId = 100 + violationsList.length + 1;
    const newPlate = randomPlates[Math.floor(Math.random() * randomPlates.length)];
    const newClass = randomClasses[Math.floor(Math.random() * randomClasses.length)];

    const newIntrusion = {
      id: newId,
      junction_id: 'J-001',
      junction_name: 'Ring Road × BRTS Corridor',
      vehicle_class: newClass,
      license_plate: newPlate,
      status: 'active',
      fine_amount: 1000,
      challan_ref: `SMC/BRTS/2026/0${newId}`,
      timestamp: new Date().toISOString(),
      evidence_image: '/sample_cctv/lane2.jpg',
      gps: '21.1702° N, 72.8311° E',
      speed_boost_gain: '+31.0%'
    };

    setViolationsList(prev => [newIntrusion, ...prev]);

    addAlert({
      id: `V-INTRUSION-${Date.now()}`,
      severity: 'CRITICAL',
      type: 'BRTS Corridor Intrusion',
      message: `UNAUTHORIZED ${newClass.toUpperCase()} (${newPlate}) INTRUSION FLAGGED AT RING ROAD BRTS CORRIDOR`,
      timestamp: new Date().toLocaleTimeString(),
      junction_id: 'J-001'
    });
  };

  // SVG Polygon Points String calculation
  const polygonPointsStr = currentRoiPoints.map(p => `${p.x},${p.y}`).join(' ');

  // Stats calculation
  const totalCount = violationsList.length;
  const pendingCount = violationsList.filter(v => v.status === 'active').length;
  const acknowledgedCount = violationsList.filter(v => v.status === 'acknowledged').length;

  return (
    <div className="space-y-6">
      {/* Page Title & Real-Time Action Header */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 shadow-lg flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">BRTS Dedicated Corridor Lane Intrusion Guard</h2>
            <Badge variant="critical" className="text-[10px] flex items-center gap-1 animate-pulse">
              <ShieldAlert className="h-3 w-3" />
              LIVE ENFORCEMENT ACTIVE
            </Badge>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Configure camera BRTS ROI boundaries, run AI-powered intrusion detection, and issue official SMC E-Challans.
          </p>
        </div>

        <Button
          onClick={handleSimulateIntrusion}
          icon={Plus}
          className="py-2.5 px-4 text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg"
        >
          Simulate BRTS Intrusion Event
        </Button>
      </div>

      {/* Analytics KPI Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Intrusions Logged</p>
          <p className="mt-2 text-2xl font-bold text-white">{totalCount}</p>
        </div>
        <div className="rounded-xl border border-slate-850 bg-red-950/15 border-l-4 border-l-red-500 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Pending E-Challan Review</p>
          <p className="mt-2 text-2xl font-bold text-red-500">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-slate-850 bg-emerald-950/15 border-l-4 border-l-emerald-500 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">E-Challans Issued & Sent</p>
          <p className="mt-2 text-2xl font-bold text-emerald-500">{acknowledgedCount}</p>
        </div>
        <div className="rounded-xl border border-slate-850 bg-cyan-950/15 border-l-4 border-l-cyan-500 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">BRTS Transit Speed Boost</p>
          <p className="mt-2 text-2xl font-extrabold text-cyan-400 font-mono">+32.4% Speed Gain</p>
        </div>
      </div>

      {/* Interactive BRTS ROI Bounding Box / Polygon Configurator Card */}
      <Card 
        title="Camera BRTS Lane ROI Configurator" 
        subtitle="Manually add or adjust the BRTS dedicated lane polygon boundary for each camera stream"
        action={
          roiSavedMessage && (
            <Badge variant="success" className="text-xs animate-bounce">
              ✓ {roiSavedMessage}
            </Badge>
          )
        }
      >
        <div className="space-y-4">
          {/* Camera Selection & Drawing Mode Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-850">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
                <Camera className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-slate-300">Target Camera:</span>
                <select
                  value={activeRoiJunction}
                  onChange={(e) => { setActiveRoiJunction(e.target.value); setIsDrawingMode(false); }}
                  className="bg-transparent text-xs font-extrabold text-white outline-none cursor-pointer"
                >
                  {junctions.map((j) => (
                    <option key={j.id} value={j.id} className="bg-slate-900 text-slate-100">
                      {j.name} ({j.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Badge */}
              <Badge variant={isDrawingMode ? 'warning' : 'info'} className="text-[11px]">
                {isDrawingMode ? '✏️ CLICK ON CAMERA FEED TO PLACE BRTS ROI CORNERS' : 'BRTS ROI ACTIVE'}
              </Badge>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDrawingMode(!isDrawingMode)}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${
                  isDrawingMode
                    ? 'bg-amber-500 text-black border-amber-400 font-extrabold shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Pencil className="h-3.5 w-3.5" />
                {isDrawingMode ? 'Cancel Drawing' : 'Draw BRTS Lane ROI'}
              </button>

              {isDrawingMode && (
                <button
                  type="button"
                  onClick={handleSaveRoi}
                  className="py-1.5 px-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-md"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save BRTS ROI
                </button>
              )}

              <button
                type="button"
                onClick={handleResetRoi}
                className="py-1.5 px-3 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>
          </div>

          {/* Interactive CCTV Canvas Container */}
          <div
            ref={imageContainerRef}
            onClick={handleImageClick}
            className={`relative aspect-video rounded-xl border overflow-hidden select-none ${
              isDrawingMode ? 'cursor-crosshair border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-slate-800 bg-slate-950'
            }`}
          >
            <img
              src={activeRoiJunction === 'J-001' ? '/sample_cctv/lane2.jpg' : activeRoiJunction === 'J-002' ? '/sample_cctv/lane1.jpg' : '/sample_cctv/lane3.jpg'}
              alt="Surat BRTS Camera Stream"
              className="h-full w-full object-cover opacity-90"
            />

            {/* Interactive SVG BRTS Lane ROI Polygon Overlay */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
              {currentRoiPoints.length > 1 && (
                <polygon
                  points={polygonPointsStr}
                  fill="rgba(6, 182, 212, 0.2)"
                  stroke={isDrawingMode ? '#f59e0b' : '#06b6d4'}
                  strokeWidth="3"
                  strokeDasharray={isDrawingMode ? '4,4' : '6,4'}
                />
              )}
              {currentRoiPoints.map((pt, pIdx) => (
                <g key={pIdx}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="6"
                    fill={isDrawingMode ? '#f59e0b' : '#06b6d4'}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <text
                    x={pt.x + 8}
                    y={pt.y - 8}
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    P{pIdx + 1} ({pt.x}, {pt.y})
                  </text>
                </g>
              ))}
              <text x="30" y="40" fill={isDrawingMode ? '#f59e0b' : '#06b6d4'} fontSize="13" fontWeight="bold" letterSpacing="1">
                BRTS LANE ROI polygon ({activeRoiJunction})
              </text>
            </svg>

            {/* Camera Overlay Badges */}
            <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold text-white z-30 border border-slate-800 flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-cyan-400" />
              CAMERA: {activeRoiJunction} • BOUNDING POINTS: {currentRoiPoints.length}/4
            </div>
          </div>
        </div>
      </Card>

      {/* Filter Toolbar Card */}
      <Card title="Violation Registry Filters" subtitle="Query incident records by location and review state">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-400">Filter:</span>
          </div>

          <div>
            <select
              value={selectedJunction}
              onChange={(e) => setSelectedJunction(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Junctions</option>
              {junctions.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="active">Active Pending Review</option>
              <option value="acknowledged">E-Challan Issued</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Violation Registry Table Card */}
      <Card title="BRTS Intrusion Incident Audit Registry">
        <div className="overflow-x-auto">
          {filteredViolations.length === 0 ? (
            <div className="text-center text-slate-500 py-10 text-sm">
              No violation records match selected criteria.
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold bg-slate-900/50">
                  <th className="py-3 px-3">Challan Ref No</th>
                  <th className="py-3 px-3">Location / Junction</th>
                  <th className="py-3 px-3">Vehicle Class</th>
                  <th className="py-3 px-3">License Plate</th>
                  <th className="py-3 px-3">Fine Penalty</th>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/50">
                {filteredViolations.map((v) => {
                  const isPending = v.status === 'active';

                  return (
                    <tr key={v.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="py-3.5 px-3 font-mono font-bold text-cyan-400">{v.challan_ref}</td>
                      <td className="py-3.5 px-3 font-semibold text-slate-200">{v.junction_name}</td>
                      <td className="py-3.5 px-3">
                        <Badge variant="warning">{v.vehicle_class}</Badge>
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-yellow-300 tracking-wider bg-slate-900/60 px-2 py-1 rounded w-fit border border-slate-800">
                        {v.license_plate}
                      </td>
                      <td className="py-3.5 px-3 font-extrabold text-red-400 font-mono">₹ {v.fine_amount} INR</td>
                      <td className="py-3.5 px-3 text-slate-400 font-mono">{new Date(v.timestamp).toLocaleString()}</td>
                      <td className="py-3.5 px-3">
                        <Badge variant={isPending ? 'danger' : 'success'}>
                          {isPending ? 'Pending Notice' : 'E-Challan Issued'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedChallan(v)}
                            className="py-1 px-2.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 font-bold text-[11px] flex items-center gap-1 transition-all"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>View SMC E-Challan</span>
                          </button>

                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleAcknowledge(v.id)}
                              className="py-1 px-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-[11px] flex items-center gap-1 transition-all"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Issue Notice</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Official Surat Municipal Corporation (SMC) E-Challan Notice Modal */}
      {selectedChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl border-2 border-blue-600 shadow-2xl p-6 text-slate-900">
            {/* Close Modal Button */}
            <button
              onClick={() => setSelectedChallan(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-black p-1.5 rounded-full hover:bg-slate-100 transition-all"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Official SMC Seal & Notice Header */}
            <div className="border-b-2 border-blue-600 pb-4 mb-5 flex items-center justify-between">
              <div>
                <div className="text-xl font-black text-blue-700 tracking-tight">SURAT MUNICIPAL CORPORATION</div>
                <div className="text-xs font-extrabold text-slate-600 tracking-wider">SURAT TRAFFIC POLICE — BRTS LANE GUARD ENFORCEMENT</div>
              </div>
              <div className="bg-red-600 text-white text-xs font-black px-3 py-1 rounded shadow">
                OFFICIAL NOTICE
              </div>
            </div>

            {/* Notice Title Banner */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-center mb-5">
              <div className="text-sm font-extrabold text-red-600 uppercase tracking-wide">
                ELECTRONIC FINE NOTICE / ઈ-ચલણ નોટિસ
              </div>
              <div className="text-[11px] text-red-800 font-medium">
                Offence: Unauthorized Vehicle Intrusion inside Dedicated BRTS Bus Corridor
              </div>
            </div>

            {/* Incident Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs mb-5">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Challan Reference No</span>
                <span className="font-mono font-extrabold text-blue-700 text-sm">{selectedChallan.challan_ref}</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Vehicle License Plate</span>
                <span className="font-mono font-black text-sm bg-yellow-300 text-black px-2 py-0.5 rounded border border-yellow-500 inline-block">
                  {selectedChallan.license_plate}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Penalty Fine Amount</span>
                <span className="font-extrabold text-red-600 text-sm">₹ {selectedChallan.fine_amount} INR</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Vehicle Classification</span>
                <span className="font-bold text-slate-800">{selectedChallan.vehicle_class} (NOT BRTS)</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Date & Timestamp</span>
                <span className="font-mono text-slate-700">{new Date(selectedChallan.timestamp).toLocaleString()}</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Location / GPS Coordinates</span>
                <span className="font-semibold text-slate-800">{selectedChallan.junction_name} ({selectedChallan.gps})</span>
              </div>
            </div>

            {/* Evidence Photo Snapshot Box */}
            <div className="mb-5">
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-2">High-Resolution Evidence Snapshot</span>
              <div className="relative aspect-video rounded-xl border border-slate-900 bg-black overflow-hidden flex items-center justify-center">
                <img
                  src={selectedChallan.evidence_image}
                  alt="BRTS Intrusion Evidence"
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-black/80 text-white text-[10px] font-mono px-2 py-1 rounded">
                  EVIDENCE SNAPSHOT • {selectedChallan.license_plate} IN BRTS CORRIDOR
                </div>
              </div>
            </div>

            {/* Official Online Payment Callout */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center space-y-2">
              <div className="text-xs font-bold text-blue-900">Pay your SMC E-Challan Online within 15 Days</div>
              <div className="text-[11px] text-slate-600">Official Portal: <strong>suratmunicipal.gov.in/echallan</strong></div>
              <a
                href="https://suratmunicipal.gov.in"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-lg transition-all shadow-md mt-1"
              >
                <span>Pay ₹ {selectedChallan.fine_amount} Online Now</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
