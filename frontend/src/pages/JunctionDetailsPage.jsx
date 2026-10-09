import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Video, Activity, Zap, Settings, RefreshCw, Shield, BrainCircuit, Camera, Droplets, Gauge, X, Navigation } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line, BarChart, Bar, AreaChart, Area } from 'recharts';

export default function JunctionPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'vision');
  const [telemetry, setTelemetry] = useState(null);
  const [node, setNode] = useState(null);
  const [mode, setMode] = useState('DRL');
  const [cameraModal, setCameraModal] = useState({ show: false, camIdx: -1, url: '' });
  const [activePhase, setActivePhase] = useState(null);
  const [globalState, setGlobalState] = useState('NORMAL');

  const pushOverrideToBackend = async (phase, state) => {
    try {
      await fetch(`http://localhost:8000/api/v1/junctions/${id}/override`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_phase: phase, global_state: state })
      });
    } catch (err) {
      console.error("Failed to push override to backend", err);
    }
  };

  const handleSetGreen = (idx) => {
    setActivePhase(idx);
    setGlobalState('NORMAL');
    pushOverrideToBackend(idx, 'NORMAL');
  };

  const handleAllRed = () => {
    setActivePhase(null);
    setGlobalState('ALL_RED');
    pushOverrideToBackend(null, 'ALL_RED');
  };

  const handleAllGreen = () => {
    setActivePhase(null);
    setGlobalState('ALL_GREEN');
    pushOverrideToBackend(null, 'ALL_GREEN');
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    fetch(`http://localhost:8000/api/v1/junctions/${id}/mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: newMode })
    });
  };

  useEffect(() => {
    // Fetch Node configuration
    fetch(`http://localhost:8000/api/v1/junctions/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') setNode(data.node);
      })
      .catch(console.error);

    // Poll telemetry data every second
    const fetchTelemetry = () => {
      fetch(`http://localhost:8000/api/v1/junctions/${id}/telemetry`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'ok') setTelemetry(data.data);
        })
        .catch(console.error);
    };
    
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 1000);
    return () => clearInterval(interval);
  }, [id]);

  const handleSaveCameraUrl = () => {
    if (cameraModal.camIdx === -1) return;
    const updatedCameras = [...(node?.cameras || [])];
    updatedCameras[cameraModal.camIdx].url = cameraModal.url;
    
    fetch(`http://localhost:8000/api/v1/junctions/${id}/cameras`, {
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

  const displayCameras = (id === 'J-001' && (!node?.cameras || node.cameras.length === 0))
    ? [{ name: 'Lane 1' }, { name: 'Lane 2' }, { name: 'Lane 3' }, { name: 'Lane 4' }]
    : node?.cameras;

  return (
    <div className="h-full w-full rounded-xl overflow-hidden bg-slate-900 flex flex-col text-slate-100 font-sans">
      <header className="p-4 bg-[#0a2540] border-b border-[#06182a] flex items-center justify-between shadow-md z-10 shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/junction-nodes" className="p-2 hover:bg-[#11355a] rounded-lg transition-colors text-yellow-400">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield className="text-yellow-400 h-5 w-5" /> 
              Junction Control Center: <span className="font-mono text-yellow-400">{node?.name || id}</span>
            </h1>
            <p className="text-sm text-blue-200 uppercase tracking-wider text-xs mt-0.5">Live Traffic Control & Monitoring</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/50 rounded-full text-red-100 text-sm font-bold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-sm shadow-red-500/50"></span>
            LIVE
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-6 flex gap-6 shrink-0 shadow-sm">
        <button 
          onClick={() => setActiveTab('vision')}
          className={`py-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'vision' ? 'border-blue-400 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-100'}`}
        >
          <Camera className="h-4 w-4" /> Vision Sensing
        </button>
        <button 
          onClick={() => setActiveTab('analytics')}
          className={`py-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'analytics' ? 'border-blue-400 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-100'}`}
        >
          <Activity className="h-4 w-4" /> Live Analytics
        </button>
        <button 
          onClick={() => setActiveTab('manual')}
          className={`py-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'manual' ? 'border-blue-400 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-100'}`}
        >
          <Settings className="h-4 w-4" /> Manual Configuration
        </button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        
        {/* VISION TAB */}
        {activeTab === 'vision' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayCameras?.length > 0 ? (
              displayCameras.map((cam, idx) => (
                <div key={idx} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-sm flex flex-col h-96">
                  <div className="p-3 border-b border-slate-700 flex items-center gap-2 font-bold text-slate-200 text-sm bg-slate-900">
                    <Video className="h-4 w-4 text-blue-400" /> {cam.name || `Camera ${idx + 1}`}
                  </div>
                  {(cam.url || id === 'J-001') ? (
                    <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden group">
                      {id === 'J-001' ? (
                        <video 
                           src={`/videos/j01_lane${idx + 1}.mp4`} 
                           autoPlay 
                           loop 
                           muted 
                           playsInline
                           className="absolute inset-0 w-full h-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&q=80&w=1920')] bg-cover bg-center opacity-60"></div>
                      )}
                      
                      {id !== 'J-001' && (
                        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
                          <div className="border-r border-b border-yellow-500/30 flex items-center justify-center">
                            <div className="border border-yellow-500/80 w-24 h-24 absolute top-10 left-10 shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
                          </div>
                          <div className="border-b border-yellow-500/30"></div>
                          <div className="border-r border-yellow-500/30"></div>
                          <div></div>
                        </div>
                      )}
                      
                      <div className="z-10 bg-[#0a2540]/90 p-4 rounded-xl border border-blue-900 text-center backdrop-blur-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-yellow-400 font-bold tracking-widest text-sm mb-1">
                          {id === 'J-001' ? 'LIVE FEED ACTIVE' : `RTSP: ${cam.url}`}
                        </p>
                        <p className="text-xs text-blue-200 font-mono">VISION SENSING ONLINE</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 bg-gray-900 flex flex-col items-center justify-center p-6 text-center border-4 border-dashed border-gray-700 m-4 rounded-xl">
                      <Video className="h-8 w-8 text-slate-400 mb-4" />
                      <h3 className="text-white font-bold text-lg mb-2">No RTSP Stream Configured</h3>
                      <button 
                        onClick={() => setCameraModal({ show: true, camIdx: idx, url: '' })}
                        className="mt-2 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-900/300 text-white px-6 py-2.5 rounded-lg font-bold transition-colors"
                      >
                        <Zap className="h-4 w-4" /> Add Camera URL
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-full bg-slate-800 border border-slate-700 rounded-xl p-12 text-center shadow-sm">
                <Video className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-200">No Cameras Configured</h3>
                <p className="text-slate-400 mt-2">This junction has no vision sensing configured.</p>
                <Link to="/add-junction" className="mt-6 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-900/300 text-white px-6 py-3 rounded-lg font-bold transition-colors shadow">
                  <Zap className="h-4 w-4" /> Edit Node
                </Link>
              </div>
            )}
            </div>

            {/* Comprehensive 4-Lane Telemetry & Vehicle Classification Breakdown Table */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-sm overflow-hidden mt-6">
               <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-900">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-400"/> Live {displayCameras?.length || 0}-Lane Traffic Telemetry</h3>
                    <p className="text-xs text-slate-400 mt-1">Live vehicle detection, classification, and queue length analysis</p>
                  </div>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-xs text-slate-300">
                   <thead>
                     <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold bg-slate-900/60">
                       <th className="py-3.5 px-4">Approach Lane</th>
                       <th className="py-3.5 px-4">🚗 Cars</th>
                       <th className="py-3.5 px-4">🏍 2-Wheelers</th>
                       <th className="py-3.5 px-4">🛺 Autos</th>
                       <th className="py-3.5 px-4">🚌 Buses</th>
                       <th className="py-3.5 px-4">🚚 Trucks</th>
                       <th className="py-3.5 px-4">🧮 Total Count (PCE)</th>
                       <th className="py-3.5 px-4">📏 Accurate Queue Length</th>
                       <th className="py-3.5 px-4 text-right">🟢 Signal Allocation</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-850/60">
                     {displayCameras?.map((cam, idx) => {
                       const isGreen = activePhase === idx && globalState === 'NORMAL';
                       return (
                         <tr key={idx} className={`transition-colors ${isGreen ? 'bg-emerald-950/20' : 'hover:bg-slate-900/40'} text-slate-500`}>
                           <td className={`py-4 px-4 font-bold ${isGreen ? 'text-emerald-400' : 'text-slate-400'}`}>{cam.name || `Lane ${idx + 1}`}</td>
                           <td colSpan="7" className="py-4 px-4 text-center italic">No feed analyzed. Click 'Analyze CCTV Feeds' to compute telemetry.</td>
                           <td className="py-4 px-4 text-right">
                             {isGreen ? (
                               <span className="px-2 py-1 border border-emerald-500/50 rounded bg-emerald-950/60 text-emerald-400 font-mono text-[10px] shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse">LIVE GREEN</span>
                             ) : globalState === 'ALL_RED' ? (
                               <span className="px-2 py-1 border border-red-500/50 rounded bg-red-950/60 text-red-400 font-mono text-[10px]">ALL RED</span>
                             ) : (
                               <span className="px-2 py-1 border border-slate-600 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">OFFLINE</span>
                             )}
                           </td>
                         </tr>
                       );
                     })}
                     {(!displayCameras || displayCameras.length === 0) && (
                       <tr>
                         <td colSpan="9" className="py-8 text-center text-slate-500">No cameras available</td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-5 gap-6">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1"><Activity className="h-3 w-3" /> Live Throughput</span>
                <span className="text-3xl font-black text-blue-400 font-mono mt-1 block">{telemetry?.throughput || '0'} <span className="text-sm text-slate-400">vph</span></span>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Average Delay</span>
                <span className="text-3xl font-black text-amber-400 font-mono mt-1 block">{telemetry?.delay || '0'} <span className="text-sm text-slate-400">sec</span></span>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Queue Length</span>
                <span className="text-3xl font-black text-red-600 font-mono mt-1 block">{telemetry?.queue || '0'} <span className="text-sm text-slate-400">veh</span></span>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1"><Droplets className="h-3 w-3 text-green-600" /> CO2 Emissions</span>
                <span className="text-3xl font-black text-green-600 font-mono mt-1 block">{telemetry?.co2Emissions || '0'} <span className="text-sm text-slate-400">kg/h</span></span>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1"><Gauge className="h-3 w-3 text-purple-600" /> V/C Ratio</span>
                <span className="text-3xl font-black text-purple-600 font-mono mt-1 block">{telemetry?.vcRatio || '0'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm h-72 flex flex-col">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Delay vs Queue Trend</h3>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={telemetry?.trends || []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" stroke="#6b7280" fontSize={10} />
                      <YAxis stroke="#6b7280" fontSize={10} />
                      <Tooltip />
                      <Line type="monotone" dataKey="delay" stroke="#d97706" strokeWidth={2} name="Avg Delay (s)" />
                      <Line type="monotone" dataKey="queue" stroke="#dc2626" strokeWidth={2} name="Queue (veh)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm h-72 flex flex-col">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Green Time Allocation (Seconds)</h3>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={telemetry?.phaseDistribution || []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="phase" stroke="#6b7280" fontSize={10} />
                      <YAxis stroke="#6b7280" fontSize={10} />
                      <Tooltip cursor={{fill: '#f3f4f6'}} />
                      <Bar dataKey="greenTime" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Green Time (s)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 mb-1">Traffic Optimization Approach</h3>
                <p className="text-xs text-slate-400">Select how the signal phases are controlled at this junction.</p>
              </div>
              <div className="flex items-center gap-3">
                <select 
                  value={mode}
                  onChange={(e) => handleModeChange(e.target.value)}
                  className="bg-slate-800 border border-slate-600 text-slate-100 text-sm font-bold rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 w-64"
                >
                  <option value="FIXED">Fixed Time Control</option>
                  <option value="ACTUATED">Vehicle Actuated</option>
                  <option value="DRL">Deep Reinforcement Learning (DRL)</option>
                </select>
                <div className="px-3 py-2.5 bg-slate-900 border border-slate-700 text-yellow-400 font-bold text-sm rounded-lg flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4" /> Config Applied
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MANUAL CONFIGURATION TAB */}
        {activeTab === 'manual' && (
          <div className="w-full space-y-6">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mb-6 border-b border-slate-700 pb-4">
              <Settings className="h-6 w-6 text-blue-400" /> Manual Override Controls
            </h2>
            
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
               {/* Traffic Light View */}
               <div className="xl:col-span-1 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center">
                  <h3 className="text-sm font-bold text-slate-100 w-full mb-4">Live Traffic Light Monitor</h3>
                  <p className="text-xs text-slate-400 w-full mb-6">Real-time signal head at {node?.name || id}</p>
                  
                  <div className="w-28 h-64 bg-slate-900 border-2 border-slate-700 rounded-full flex flex-col items-center justify-between py-6">
                     <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center font-bold text-white transition-all ${globalState === 'ALL_RED' || (globalState === 'NORMAL' && activePhase === null) ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)] border-red-900' : 'bg-slate-800 border-slate-700 text-transparent'}`}>0s</div>
                     <div className={`w-16 h-16 rounded-full border-4 transition-all ${globalState === 'NORMAL' && activePhase !== null && false ? 'bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.6)] border-yellow-900' : 'bg-slate-800 border-slate-700'}`}></div>
                     <div className={`w-16 h-16 rounded-full border-4 transition-all ${(globalState === 'NORMAL' && activePhase !== null) || globalState === 'ALL_GREEN' ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)] border-green-900' : 'bg-slate-800 border-slate-700'}`}></div>
                  </div>
                  <div className="mt-8 text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Current Signal Light Status</p>
                    <div className={`px-6 py-2 border font-bold rounded-full text-sm inline-block shadow-sm transition-all ${globalState === 'ALL_RED' || (globalState === 'NORMAL' && activePhase === null) ? 'bg-red-950/50 border-red-900 text-red-500' : 'bg-green-950/50 border-green-900 text-green-500'}`}>
                      {globalState === 'ALL_RED' || (globalState === 'NORMAL' && activePhase === null) ? '🔴 RED LIGHT (STOP)' : globalState === 'ALL_GREEN' ? '🟢 ALL GREEN (HOLD)' : `🟢 GREEN (LANE ${activePhase + 1})`}
                    </div>
                  </div>
               </div>

               {/* Manual Switch Grid */}
               <div className="xl:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-100 mb-1">{displayCameras?.length || 0}-Lane Direct Manual Light Switches</h3>
                  <p className="text-xs text-slate-400 mb-6">Synced live telemetry from Vision Sensing: vehicle breakdown, queue tailbacks, and dynamic timers</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {displayCameras?.map((cam, idx) => {
                       const isGreen = (activePhase === idx && globalState === 'NORMAL') || globalState === 'ALL_GREEN';
                       return (
                       <div key={idx} className={`p-4 rounded-xl border flex flex-col justify-between gap-3 shadow-sm transition-all ${isGreen ? 'border-green-500 bg-green-950/20' : 'border-slate-700 bg-slate-900 hover:border-blue-500/50'}`}>
                         <div className="flex items-center justify-between border-b border-slate-700/50 pb-3">
                           <div className="flex items-center gap-3">
                             <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isGreen ? 'bg-green-900/50 text-green-400' : 'bg-blue-900/30 text-blue-400'}`}><Navigation className="h-4 w-4" /></div>
                             <span className="text-sm font-bold text-slate-200">{cam.name || `Lane ${idx + 1} - Approach`}</span>
                           </div>
                           <span className={`px-2 py-1 text-xs font-bold rounded border ${isGreen ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>{isGreen ? '🟢 GREEN' : '🔴 RED'}</span>
                         </div>
                         
                         <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/50 space-y-2">
                           <div className="flex items-center justify-between text-xs text-slate-300">
                             <span>Total Vehicles: <strong className="text-emerald-400">No data</strong></span>
                             <span>Queue: <strong className="text-cyan-400">No data</strong></span>
                             <span>Allocated Time: <strong className="text-amber-400">N/A</strong></span>
                           </div>
                           <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/50 text-[10px] text-slate-400">
                             <span>🚗 Cars: <strong className="text-slate-200">N/A</strong></span>
                             <span>🏍 2W: <strong className="text-slate-200">N/A</strong></span>
                             <span>🛺 Autos: <strong className="text-slate-200">N/A</strong></span>
                             <span>🚌 Buses: <strong className="text-slate-200">N/A</strong></span>
                             <span>🚚 Heavy: <strong className="text-slate-200">N/A</strong></span>
                           </div>
                         </div>
                         
                         <div className="grid grid-cols-3 gap-2 mt-2">
                           <button onClick={() => handleSetGreen(idx)} className={`py-2.5 px-1 rounded-lg font-bold text-[10px] transition-colors flex justify-center items-center gap-1 ${isGreen ? 'bg-green-500 text-white border-green-400 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-emerald-950/30 text-emerald-400 border border-emerald-900 hover:bg-emerald-500/20'}`}>🟢 GREEN</button>
                           <button onClick={() => handleSetGreen(null)} className={`py-2.5 px-1 rounded-lg font-bold text-[10px] transition-colors flex justify-center items-center gap-1 ${!isGreen ? 'bg-red-600 text-white border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-red-950/30 text-red-400 border border-red-900 hover:bg-red-600/20'}`}>🔴 RED</button>
                           <button className="py-2.5 px-1 rounded-lg font-bold text-[10px] bg-blue-950/30 text-blue-400 border border-blue-900 hover:bg-blue-600/20 transition-colors flex justify-center items-center gap-1">▶️ START</button>
                         </div>
                       </div>
                     )})}
                     {(!displayCameras || displayCameras.length === 0) && (
                        <p className="text-sm text-slate-400 text-center py-4 col-span-full">No lanes configured for manual override.</p>
                     )}
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-700">
                    <h3 className="text-sm font-bold text-slate-100 mb-2">Global Master Controls</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={handleAllGreen} className={`w-full py-4 border font-bold rounded-xl transition-all text-sm shadow-sm flex items-center justify-center gap-2 ${globalState === 'ALL_GREEN' ? 'bg-green-600 border-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)]' : 'bg-green-900/20 border-green-900/50 hover:bg-green-900/40 text-green-500'}`}>
                        <Zap className="h-4 w-4" /> ALL GREEN (HOLD)
                      </button>
                      <button onClick={handleAllRed} className={`w-full py-4 border font-bold rounded-xl transition-all text-sm shadow-sm flex items-center justify-center gap-2 ${globalState === 'ALL_RED' ? 'bg-red-600 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-red-900/20 border-red-900/50 hover:bg-red-900/40 text-red-500'}`}>
                        <Zap className="h-4 w-4" /> ALL RED (EMERGENCY OVERRIDE)
                      </button>
                    </div>
                  </div>
               </div>
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
                <Video className="h-5 w-5 text-blue-400" />
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
                className="w-full border border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
              <p className="text-xs text-slate-400 mt-2">Provide a valid live stream URL. The vision algorithms will automatically hook into this feed.</p>
              
              <div className="mt-6 flex items-center justify-end gap-3">
                <button onClick={() => setCameraModal({ show: false, camIdx: -1, url: '' })} className="px-4 py-2 font-bold text-sm text-slate-300 hover:text-white transition-colors">
                  Cancel
                </button>
                <button 
                  onClick={handleSaveCameraUrl}
                  disabled={!cameraModal.url}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-lg shadow-md transition-colors"
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
