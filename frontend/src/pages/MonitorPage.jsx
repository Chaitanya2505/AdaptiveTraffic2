import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Navigation, Plus, Activity, AlertTriangle, CloudRain, CalendarHeart, ArrowRight, TrendingUp } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

const generateInitialData = () => {
  const data = [];
  const now = new Date();
  for (let i = 20; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 2000);
    data.push({
      time: t.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      density: Math.floor(Math.random() * 40) + 40, // 40-80%
      speed: Math.floor(Math.random() * 20) + 20, // 20-40 km/h
    });
  }
  return data;
};

// Fix for default leaflet icons in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icons for Map
const createIcon = (color) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const junctionIcon = createIcon('blue');
const junctionHighCongestionIcon = createIcon('red');
const brtsIcon = createIcon('orange');

export default function MonitorPage() {
  const [nodes, setNodes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [trafficDensityData, setTrafficDensityData] = useState(generateInitialData());
  const navigate = useNavigate();



  useEffect(() => {
    fetch('http://localhost:8000/api/v1/map/nodes')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') {
          setNodes(data.nodes);
        }
      })
      .catch(err => console.error("Failed to fetch nodes:", err));

    fetch('http://localhost:8000/api/v1/alerts')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') {
          setAlerts(data.alerts);
        }
      })
      .catch(err => console.error("Failed to fetch alerts:", err));
  }, []);

  const handleAlertClick = (alert) => {
    if (alert.type === 'congestion' && alert.junction_id) {
      navigate(`/junctions/${alert.junction_id}?tab=vision`);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-transparent space-y-4 overflow-y-auto pb-2">
      <header className="p-4 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="font-bold text-2xl tracking-tight leading-none text-slate-100">Traffic Monitor</h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">Live City Map & Alerts</p>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <div className="flex items-center gap-4 text-slate-400 mr-4 hidden md:flex">
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-900 shadow-sm"></span> Normal Junction</span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-sm shadow-red-500/50"></span> Congestion</span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-900 shadow-sm"></span> BRTS Camera</span>
          </div>
          
          <button 
            onClick={() => navigate('/add-node?type=junction')}
            className="flex items-center gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-4 py-2 rounded-lg font-bold transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Junction Node
          </button>
          <button 
            onClick={() => navigate('/add-node?type=brts')}
            className="flex items-center gap-2 bg-orange-100 hover:bg-orange-200 text-orange-800 px-4 py-2 rounded-lg font-bold transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add BRTS Node
          </button>
        </div>
      </header>
      
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* LEFT SECTION (MAP + GRAPH) */}
        <div className="lg:col-span-3 flex flex-col gap-4 h-full min-h-[600px]">
          {/* MAP */}
          <div className="flex-1 rounded-xl overflow-hidden border border-slate-700 shadow-sm relative min-h-[300px]">
            <MapContainer 
              center={[21.1702, 72.8311]} 
              zoom={13} 
              minZoom={11}
              maxBounds={[[20.90, 72.65], [21.40, 73.10]]}
              maxBoundsViscosity={1.0}
              className="h-full w-full"
              zoomControl={true}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              
              {nodes.map(node => {
                let icon = junctionIcon;
                if (node.type === 'brts') icon = brtsIcon;
                else if (node.liveStatus?.congestion === 'high' || node.liveStatus?.congestion === 'critical') {
                  icon = junctionHighCongestionIcon;
                }

                return (
                  <Marker key={node.id} position={[node.lat, node.lng]} icon={icon}>
                    <Popup className="custom-popup">
                      <div className="p-1 min-w-[200px]">
                        <h3 className="font-bold text-lg mb-1 text-slate-100">{node.name}</h3>
                        <p className="text-xs text-slate-400 mb-3 capitalize border-b border-slate-700 pb-2">Type: {node.type.toUpperCase()}</p>
                        
                        {node.type === 'junction' && (
                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-400">Congestion:</span>
                              <span className={`font-bold capitalize ${
                                node.liveStatus?.congestion === 'high' || node.liveStatus?.congestion === 'critical' ? 'text-red-500' : 'text-emerald-500'
                              }`}>{node.liveStatus?.congestion || 'Low'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-400">Wait Time:</span>
                              <span className="font-bold text-slate-200">{node.liveStatus?.avgWaitTime || 0}s</span>
                            </div>
                          </div>
                        )}

                        <button 
                          onClick={() => navigate(node.type === 'brts' ? `/brts-nodes/${node.id}` : `/junctions/${node.id}`)}
                          className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded transition-colors text-sm"
                        >
                          Open Control Center
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
          
          {/* GRAPH SECTION BELOW MAP */}
          <div className="h-64 p-4 bg-slate-800 border border-slate-700 rounded-xl shrink-0 mt-4 mb-8">
            <h3 className="text-sm font-bold text-slate-100 mb-4 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" /> City-Wide Live Traffic Telemetry (Density & Flow)
            </h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficDensityData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDensity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', fontSize: '12px' }}
                    itemStyle={{ fontWeight: 'bold' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} axisLine={false} tickLine={false} />
                  <Area type="monotone" dataKey="density" name="Density %" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorDensity)" activeDot={{ r: 6, fill: '#ef4444' }} />
                  <Area type="monotone" dataKey="speed" name="Avg Speed (km/h)" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSpeed)" activeDot={{ r: 6, fill: '#10b981' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ALERTS CORNER */}
        <div className="lg:col-span-1 bg-slate-800 border border-slate-700 rounded-xl flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-900 border-b border-slate-700 shrink-0">
            <h2 className="font-bold text-lg text-slate-100 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Alerts Corner
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {alerts.length === 0 ? (
              <p className="text-slate-400 text-sm text-center mt-10">No active alerts at this time.</p>
            ) : (
              alerts.map(alert => (
                <div 
                  key={alert.id}
                  onClick={() => handleAlertClick(alert)}
                  className={`p-4 rounded-lg border flex flex-col gap-2 relative overflow-hidden ${
                    alert.type === 'congestion' ? 'bg-red-900/20 border-red-900/50 hover:border-red-500 cursor-pointer transition-colors' : 
                    alert.type === 'weather' ? 'bg-blue-900/20 border-blue-900/50' : 
                    'bg-emerald-900/20 border-emerald-900/50'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-bold">
                    {alert.type === 'congestion' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                    {alert.type === 'weather' && <CloudRain className="h-4 w-4 text-blue-400" />}
                    {alert.type === 'festival' && <CalendarHeart className="h-4 w-4 text-emerald-400" />}
                    <span className={
                      alert.type === 'congestion' ? 'text-red-400' :
                      alert.type === 'weather' ? 'text-blue-300' :
                      'text-emerald-300'
                    }>{alert.title}</span>
                  </div>
                  <p className="text-sm text-slate-300 leading-snug">{alert.message}</p>
                  <div className="flex justify-between items-end mt-2">
                    <span className="text-xs font-medium text-slate-500">{alert.time}</span>
                    {alert.type === 'congestion' && (
                      <span className="text-xs font-bold text-red-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Resolve <ArrowRight className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
