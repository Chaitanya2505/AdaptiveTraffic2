import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, ChevronLeft, MapPin, Compass, Navigation2, Layers, AlertCircle, RefreshCw } from 'lucide-react';
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
  const width = isMajor ? 34 : 28;
  const height = isMajor ? 44 : 38;

  return L.divIcon({
    className: 'custom-detail-marker',
    html: `
      <div class="relative flex items-center justify-center cursor-pointer" style="width: ${width}px; height: ${height}px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.6));">
        <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-2 rounded-full animate-ping opacity-75 pointer-events-none" style="background-color: ${color};"></div>
        <svg width="${width}" height="${height}" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 1C7.71573 1 1 7.71573 1 16C1 27.5 16 41 16 41C16 41 31 27.5 31 16C31 7.71573 24.2843 1 16 1Z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
          <circle cx="16" cy="15" r="9" fill="#0f172a" stroke="#ffffff" stroke-width="1.5"/>
          <circle cx="16" cy="15" r="4.5" fill="${color}"/>
        </svg>
      </div>
    `,
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height],
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
    const jLat = junction.lat ?? junction.latitude;
    const jLon = junction.lon ?? junction.longitude;
    return allJunctions
      .filter((j) => j.id !== junction.id)
      .map((j) => {
        const otherLat = j.lat ?? j.latitude;
        const otherLon = j.lon ?? j.longitude;
        return {
          ...j,
          distanceKm: calculateHaversineDistance(jLat, jLon, otherLat, otherLon),
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 4);
  }, [junction, allJunctions]);

  if (loading) {
    return (
      <div className="h-screen w-full bg-slate-950 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin" />
          <p className="text-sm font-medium text-slate-300">Loading Junction Analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !junction) {
    return (
      <div className="h-screen w-full bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md text-center space-y-4 shadow-2xl">
          <div className="h-12 w-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Junction Not Found</h2>
          <p className="text-xs text-slate-400">{error || 'The requested junction could not be retrieved.'}</p>
          <button
            onClick={() => navigate('/junctions')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-all shadow-md"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Junction Map
          </button>
        </div>
      </div>
    );
  }

  const junctionLat = junction.lat ?? junction.latitude;
  const junctionLon = junction.lon ?? junction.longitude;
  const mainColor = TYPE_COLORS[junction.junction_type] || '#3498db';

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/junctions')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Map View</span>
          </button>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2.5">
              {junction.name}
              {junction.is_major && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Major Corridor
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
            center={[junctionLat, junctionLon]}
            zoom={15}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            <Marker
              position={[junctionLat, junctionLon]}
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
