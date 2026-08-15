import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup, 
  Polyline, 
  LayersControl, 
  LayerGroup,
  useMap 
} from 'react-leaflet';
import L from 'leaflet';
import { Search, MapPin, Navigation, Filter, ExternalLink, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { getAllJunctions } from '../lib/api';

const { BaseLayer, Overlay } = LayersControl;

// Type color scheme
export const TYPE_COLORS = {
  commercial: '#3498db',
  historic: '#e74c3c',
  industrial: '#2ecc71',
  residential: '#f39c12',
  transit: '#9b59b6',
  entry_point: '#1abc9c',
};

// SVG Icon factory for Leaflet markers
const createCustomIcon = (type, isMajor, isSelected) => {
  const color = TYPE_COLORS[type] || '#3498db';
  const size = isMajor ? 30 : 22;
  const pulseHtml = isMajor 
    ? `<div class="absolute -inset-1 rounded-full animate-ping opacity-65 pointer-events-none" style="background-color: ${color};"></div>` 
    : '';

  return L.divIcon({
    className: 'custom-surat-marker',
    html: `
      <div class="relative flex items-center justify-center transition-all duration-200 hover:scale-125 cursor-pointer ${isSelected ? 'scale-125 z-50' : ''}" style="width: ${size}px; height: ${size}px;">
        ${pulseHtml}
        <div class="relative flex items-center justify-center rounded-full shadow-md border-2 border-white dark:border-gray-900 transition-transform duration-200" style="background-color: ${color}; width: ${size}px; height: ${size}px;">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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

// Component to handle map flyTo programmatically
function MapController({ selectedJunction }) {
  const map = useMap();
  useEffect(() => {
    if (selectedJunction) {
      map.flyTo([selectedJunction.lat, selectedJunction.lon], 15, {
        duration: 1.2,
      });
    }
  }, [selectedJunction, map]);
  return null;
}

export default function SuratJunctionMap() {
  const navigate = useNavigate();
  const [junctions, setJunctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [selectedJunction, setSelectedJunction] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const markerRefs = useRef({});

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch junctions data
  const loadJunctions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllJunctions();
      setJunctions(data);
    } catch (err) {
      console.error('Failed to fetch junctions:', err);
      setError('Could not connect to backend API. Please make sure FastAPI is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJunctions();
  }, [loadJunctions]);

  // Filtered junctions memoization
  const filteredJunctions = useMemo(() => {
    return junctions.filter((j) => {
      const matchesType = activeFilter === 'ALL' || j.junction_type === activeFilter;
      const term = debouncedSearch.toLowerCase().trim();
      const matchesSearch = 
        !term || 
        j.name.toLowerCase().includes(term) ||
        j.area.toLowerCase().includes(term) ||
        j.connecting_roads.some((road) => road.toLowerCase().includes(term));
      return matchesType && matchesSearch;
    });
  }, [junctions, activeFilter, debouncedSearch]);

  const majorJunctions = useMemo(() => {
    return filteredJunctions.filter((j) => j.is_major);
  }, [filteredJunctions]);

  // Event handlers
  const handleSelectJunction = useCallback((j) => {
    setSelectedJunction(j);
    const marker = markerRefs.current[j.id];
    if (marker) {
      marker.openPopup();
    }
  }, []);

  // Road PolyLines Data
  const roadPolylines = useMemo(() => [
    {
      name: 'Ghod Dod Road',
      positions: [[21.1750, 72.8100], [21.1750, 72.8500]],
      pathOptions: { color: '#555555', weight: 4, opacity: 0.8 },
    },
    {
      name: 'Ring Road',
      positions: [
        [21.1950, 72.8320], [21.1980, 72.8350], [21.1750, 72.8400], 
        [21.1700, 72.8300], [21.1650, 72.8350], [21.1750, 72.8200], 
        [21.1900, 72.8250], [21.1950, 72.8320]
      ],
      pathOptions: { color: '#888888', weight: 3, dashArray: '6, 6', opacity: 0.8 },
    },
    {
      name: 'Varachha Road',
      positions: [[21.2300, 72.8600], [21.2150, 72.8500], [21.2050, 72.8550], [21.1980, 72.8350]],
      pathOptions: { color: '#777777', weight: 3, opacity: 0.8 },
    },
    {
      name: 'Udhna Road',
      positions: [[21.1950, 72.8320], [21.1650, 72.8350], [21.1500, 72.8800]],
      pathOptions: { color: '#777777', weight: 3, opacity: 0.8 },
    },
    {
      name: 'Adajan Road',
      positions: [[21.1850, 72.8100], [21.1900, 72.8250]],
      pathOptions: { color: '#777777', weight: 3, opacity: 0.8 },
    },
    {
      name: 'Dumas Road',
      positions: [[21.1800, 72.8200], [21.1700, 72.8150], [21.1500, 72.7900]],
      pathOptions: { color: '#777777', weight: 3, opacity: 0.8 },
    },
    {
      name: 'Canal Road',
      positions: [[21.1500, 72.8200], [21.1600, 72.8050], [21.1700, 72.8350], [21.2050, 72.8550]],
      pathOptions: { color: '#aaaaaa', weight: 2, opacity: 0.8 },
    },
    {
      name: 'NH-48 Highway',
      positions: [[21.2400, 72.8700], [21.2300, 72.8600], [21.1500, 72.8800], [21.1000, 72.9000]],
      pathOptions: { color: '#333333', weight: 5, opacity: 0.9 },
    },
  ], []);

  // Tapi River PolyLine
  const riverPolyline = useMemo(() => ({
    positions: [
      [21.2400, 72.8300], [21.2200, 72.8250], 
      [21.2000, 72.8150], [21.1850, 72.8000], 
      [21.1600, 72.7700]
    ],
    pathOptions: { color: '#4a90d9', weight: 6, opacity: 0.4 },
  }), []);

  const filterChips = [
    { id: 'ALL', label: 'All' },
    { id: 'commercial', label: 'Commercial' },
    { id: 'historic', label: 'Historic' },
    { id: 'industrial', label: 'Industrial' },
    { id: 'residential', label: 'Residential' },
    { id: 'transit', label: 'Transit' },
    { id: 'entry_point', label: 'Entry Points' },
  ];

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header Bar */}
      <header className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 px-6 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Surat — Main Junctions
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                20 Junctions Mapped
              </span>
            </h1>
            <p className="text-xs text-slate-400">Interactive GIS traffic command map</p>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-1 max-w-xl items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search junctions, areas or roads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg bg-slate-800/80 border border-slate-700 pl-9 pr-4 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-all md:hidden"
          >
            <Filter className="h-4 w-4" />
            Sidebar
          </button>
        </div>
      </header>

      {/* Filter Chips Bar */}
      <div className="flex items-center gap-2 px-6 py-2 bg-slate-900/60 border-b border-slate-800/80 overflow-x-auto z-20 shrink-0 scrollbar-none">
        <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1">
          <Filter className="h-3.5 w-3.5" /> Category:
        </span>
        {filterChips.map((chip) => (
          <button
            key={chip.id}
            onClick={() => setActiveFilter(chip.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeFilter === chip.id
                ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 font-semibold'
                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-700/50'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Main Container: Map + Sidebar */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* Leaflet Map Area */}
        <div className="flex-1 h-full w-full relative z-10">
          {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin" />
                <p className="text-sm font-medium text-slate-300">Loading Surat Junction GIS Data...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-red-950/90 border border-red-800 text-red-200 px-4 py-3 rounded-xl shadow-xl max-w-md">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
              <div className="flex-1 text-xs">
                <p className="font-semibold">{error}</p>
                <button
                  onClick={loadJunctions}
                  className="mt-1.5 text-xs text-red-400 hover:underline font-medium"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          )}

          <MapContainer
            center={[21.1800, 72.8300]}
            zoom={13}
            className="h-full w-full"
            zoomControl={false}
          >
            <MapController selectedJunction={selectedJunction} />

            <LayersControl position="topleft">
              <BaseLayer checked name="CartoDB Positron">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a> | Surat Junction Map'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
              </BaseLayer>

              {/* Roads Overlay */}
              <Overlay checked name="Roads">
                <LayerGroup>
                  {roadPolylines.map((road) => (
                    <Polyline
                      key={road.name}
                      positions={road.positions}
                      pathOptions={road.pathOptions}
                    />
                  ))}
                </LayerGroup>
              </Overlay>

              {/* Tapi River Overlay */}
              <Overlay checked name="Tapi River">
                <Polyline
                  positions={riverPolyline.positions}
                  pathOptions={riverPolyline.pathOptions}
                />
              </Overlay>

              {/* Major Junctions Only Overlay */}
              <Overlay name="Major Junctions Only">
                <LayerGroup>
                  {majorJunctions.map((j) => (
                    <Marker
                      key={`major-${j.id}`}
                      position={[j.lat, j.lon]}
                      icon={createCustomIcon(j.junction_type, true, selectedJunction?.id === j.id)}
                    />
                  ))}
                </LayerGroup>
              </Overlay>

              {/* All Junctions Overlay */}
              <Overlay checked name="All Junctions">
                <LayerGroup>
                  {filteredJunctions.map((j) => (
                    <Marker
                      key={`all-${j.id}`}
                      position={[j.lat, j.lon]}
                      ref={(ref) => {
                        markerRefs.current[j.id] = ref;
                      }}
                      icon={createCustomIcon(j.junction_type, j.is_major, selectedJunction?.id === j.id)}
                      eventHandlers={{
                        click: () => setSelectedJunction(j),
                      }}
                    >
                      <Popup className="surat-junction-popup" autoPan>
                        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 p-4 max-w-xs text-gray-900 dark:text-gray-100">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="font-bold text-base tracking-tight text-gray-900 dark:text-white">
                              {j.name}
                            </span>
                            {j.is_major && (
                              <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                                Major
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {j.area}
                            </span>
                            <span 
                              className="px-2 py-0.5 rounded-full text-xs font-medium text-white capitalize"
                              style={{ backgroundColor: TYPE_COLORS[j.junction_type] || '#3498db' }}
                            >
                              {j.junction_type.replace('_', ' ')}
                            </span>
                          </div>

                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2 leading-relaxed">
                            {j.description}
                          </p>

                          <div className="mb-3">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                              Connecting Roads
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {j.connecting_roads.map((road) => (
                                <span 
                                  key={road} 
                                  className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded text-[11px]"
                                >
                                  {road}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => navigate(`/junctions/${j.slug}`)}
                              className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs py-2 px-2.5 rounded-lg transition-all shadow-sm"
                            >
                              <span>View Details</span>
                              <ExternalLink className="h-3 w-3" />
                            </button>
                            <a
                              href={`https://www.google.com/maps?q=${j.lat},${j.lon}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs py-2 px-2.5 rounded-lg transition-all shadow-sm"
                              title="Open in Google Maps"
                            >
                              <span>Maps</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </Popup>

                    </Marker>
                  ))}
                </LayerGroup>
              </Overlay>
            </LayersControl>
          </MapContainer>
        </div>

        {/* Searchable Sidebar Panel */}
        <aside className={`absolute md:relative right-0 bottom-0 top-0 z-20 w-full md:w-80 bg-slate-900 border-l border-slate-800 flex flex-col transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}>
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Navigation className="h-4 w-4 text-emerald-400" />
              Junction Directory ({filteredJunctions.length})
            </h2>
            <span className="text-[11px] text-slate-400">Click to focus</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredJunctions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No junctions match search query.
              </div>
            ) : (
              filteredJunctions.map((j) => {
                const isActive = selectedJunction?.id === j.id;
                const dotColor = TYPE_COLORS[j.junction_type] || '#3498db';

                return (
                  <div
                    key={j.id}
                    onClick={() => handleSelectJunction(j)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 flex items-start justify-between gap-3 ${
                      isActive 
                        ? 'bg-emerald-500/10 border-emerald-500/60 shadow-md shadow-emerald-500/5' 
                        : 'bg-slate-800/50 hover:bg-slate-800 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <span 
                        className="h-3 w-3 rounded-full mt-1 shrink-0" 
                        style={{ backgroundColor: dotColor }} 
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className={`text-xs font-semibold truncate ${isActive ? 'text-emerald-300' : 'text-slate-100'}`}>
                            {j.name}
                          </h3>
                          {j.is_major && (
                            <span className="text-[9px] font-bold px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              MAJOR
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{j.area}</p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {j.connecting_roads.slice(0, 2).map((road) => (
                            <span key={road} className="text-[9px] bg-slate-950 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800">
                              {road}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isActive ? 'text-emerald-400 translate-x-1' : 'text-slate-600'}`} />
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
