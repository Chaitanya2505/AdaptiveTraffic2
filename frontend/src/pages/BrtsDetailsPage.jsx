import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Video, ShieldAlert, AlertTriangle, PlayCircle, Clock, Camera, Pencil, Save, RotateCcw, X } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

// Sub-component for individual camera stream + ROI drawing
function CameraStream({ cam, onAddUrl }) {
  const [isDrawingRoi, setIsDrawingRoi] = useState(false);
  const [drawPoints, setDrawPoints] = useState([]);
  const [roi, setRoi] = useState(null);
  const mediaContainerRef = useRef(null);

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
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setDrawPoints((prev) => {
      if (prev.length >= 4) return [{ x, y }];
      return [...prev, { x, y }];
    });
  };

  const handleSaveRoi = () => {
    if (drawPoints.length < 3) return;
    setRoi(drawPoints.map(p => [p.x, p.y]));
    setIsDrawingRoi(false);
    setDrawPoints([]);
    alert("ROI Saved to Backend Pipeline (Mock)");
  };

  const handleResetRoi = () => {
    setRoi(null);
    setIsDrawingRoi(false);
    setDrawPoints([]);
  };

  if (!cam.url) {
    return (
      <div className="flex-1 bg-gray-900 flex flex-col items-center justify-center p-6 text-center border-4 border-dashed border-gray-700 m-4 rounded-xl h-[400px]">
        <Video className="h-8 w-8 text-slate-400 mb-4" />
        <h3 className="text-white font-bold text-lg mb-2">No RTSP Stream Configured</h3>
        <p className="text-slate-400 text-sm mb-6">Connect a live IP camera feed to monitor this BRTS lane.</p>
        <button 
          onClick={onAddUrl}
          className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-900/300 text-white px-6 py-2.5 rounded-lg font-bold transition-colors"
        >
          <ShieldAlert className="h-4 w-4" /> Add Camera URL
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[550px] bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-sm">
      <div className="p-3 border-b border-slate-700 flex items-center justify-between bg-slate-900">
        <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
          <Video className="h-4 w-4 text-orange-600" /> {cam.name}
        </div>
        <div className="flex items-center gap-2">
           {!isDrawingRoi ? (
              <button onClick={handleStartDrawingRoi} className="py-1 px-3 rounded-lg text-xs font-bold bg-gray-800 text-white hover:bg-gray-700 transition flex items-center gap-1">
                <Pencil className="h-3 w-3" /> Draw ROI
              </button>
           ) : (
              <>
                <span className="text-[10px] text-orange-600 font-mono font-bold">{drawPoints.length}/4 points</span>
                <button onClick={handleCancelDrawingRoi} className="py-1 px-3 rounded-lg text-xs font-bold bg-gray-200 text-slate-300 hover:bg-gray-300 transition">
                  Cancel
                </button>
                <button onClick={handleSaveRoi} disabled={drawPoints.length < 3} className="py-1 px-3 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition flex items-center gap-1">
                  <Save className="h-3 w-3" /> Save ROI
                </button>
              </>
           )}
           <button onClick={handleResetRoi} className="py-1 px-3 rounded-lg text-xs font-bold bg-gray-200 text-slate-300 hover:bg-gray-300 transition flex items-center gap-1">
             <RotateCcw className="h-3 w-3" /> Reset
           </button>
        </div>
      </div>

      <div 
        ref={mediaContainerRef}
        onClick={handleMediaClick}
        className={`flex-1 bg-black relative flex items-center justify-center overflow-hidden ${isDrawingRoi ? 'cursor-crosshair' : ''}`}
      >
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=1920')] bg-cover bg-center opacity-60 pointer-events-none"></div>
        
        {/* Default static lane if no ROI drawn */}
        {!roi && !isDrawingRoi && (
          <div className="absolute top-1/4 bottom-0 left-1/3 w-1/3 border-l-4 border-r-4 border-dashed border-orange-500/80 bg-orange-900/300/20 pointer-events-none"></div>
        )}

        {/* Dynamic SVG Drawing Overlay */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none z-10">
          {isDrawingRoi ? (
            <>
              {drawPoints.length > 1 && (
                <polygon
                  points={drawPoints.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
                  fill="rgba(245, 158, 11, 0.25)"
                  stroke="#ea580c"
                  strokeWidth="0.6"
                  strokeDasharray="1.5,1.5"
                />
              )}
              {drawPoints.map((p, i) => (
                <circle key={i} cx={p.x * 100} cy={p.y * 100} r="1.2" fill="#ea580c" stroke="#fff" strokeWidth="0.4" />
              ))}
            </>
          ) : (
            roi && roi.length >= 3 && (
              <polygon
                points={roi.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}
                fill="rgba(234, 88, 12, 0.25)"
                stroke="#ea580c"
                strokeWidth="0.6"
                strokeDasharray="2,1.5"
              />
            )
          )}
        </svg>

        <div className="z-10 absolute bottom-4 left-4 right-4 bg-[#0a2540]/90 p-4 rounded-xl border border-blue-900 text-center backdrop-blur-md shadow-lg pointer-events-none">
          <p className="text-orange-400 font-bold tracking-widest text-sm mb-1 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
            OCR VISION ALGORITHM RUNNING
          </p>
          <p className="text-xs text-blue-200 font-mono">RTSP: {cam.url}</p>
        </div>
      </div>
    </div>
  );
}

export default function BRTSPage() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('vision');
  const [violations, setViolations] = useState([]);
  const [node, setNode] = useState(null);
  const [cameraModal, setCameraModal] = useState({ show: false, camIdx: -1, url: '' });

  useEffect(() => {
    // Fetch Node configuration
    fetch(`http://localhost:8000/api/v1/brts/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') setNode(data.node);
      })
      .catch(console.error);

    // Poll violations
    const fetchViolations = () => {
      fetch(`http://localhost:8000/api/v1/brts/${id}/violations`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'ok') setViolations(data.violations || []);
        })
        .catch(console.error);
    };

    fetchViolations();
    const interval = setInterval(fetchViolations, 3000);
    return () => clearInterval(interval);
  }, [id]);

  const handleSaveCameraUrl = () => {
    if (cameraModal.camIdx === -1) return;
    const updatedCameras = [...(node?.cameras || [])];
    updatedCameras[cameraModal.camIdx].url = cameraModal.url;
    
    fetch(`http://localhost:8000/api/v1/brts/${id}/cameras`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cameras: updatedCameras })
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'ok') {
        setNode({ ...node, cameras: updatedCameras });
        setCameraModal({ show: false, camIdx: -1, url: '' });
      }
    })
    .catch(console.error);
  };

  return (
    <div className="h-full w-full rounded-xl overflow-hidden bg-slate-900 flex flex-col text-slate-100 font-sans">
      <header className="p-4 bg-[#0a2540] border-b border-[#06182a] flex items-center justify-between shadow-md z-10 shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/brts-nodes" className="p-2 hover:bg-[#11355a] rounded-lg transition-colors text-orange-400">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="text-orange-400 h-5 w-5" /> 
              BRTS Intrusion Guard: <span className="font-mono text-orange-400">{node?.name || id}</span>
            </h1>
            <p className="text-sm text-blue-200 uppercase tracking-wider text-xs mt-0.5">Automated Violation Enforcement</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-900/300/20 border border-orange-500/50 rounded-full text-orange-200 text-sm font-bold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-orange-900/300 animate-pulse shadow-sm shadow-orange-500/50"></span>
            ACTIVE MONITORING
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-6 flex gap-6 shrink-0 shadow-sm">
        <button 
          onClick={() => setActiveTab('vision')}
          className={`py-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'vision' ? 'border-orange-600 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-100'}`}
        >
          <Camera className="h-4 w-4" /> BRTS Vision Sensing
        </button>
        <button 
          onClick={() => setActiveTab('violations')}
          className={`py-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'violations' ? 'border-orange-600 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-100'}`}
        >
          <AlertTriangle className="h-4 w-4" /> Live Violations List
        </button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        
        {/* VISION SENSING TAB */}
        {activeTab === 'vision' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {node?.cameras?.length > 0 ? (
                node.cameras.map((cam, idx) => (
                  <CameraStream 
                    key={idx} 
                    cam={cam} 
                    onAddUrl={() => setCameraModal({ show: true, camIdx: idx, url: '' })} 
                  />
                ))
              ) : (
                <div className="col-span-full bg-slate-800 border border-slate-700 rounded-xl p-12 text-center shadow-sm">
                  <Video className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-200">No BRTS Cameras Configured</h3>
                  <Link to={`/add-node?type=brts&id=${id}`} className="mt-6 inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-900/300 text-white px-6 py-3 rounded-lg font-bold transition-colors shadow">
                    <ShieldAlert className="h-4 w-4" /> Configure BRTS Node
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIOLATIONS TAB */}
        {activeTab === 'violations' && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl flex flex-col shadow-sm overflow-hidden h-[80vh]">
            <div className="p-4 border-b border-slate-700 bg-slate-900 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" /> Recent Lane Intrusions
              </h2>
              <span className="text-sm font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-full border border-orange-200">
                {violations.length} Pending Verification
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {violations.map((v, i) => (
                <div key={i} className="flex gap-4 p-4 hover:bg-slate-700 border border-transparent hover:border-slate-700 rounded-lg transition-colors cursor-pointer group">
                  <div className="h-20 w-32 bg-gray-200 rounded-lg overflow-hidden relative flex-shrink-0 border border-slate-600">
                    <div className="absolute inset-0 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                      <PlayCircle className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-mono text-xl font-bold text-slate-100 tracking-wider bg-slate-800 px-2 py-0.5 rounded border border-slate-600 inline-block mb-1">
                          {v.plate}
                        </h3>
                        <p className="text-sm font-bold text-red-600">{v.vehicleType} Intrusion</p>
                      </div>
                      <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded flex items-center gap-1 border border-slate-700">
                        <Clock className="h-3 w-3" /> {v.time}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-slate-400">
                      <span>ID: {v.id}</span>
                      <span>OCR Confidence: <span className="text-green-600">{v.confidence}</span></span>
                    </div>
                  </div>
                </div>
              ))}
              
              {violations.length === 0 && (
                <div className="text-center p-12 text-slate-400">
                  <ShieldAlert className="h-16 w-16 mx-auto mb-4 opacity-20 text-orange-500" />
                  <h3 className="text-lg font-bold text-slate-300">No Intrusions Detected</h3>
                  <p className="mt-2 text-sm">The BRTS lane is currently clear of unauthorized vehicles.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
      
      {/* ADD CAMERA URL MODAL */}
      {cameraModal.show && (
        <div className="fixed inset-0 z-50 bg-[#0a2540]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Video className="h-5 w-5 text-orange-600" />
                Configure Stream for {node?.cameras[cameraModal.camIdx]?.name}
              </h3>
              <button onClick={() => setCameraModal({ show: false, camIdx: -1, url: '' })} className="p-1 hover:bg-gray-200 rounded-md transition-colors text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-bold text-slate-200 mb-2">Camera RTSP / HTTP URL</label>
              <input 
                type="text"
                autoFocus
                value={cameraModal.url}
                onChange={(e) => setCameraModal({ ...cameraModal, url: e.target.value })}
                placeholder="rtsp://admin:12345@192.168.1.100:554/stream1"
                className="w-full border border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
              />
              <p className="text-xs text-slate-400 mt-2">Provide a valid live stream URL. The vision algorithms will automatically hook into this feed.</p>
              
              <div className="mt-6 flex items-center justify-end gap-3">
                <button onClick={() => setCameraModal({ show: false, camIdx: -1, url: '' })} className="px-4 py-2 font-bold text-sm text-slate-300 hover:text-white transition-colors">
                  Cancel
                </button>
                <button 
                  onClick={handleSaveCameraUrl}
                  disabled={!cameraModal.url}
                  className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-sm rounded-lg shadow-md transition-colors"
                >
                  Save & Connect
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
