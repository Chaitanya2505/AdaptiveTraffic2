import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useDataStore } from '../../store/dataStore';
import Badge from '../common/Badge';
import { MapPin, ExternalLink, Navigation, Compass } from 'lucide-react';

const STATUS_THEMES = {
  normal: { color: '#10b981', bg: 'bg-emerald-500', text: 'text-emerald-400', label: 'Optimal' },
  moderate: { color: '#f59e0b', bg: 'bg-amber-500', text: 'text-amber-400', label: 'Moderate' },
  critical: { color: '#ef4444', bg: 'bg-rose-500', text: 'text-rose-400', label: 'Congested' }
};

const createMarkerIcon = (status = 'normal', isBrts = false) => {
  const theme = STATUS_THEMES[status] || STATUS_THEMES.normal;
  const pinColor = isBrts ? '#6366f1' : theme.color;
  const width = 30;
  const height = 40;

  return L.divIcon({
    className: 'custom-traffic-pin',
    html: `
      <div class="relative flex items-center justify-center cursor-pointer group" style="width: ${width}px; height: ${height}px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.6));">
        <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-1.5 rounded-full animate-ping opacity-60 pointer-events-none" style="background-color: ${pinColor};"></div>
        <svg width="${width}" height="${height}" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg" class="transition-transform duration-200 group-hover:scale-110">
          <path d="M16 1C7.71573 1 1 7.71573 1 16C1 27.5 16 41 16 41C16 41 31 27.5 31 16C31 7.71573 24.2843 1 16 1Z" fill="${pinColor}" stroke="#ffffff" stroke-width="2"/>
          <circle cx="16" cy="15" r="9" fill="#0f172a" stroke="#ffffff" stroke-width="1.5"/>
          <circle cx="16" cy="15" r="4.5" fill="${pinColor}"/>
        </svg>
      </div>
    `,
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height],
  });
};



export default function LiveMap() {
  const junctions = useDataStore((state) => state.junctions);
  const suratCenter = [21.1800, 72.8250]; // Centered across all Surat corridors

  const validJunctions = (junctions || []).filter((j) => {
    const lat = j.latitude !== undefined ? j.latitude : j.lat;
    const lon = j.longitude !== undefined ? j.longitude : j.lon;
    return typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon);
  });

  return (
    <div className="h-[430px] w-full rounded-xl border border-slate-800 overflow-hidden shadow-2xl relative z-10">
      {/* Floating Legend / Stats Badge */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 shadow-lg pointer-events-none">
        <span className="font-semibold text-emerald-400">{validJunctions.length} Junctions</span>
        <span className="text-slate-600">•</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Optimal</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span>Moderate</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span>Congested</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span>BRTS</span>
      </div>

      <MapContainer 
        center={suratCenter} 
        zoom={12} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%', minHeight: '430px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {validJunctions.map((j) => {
          const lat = j.latitude !== undefined ? j.latitude : j.lat;
          const lon = j.longitude !== undefined ? j.longitude : j.lon;
          const theme = STATUS_THEMES[j.status] || STATUS_THEMES.normal;
          const gmapsUrl = j.google_maps_url || `https://www.google.com/maps?q=${lat},${lon}`;
          const isBrts = Boolean(j.has_brts);

          return (
            <Marker
              key={j.id}
              position={[lat, lon]}
              icon={createMarkerIcon(j.status, isBrts)}
            >
              <Popup className="custom-dark-popup">
                <div className="p-3 min-w-[230px] bg-slate-950 text-slate-100 rounded-xl border border-slate-800 shadow-2xl space-y-3">
                  
                  {/* Header & ID Badge */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
                    <div>
                      <h4 className="font-extrabold text-sm text-white tracking-tight">{j.name}</h4>
                      {j.area && <p className="text-[11px] text-slate-400">{j.area}</p>}
                    </div>
                    <span className="rounded bg-indigo-600/30 border border-indigo-500/40 px-2 py-0.5 font-mono text-[10px] font-bold text-indigo-300 shrink-0">
                      {j.id}
                    </span>
                  </div>

                  {/* Coordinates & Geometry */}
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex items-center justify-between text-[11px] bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
                      <span className="text-slate-500">GPS Coordinates:</span>
                      <span className="font-mono text-emerald-400 font-bold">{Number(lat).toFixed(6)}, {Number(lon).toFixed(6)}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Approach Lanes:</span>
                      <span className="font-bold text-slate-200">{j.num_lanes || 4} Lanes</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">BRTS Dedicated:</span>
                      <span className={`font-bold ${isBrts ? 'text-indigo-400' : 'text-slate-500'}`}>
                        {isBrts ? 'Yes (Sitilink Protected)' : 'Standard Mixed'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Traffic Status:</span>
                      <span className={`font-bold capitalize ${theme.text}`}>{j.status || 'Active'}</span>
                    </div>
                  </div>

                  {/* Google Maps Redirect Button */}
                  <div className="pt-1">
                    <a
                      href={gmapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 px-3 transition shadow-md shadow-emerald-600/30 text-center"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      <span>Open in Google Maps</span>
                      <ExternalLink className="h-3 w-3 ml-0.5 opacity-80" />
                    </a>
                  </div>

                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
