import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Activity, Navigation } from 'lucide-react';

export default function JunctionNodesPage() {
  const [nodes, setNodes] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('http://localhost:8000/api/v1/map/nodes')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') {
          setNodes(data.nodes.filter(n => n.type === 'junction'));
        }
      })
      .catch(err => console.error("Failed to fetch nodes:", err));
  }, []);

  return (
    <div className="h-full flex flex-col space-y-6 pb-12">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <Activity className="h-6 w-6 text-emerald-500" /> Junction Nodes
          </h1>
          <p className="text-xs text-slate-400 mt-1">Manage standard traffic junctions</p>
        </div>
        <button 
          onClick={() => navigate('/add-node?type=junction')}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" /> Add Junction
        </button>
      </div>

      {nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900/50 border border-slate-800 rounded-xl">
          <Activity className="h-16 w-16 text-slate-700 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Junction Nodes Found</h3>
          <p className="text-slate-400 mb-6 text-center max-w-md">Your network is currently empty. Add a junction node to begin monitoring traffic.</p>
          <button 
            onClick={() => navigate('/add-node?type=junction')}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold transition-colors shadow-lg"
          >
            <Plus className="h-5 w-5" /> Add a Junction Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nodes.map(node => (
            <div 
              key={node.id} 
              onClick={() => navigate(`/junctions/${node.id}`)}
              className="cursor-pointer bg-slate-950 border border-slate-800 hover:border-emerald-500/50 rounded-xl p-5 shadow-lg transition-all hover:-translate-y-1 group"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-white group-hover:text-emerald-400 transition-colors">{node.name}</h3>
                  <p className="text-xs font-mono text-slate-500">{node.id}</p>
                </div>
                <div className={`w-3 h-3 rounded-full ${node.liveStatus?.congestion === 'high' || node.liveStatus?.congestion === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`}></div>
              </div>
              <div className="space-y-2 text-sm text-slate-300">
                <p>Lat: {node.lat}</p>
                <p>Lng: {node.lng}</p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-800 flex justify-end">
                <span className="text-emerald-500 text-xs font-bold flex items-center gap-1 group-hover:underline">
                  Open Details <Navigation className="h-3 w-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
