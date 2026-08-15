import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, MapPin, Compass, Navigation2, Layers, AlertCircle, RefreshCw } from 'lucide-react';
import { getJunctionBySlug, getAllJunctions } from '../lib/api';
import { TYPE_COLORS } from '../components/SuratJunctionMap';

// Haversine distance formula in kilometers
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

const createDetailMarkerIcon = (type, isMajor) => {
  const color = TYPE_COLORS[type] || '#3498db';
  const size = isMajor ? 34 : 26;

  return L.divIcon({
    className: 'custom-detail-marker',
    html: `
      <div class="relative flex items-center justify-center" style="width: ${size}px; height: ${size}px;">
        <div class="absolute -inset-1 rounded-full animate-ping opacity-75" style="background-color: ${color};"></div>
        <div class="relative flex items-center justify-center rounded-full shadow-lg border-2 border-white dark:border-gray-900" style="background-color: ${color}; width: ${size}px; height: ${size}px;">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

export default function JunctionDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [junction, setJunction] = useState(null);
  const [allJunctions, setAllJunctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      if (!slug) return;
      setLoading(true);
      setError(null);
      try {
        const [targetData, allData] = await Promise.all([
          getJunctionBySlug(slug),
          getAllJunctions().catch(() => []),
        ]);
        setJunction(targetData);
        setAllJunctions(allData);
      } catch (err) {
        console.error('Error fetching junction details:', err);
        setError('Junction not found or failed to load data.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  // Calculate nearby junctions sorted by distance
  const nearbyJunctions = useMemo(() => {
    if (!junction || !allJunctions.length) return [];
    return allJunctions
      .filter((j) => j.id !== junction.id)
      .map((j) => ({
        ...j,
        distanceKm: calculateHaversineDistance(junction.lat, junction.lon, j.lat, j.lon),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 4);
  }, [junction, allJunctions]);

  if (loading) {
    return (
      <div className="h-screen w-full bg-slate-950 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin" />
          <p className="text-sm text-slate-300 font-medium">Loading Junction Details...</p>
        </div>
      </div>
    );
  }

  if (error || !junction) {
    return (
      <div className="h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mb-3" />
        <h2 className="text-lg font-bold text-white mb-1">Junction Not Found</h2>
        <p className="text-xs text-slate-400 max-w-sm mb-4">{error || 'Requested junction does not exist.'}</p>
        <button
          onClick={() => navigate('/map')}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs py-2 px-4 rounded-lg transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Map
        </button>
      </div>
    );
  }

  const mainColor = TYPE_COLORS[junction.junction_type] || '#3498db';

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header Nav */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 z-30 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/map')}
            className="flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Map
          </button>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              {junction.name}
              {junction.is_major && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  MAJOR CROSSING
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400">{junction.area} Area • Surat, Gujarat</p>
          </div>
        </div>
      </header>

      {/* Split View: Left 60% Map, Right 40% Details */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left 60%: Focused Leaflet Map */}
        <div className="w-full md:w-[60%] h-[50vh] md:h-full relative border-r border-slate-800">
          <MapContainer
            center={[junction.lat, junction.lon]}
            zoom={15}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            <Marker
              position={[junction.lat, junction.lon]}
              icon={createDetailMarkerIcon(junction.junction_type, junction.is_major)}
            >
              <Popup autoPan>
                <div className="p-2 font-semibold text-xs text-gray-900 dark:text-gray-100">
                  {junction.name} ({junction.area})
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>

        {/* Right 40%: Info Card & Analytics */}
        <div className="w-full md:w-[40%] h-full bg-slate-900/90 overflow-y-auto p-6 space-y-6">
          {/* Main Specs Card */}
          <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Junction Specifications
              </span>
              <span
                className="px-2.5 py-1 rounded-full text-xs font-semibold text-white capitalize"
                style={{ backgroundColor: mainColor }}
              >
                {junction.junction_type.replace('_', ' ')}
              </span>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white mb-1">{junction.name}</h2>
              <p className="text-xs text-slate-300 leading-relaxed">{junction.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                  Latitude
                </span>
                <span className="text-sm font-mono font-semibold text-emerald-400">
                  {junction.lat.toFixed(4)}° N
                </span>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                  Longitude
                </span>
                <span className="text-sm font-mono font-semibold text-emerald-400">
                  {junction.lon.toFixed(4)}° E
                </span>
              </div>
            </div>

            <a
              href={`https://www.google.com/maps?q=${junction.lat},${junction.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs py-2.5 px-4 rounded-xl transition-all shadow-sm shadow-blue-600/20"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Open in Google Maps</span>
            </a>
          </div>


          {/* Connecting Roads Section */}
          <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-800 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Compass className="h-4 w-4 text-emerald-400" />
              Connecting Roads & Arterials
            </h3>
            <div className="flex flex-wrap gap-2">
              {junction.connecting_roads.map((road) => (
                <span
                  key={road}
                  className="bg-slate-900 text-slate-200 border border-slate-700/80 text-xs px-3 py-1.5 rounded-lg font-medium shadow-sm"
                >
                  {road}
                </span>
              ))}
            </div>
          </div>

          {/* Nearby Junctions (Haversine Formula) */}
          <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-800 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Navigation2 className="h-4 w-4 text-emerald-400" />
              Nearby Crossings (Haversine Distance)
            </h3>
            <div className="space-y-2">
              {nearbyJunctions.map((near) => (
                <div
                  key={near.id}
                  onClick={() => navigate(`/junctions/${near.slug}`)}
                  className="bg-slate-900/80 hover:bg-slate-900 p-3 rounded-xl border border-slate-800/80 hover:border-slate-700 flex items-center justify-between cursor-pointer transition-all"
                >
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">{near.name}</h4>
                    <p className="text-[11px] text-slate-400">{near.area}</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    {near.distanceKm} km
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
