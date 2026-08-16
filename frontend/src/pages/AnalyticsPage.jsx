import React, { useState, useEffect } from 'react';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BarChart3, TrendingUp, HelpCircle, HardHat, Map as MapIcon } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import { dummyJunctions } from '../dummyData/junctions';

const mockTrendData = [
  { time: '08:00', volume: 850, queue: 15 },
  { time: '09:00', volume: 1450, queue: 45 },
  { time: '10:00', volume: 1200, queue: 30 },
  { time: '11:00', volume: 950, queue: 18 },
  { time: '12:00', volume: 880, queue: 14 },
  { time: '13:00', volume: 900, queue: 16 },
  { time: '14:00', volume: 1100, queue: 25 },
  { time: '15:00', volume: 1350, queue: 38 },
  { time: '16:00', volume: 1500, queue: 52 },
  { time: '17:00', volume: 1650, queue: 60 },
  { time: '18:00', volume: 1800, queue: 75 },
  { time: '19:00', volume: 1400, queue: 40 },
  { time: '20:00', volume: 900, queue: 20 }
];

const mockBottlenecks = [
  { rank: 1, location: 'Ring Road × BRTS Corridor', delay: '65s avg', level: 'Critical', recommendation: 'Install physical divider walls' },
  { rank: 2, location: 'Ghod Dod Road Intersection', delay: '42s avg', level: 'High', recommendation: 'Designate L3 as bus-only during peak' },
  { rank: 3, location: 'City Light Junction', delay: '28s avg', level: 'Moderate', recommendation: 'Extend green wave sequence offset' }
];

export default function AnalyticsPage() {
  const [heatmapData, setHeatmapData] = useState(() => 
    dummyJunctions.map((j) => ({
      id: j.id,
      name: j.name,
      lat: j.lat ?? j.latitude,
      lng: j.lon ?? j.longitude,
      intensity: j.status === 'critical' ? 0.9 : j.status === 'moderate' ? 0.6 : 0.35
    }))
  );

  useEffect(() => {
    fetch('http://localhost:8000/analytics/heatmap')
      .then(res => res.json())
      .then(data => {
        if (data && data.data && data.data.length > 0) {
          setHeatmapData(data.data);
        }
      })
      .catch(err => console.log("Using local junction heatmap telemetry data"));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-white tracking-tight">Congestion Analytics</h2>
        <p className="text-xs text-slate-500 font-medium">Historical traffic patterns, volume trends, and bottleneck hotspots analysis</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Heatmap Card */}
        <div className="lg:col-span-3 space-y-6">
          <Card 
            title="Congestion Heatmap" 
            subtitle="Live hotspot intensity map computed from traffic junctions"
            action={<MapIcon className="h-5 w-5 text-emerald-400" />}
          >
            <div className="h-96 w-full rounded-lg overflow-hidden border border-slate-800 relative">
              <MapContainer center={[21.1800, 72.8250]} zoom={12} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
                />
                {heatmapData.map((pt, idx) => (
                  <CircleMarker 
                    key={idx}
                    center={[pt.lat, pt.lng]} 
                    radius={14 * (0.5 + (pt.intensity || 0.5))}
                    fillColor={pt.intensity > 0.7 ? '#ef4444' : pt.intensity > 0.4 ? '#f59e0b' : '#10b981'}
                    fillOpacity={(pt.intensity || 0.5) * 0.7 + 0.3}
                    stroke={false}
                  >
                    <Popup className="custom-dark-popup">
                      <div className="p-2 text-xs font-semibold text-white space-y-1">
                        <p className="font-bold text-emerald-400">{pt.name || pt.id}</p>
                        <p className="text-slate-300">Hotspot Intensity: {((pt.intensity || 0.5) * 100).toFixed(0)}%</p>
                        <p className="text-[10px] text-slate-400">{Number(pt.lat).toFixed(4)}, {Number(pt.lng).toFixed(4)}</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </Card>
        </div>

        {/* Trend Chart */}
        <div className="lg:col-span-2 space-y-6">
          <Card 
            title="Hourly Volume & Delay Trends" 
            subtitle="Historical volume variations tracked across peak traffic windows"
            action={<TrendingUp className="h-5 w-5 text-emerald-400" />}
          >
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="volume" stroke="#10b981" fillOpacity={1} fill="url(#colorVolume)" name="Vehicle Count/hr" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Bottleneck Locations Table */}
          <Card 
            title="Surat City Bottleneck Hotspots" 
            subtitle="Identified locations with highest cumulative delays"
            action={<BarChart3 className="h-5 w-5 text-emerald-400" />}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="pb-3 py-2">Rank</th>
                    <th className="pb-3 py-2">Location</th>
                    <th className="pb-3 py-2">Avg Delay</th>
                    <th className="pb-3 py-2">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/50">
                  {mockBottlenecks.map((b) => (
                    <tr key={b.rank}>
                      <td className="py-4 font-mono font-bold text-slate-500">#{b.rank}</td>
                      <td className="py-4 font-semibold text-slate-200">{b.location}</td>
                      <td className="py-4 text-emerald-400 font-bold">{b.delay}</td>
                      <td className="py-4">
                        <Badge variant={b.level === 'Critical' ? 'danger' : b.level === 'High' ? 'warning' : 'info'}>
                          {b.level}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Engineering Recommendations */}
        <Card 
          title="Engineering Recommendations" 
          subtitle="Data-driven infrastructure suggestions computed by the E-Rakshak engine"
          action={<HardHat className="h-5 w-5 text-emerald-400" />}
        >
          <div className="space-y-4">
            {mockBottlenecks.map((b) => (
              <div 
                key={b.rank} 
                className="rounded-lg border border-slate-850 bg-slate-900/40 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-200">Recommendation #{b.rank}</span>
                  <Badge variant={b.level === 'Critical' ? 'danger' : b.level === 'High' ? 'warning' : 'info'}>
                    {b.level}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 leading-normal">
                  <span className="text-slate-500 font-medium">Location:</span> {b.location}
                </p>
                <div className="rounded border border-emerald-500/10 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
                  <span className="font-bold">Proposed Action:</span> {b.recommendation}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
