import React, { useState } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { useApi } from '../hooks/useApi';
import { useDataStore } from '../store/dataStore';
import { Camera, Upload, AlertCircle, Eye } from 'lucide-react';

export default function VisionPage() {
  const junctions = useDataStore((state) => state.junctions);
  const [selectedJunction, setSelectedJunction] = useState('J-001');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [detectionResult, setDetectionResult] = useState(null);
  
  const { loading, error, request } = useApi();
  const addAlert = useDataStore((state) => state.addAlert);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 4); // Max 4 lanes
    if (files.length > 0) {
      setSelectedFiles(files);
      setImagePreviews(files.map(f => URL.createObjectURL(f)));
      setDetectionResult(null); // Clear previous results
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;

    const formData = new FormData();
    selectedFiles.forEach(f => formData.append('files', f));
    formData.append('junction_id', selectedJunction);

    try {
      const data = await request('post', '/vision/detect-batch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDetectionResult(data);
      
      // If violations were detected, inject them into the alerts feed
      const totalViolations = data.detections?.flat()?.filter(d => d.lane_id === 'L2' && d.vehicle_class !== 'bus').length || 0;
      if (totalViolations > 0) {
        addAlert({
          id: `V-UPLOAD-${Date.now()}`,
          severity: 'CRITICAL',
          type: 'BRTS Corridor Intrusion',
          message: `${totalViolations} lane violations flagged by YOLOv11 at ${junctions.find(j => j.id === selectedJunction)?.name}`,
          timestamp: new Date().toLocaleTimeString(),
          junction_id: selectedJunction
        });
      }
    } catch (err) {
      // Offline mock fallback
      console.log("Backend offline, simulating YOLOv11 detections locally.");
      simulateOfflineDetections();
    }
  };

  const simulateOfflineDetections = () => {
    const mockDetections = [
      [{ id: 101, vehicle_class: 'car', confidence: 0.94, bbox: [20, 40, 150, 180], lane_id: 'L1' }],
      [{ id: 102, vehicle_class: 'auto', confidence: 0.89, bbox: [180, 60, 290, 200], lane_id: 'L2' }],
      [{ id: 103, vehicle_class: 'car', confidence: 0.91, bbox: [120, 220, 260, 350], lane_id: 'L3' }],
      [{ id: 104, vehicle_class: 'truck', confidence: 0.85, bbox: [50, 50, 200, 250], lane_id: 'L4' }]
    ];

    const currentJunction = junctions.find(j => j.id === selectedJunction);
    if (currentJunction?.has_brts) {
      mockDetections.push({
        id: 104,
        vehicle_class: '2-wheeler',
        confidence: 0.96,
        bbox: [320, 150, 410, 280],
        lane_id: 'L2' // Designated BRTS lane
      });
    }

    }

    const queues = {
      'L1': { vehicles: 1, meters: 7.5 },
      'L2': { vehicles: 1, meters: 7.5 },
      'L3': { vehicles: 1, meters: 7.5 },
      'L4': { vehicles: 1, meters: 7.5 }
    };

    const mockResult = {
      junction_id: selectedJunction,
      batch_size: 4,
      timestamp: new Date().toISOString(),
      detections: mockDetections,
      queue_lengths: queues,
      signal_optimization: { phase: "SOUTH_GREEN", duration: 42 }
    };

    setDetectionResult(mockResult);

    if (mockResult.violations_detected > 0) {
      addAlert({
        id: `V-MOCK-${Date.now()}`,
        severity: 'CRITICAL',
        type: 'BRTS Corridor Intrusion',
        message: `MOCK violation (2-wheeler) flagged in BRTS lane (L2) at ${currentJunction.name}`,
        timestamp: new Date().toLocaleTimeString(),
        junction_id: selectedJunction
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-white tracking-tight">Vision Sensing</h2>
        <p className="text-xs text-slate-500 font-medium">YOLOv11 vehicle sensing overlay, per-lane queue telemetry, and BRTS enforcement</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Configuration Upload Card */}
        <Card title="Traffic Sensing Input" subtitle="Select camera location and upload traffic image feed">
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Camera Location</label>
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

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Upload Feed Frame</label>
              <div className="mt-2 flex justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/40 px-6 py-10 hover:bg-slate-900/60 transition-all cursor-pointer relative">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="text-center">
                  <Upload className="mx-auto h-10 w-10 text-slate-500" />
                  <p className="mt-2 text-xs font-medium text-slate-300">Select 4 Lane Images</p>
                  <p className="mt-1 text-[10px] text-slate-500">Supports JPG, PNG, WEBP (max 10MB)</p>
                </div>
              </div>
            </div>

            {selectedFiles.length > 0 && (
              <div className="rounded-lg bg-slate-900/60 px-4 py-3 border border-slate-800 flex items-center justify-between text-xs">
                <span className="truncate text-slate-300 max-w-[200px]">{selectedFiles.length} files selected (L1-L{selectedFiles.length})</span>
                <Badge variant="info">Ready</Badge>
              </div>
            )}

            <Button
              type="submit"
              disabled={selectedFiles.length === 0}
              loading={loading}
              icon={Camera}
              className="w-full mt-4"
            >
              Analyze 4-Lane Feed
            </Button>
          </form>
        </Card>

        {/* Image Preview & YOLO Overlay */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="4-Camera Video Analytics (YOLOv11)" subtitle="Simulated bounding box outputs on camera streams">
            {imagePreviews.length > 0 ? (
              <div className={`grid gap-4 ${imagePreviews.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {imagePreviews.map((preview, idx) => (
                  <div key={idx} className="relative aspect-video rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                    <img 
                      src={preview} 
                      alt={`Camera Feed L${idx+1}`} 
                      className="h-full w-full object-cover opacity-80"
                    />
                    <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] font-bold text-white z-10">
                      LANE {idx + 1}
                    </div>
                    {/* YOLO Bounding Boxes Overlay for this specific image */}
                    {detectionResult?.detections?.[idx]?.map((d, dIdx) => {
                      const [x1, y1, x2, y2] = d.bbox;
                      const isViolation = selectedJunction === 'J-001' && d.lane_id === 'L2' && d.vehicle_class !== 'bus';
                      const boxColor = isViolation ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-emerald-500 text-emerald-500 bg-emerald-500/10';

                      return (
                        <div
                          key={dIdx}
                          className={`absolute border-2 rounded text-[10px] font-bold p-1 leading-none shadow-sm flex flex-col justify-between ${boxColor}`}
                          style={{
                            left: `${(x1 / 500) * 100}%`, // Simplified coordinate mapping assumption
                            top: `${(y1 / 300) * 100}%`,
                            width: `${((x2 - x1) / 500) * 100}%`,
                            height: `${((y2 - y1) / 300) * 100}%`,
                          }}
                        >
                          <span>{d.vehicle_class} ({(d.confidence * 100).toFixed(0)}%)</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[281px] items-center justify-center rounded-xl border border-slate-850 bg-slate-900/20 text-slate-500 text-sm">
                Select 4 traffic photos to display camera analytics feed.
              </div>
            )}
          </Card>

          {/* Optimized Signal & Telemetry Output */}
          {detectionResult && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card title="Webster Signal Optimizer" subtitle="Dynamic phase selection computed from camera telemetry">
                 <div className="flex flex-col items-center justify-center h-full space-y-4 p-4 border border-emerald-900/50 bg-emerald-950/20 rounded-lg">
                    <span className="text-slate-400 text-xs uppercase font-bold tracking-widest">Active Phase</span>
                    <span className="text-3xl font-extrabold text-emerald-400">
                      {detectionResult.signal_optimization?.phase || 'CALCULATING...'}
                    </span>
                    <Badge variant="success" className="text-sm px-4 py-1.5 mt-2">
                      {detectionResult.signal_optimization?.duration || 0} Seconds Green Time
                    </Badge>
                 </div>
              </Card>

              <Card title="Per-Lane Queue Estimation" subtitle="Dynamic vehicle queues calculated from camera inputs">
                <div className="max-h-56 overflow-y-auto pr-1">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-500 uppercase tracking-wider font-semibold">
                        <th className="py-2">Lane</th>
                        <th className="py-2">Count</th>
                        <th className="py-2">Queue (m)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/50">
                      {Object.entries(detectionResult.queue_lengths).map(([lane, data]) => (
                        <tr key={lane}>
                          <td className="py-3 font-semibold text-slate-200">{lane}</td>
                          <td className="py-3">{data.vehicles} vehicles</td>
                          <td className="py-3 font-bold text-emerald-400">{data.meters}m</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
