import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { useDataStore } from '../../store/dataStore';
import Badge from '../common/Badge';

const JUNCTION_STATUS_MAP = {
  normal: { color: '#10b981', radius: 10, variant: 'success' }, // Emerald
  moderate: { color: '#f59e0b', radius: 12, variant: 'warning' }, // Amber
  critical: { color: '#ef4444', radius: 14, variant: 'danger' } // Red
};

export default function LiveMap() {
  const junctions = useDataStore((state) => state.junctions);
  const suratCenter = [21.1702, 72.8311];

  return (
    <div className="h-[400px] w-full rounded-xl border border-slate-800 overflow-hidden shadow-inner relative z-10">
      <MapContainer 
        center={suratCenter} 
        zoom={13} 
        scrollWheelZoom={true} 
        style={{ h: '100%', w: '100%', minHeight: '400px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {junctions.map((j) => {
          const config = JUNCTION_STATUS_MAP[j.status] || JUNCTION_STATUS_MAP.normal;
          
          return (
            <CircleMarker
              key={j.id}
              center={[
                j.latitude !== undefined ? j.latitude : j.lat,
                j.longitude !== undefined ? j.longitude : j.lon
              ]}
              radius={config.radius}
              fillColor={config.color}
              color="#0f172a" // Slate-900 ring
              weight={2}
              opacity={1}
              fillOpacity={0.85}
            >
              <Popup>
                <div className="p-1 min-w-[150px] text-slate-100">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-2 mb-2">
                    <span className="font-bold text-sm text-slate-100">{j.name}</span>
                    <Badge variant={config.variant}>{j.id}</Badge>
                  </div>
                  <div className="space-y-1 text-xs text-slate-300">
                    <p><span className="text-slate-500">Lanes:</span> {j.num_lanes}</p>
                    <p><span className="text-slate-500">BRTS Corridor:</span> {j.has_brts ? 'Yes' : 'No'}</p>
                    <p className="flex items-center gap-1.5 mt-2">
                      <span className="text-slate-500">Status:</span>
                      <span className="font-bold capitalize" style={{ color: config.color }}>{j.status}</span>
                    </p>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
