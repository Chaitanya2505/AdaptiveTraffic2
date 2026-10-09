import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Camera, Trash2, MapPin, Activity, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function AddNodePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [nodeType, setNodeType] = useState(searchParams.get('type') || 'junction'); // 'junction' or 'brts'
  const [nodeName, setNodeName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [cameras, setCameras] = useState([{ id: 1, name: 'North Bound Lane', url: '' }]);
  const editId = searchParams.get('id');

  useEffect(() => {
    if (editId) {
      fetch(`http://localhost:8000/api/v1/junctions/${editId}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'ok' && data.node) {
            setNodeName(data.node.name || '');
            setNodeType(data.node.type || 'junction');
            setLat(data.node.lat || '');
            setLng(data.node.lng || '');
            if (data.node.cameras && data.node.cameras.length > 0) {
              setCameras(data.node.cameras);
            }
          }
        })
        .catch(err => console.error("Failed to fetch node for edit", err));
    }
  }, [editId]);

  const handleTypeChange = (type) => {
    setNodeType(type);
    if (type === 'brts' && cameras.length > 1) {
      setCameras([cameras[0]]);
    }
  };

  const addCamera = () => {
    setCameras([...cameras, { id: Date.now(), name: `Camera ${cameras.length + 1}`, url: '' }]);
  };

  const removeCamera = (id) => {
    if (cameras.length > 1) {
      setCameras(cameras.filter(c => c.id !== id));
    }
  };

  const updateCamera = (id, field, value) => {
    setCameras(cameras.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    let finalId = editId || nodeName.replace(/\s+/g, '-').substring(0, 10).toUpperCase();
    if (!editId) {
      if (nodeType === 'junction' && !finalId.startsWith('J-')) finalId = 'J-' + finalId;
      if (nodeType === 'brts' && !finalId.startsWith('B-')) finalId = 'B-' + finalId;
    }
    
    try {
      const response = await fetch('http://localhost:8000/api/v1/map/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: finalId,
          name: nodeName,
          type: nodeType,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          cameras: cameras
        })
      });

      if (response.ok) {
        alert(`${nodeType === 'junction' ? 'Junction' : 'BRTS Monitor'} saved successfully to database!`);
        navigate('/monitor');
      } else {
        alert("Failed to save node.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving node.");
    }
  };

  return (
    <div className="h-full w-full rounded-xl overflow-hidden bg-slate-900 flex flex-col text-slate-100 font-sans overflow-hidden">
      <header className="p-4 bg-[#0a2540] border-b border-[#06182a] flex items-center shadow-md z-10 shrink-0">
        <Link to="/monitor" className="p-2 hover:bg-[#11355a] rounded-lg transition-colors text-yellow-400 mr-4">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            Deploy New Monitoring Node
          </h1>
          <p className="text-sm text-blue-200 uppercase tracking-wider text-xs mt-0.5">Setup live camera feeds for traffic analysis</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-slate-800">
        <form onSubmit={handleSave} className="w-full max-w-4xl space-y-6">
          
          <div className="flex items-center gap-4 mb-8">
            <button
              type="button"
              onClick={() => handleTypeChange('junction')}
              className={`flex-1 py-4 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition-all ${nodeType === 'junction' ? 'bg-blue-900/30 border-blue-600 text-blue-700 shadow-sm' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
            >
              <Activity className="h-5 w-5" /> Standard Traffic Junction
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('brts')}
              className={`flex-1 py-4 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition-all ${nodeType === 'brts' ? 'bg-orange-900/30 border-orange-600 text-orange-700 shadow-sm' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
            >
              <Shield className="h-5 w-5" /> BRTS Violations Monitor
            </button>
          </div>

          <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden">
            <div className="p-4 bg-slate-900 border-b border-slate-700 flex items-center gap-2 font-bold text-slate-100">
              <MapPin className="h-5 w-5 text-blue-600" /> General Information
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-200 mb-2">
                  {nodeType === 'junction' ? 'Junction Name / ID' : 'BRTS Corridor Name / ID'}
                </label>
                <input 
                  type="text" 
                  required
                  value={nodeName}
                  onChange={e => setNodeName(e.target.value)}
                  placeholder={nodeType === 'junction' ? "e.g., J-021 Vesu Main Road" : "e.g., B-105 VIP Road BRTS"}
                  className="w-full px-4 py-3 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-lg border border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-200 mb-2">Latitude</label>
                  <input 
                    type="number" 
                    step="any"
                    required
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="e.g., 21.1702"
                    className="w-full px-4 py-3 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-lg border border-slate-600 focus:border-blue-500 outline-none transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-200 mb-2">Longitude</label>
                  <input 
                    type="number" 
                    step="any"
                    required
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    placeholder="e.g., 72.8311"
                    className="w-full px-4 py-3 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-lg border border-slate-600 focus:border-blue-500 outline-none transition-all font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden">
            <div className="p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between font-bold text-slate-100">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-blue-600" /> Live Feed URLs
              </div>
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{cameras.length} Cameras</span>
            </div>
            
            <div className="p-6 space-y-4 bg-slate-900">
              {cameras.map((camera, index) => (
                <div key={camera.id} className="p-4 bg-slate-800 rounded-lg border border-slate-700 shadow-sm flex items-start gap-4">
                  <div className="mt-2 text-slate-400 font-bold w-6 text-center">{index + 1}.</div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Camera Direction / Name</label>
                      <input 
                        type="text" 
                        required
                        value={camera.name}
                        onChange={e => updateCamera(camera.id, 'name', e.target.value)}
                        placeholder="e.g., North Bound"
                        className="w-full px-3 py-2 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-md border border-slate-600 focus:border-blue-500 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider flex justify-between">
                        <span>RTSP / Live Stream URL</span>
                        <span className="text-slate-400 font-normal normal-case text-[10px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Can be added later</span>
                      </label>
                      <input 
                        type="url" 
                        value={camera.url}
                        onChange={e => updateCamera(camera.id, 'url', e.target.value)}
                        placeholder="(Optional) rtsp://admin:pass@192.168.1.100/stream"
                        className="w-full px-3 py-2 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-md border border-slate-600 focus:border-blue-500 outline-none text-sm font-mono text-blue-400"
                      />
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => removeCamera(camera.id)}
                    className="mt-6 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    disabled={cameras.length === 1}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}

              {((nodeType === 'junction' && cameras.length < 4) || (nodeType === 'brts' && cameras.length < 1)) && (
                <button 
                  type="button"
                  onClick={addCamera}
                  className="w-full py-4 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 font-bold hover:border-blue-500 hover:text-blue-600 hover:bg-blue-900/30 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="h-5 w-5" /> Add Another Camera Feed
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4 pb-12">
            <button 
              type="submit"
              className="px-8 py-3 bg-[#0a2540] hover:bg-[#11355a] text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-transform active:scale-95"
            >
              <Save className="h-5 w-5" /> Initialize {nodeType === 'junction' ? 'Analytics' : 'BRTS Guard'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
