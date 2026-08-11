import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Eye, 
  TrafficCone, 
  AlertTriangle, 
  LineChart, 
  Sparkles, 
  Cpu, 
  X 
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/vision', label: 'Vision Sensing', icon: Eye },
  { path: '/signals', label: 'Manual Signal Control', icon: TrafficCone },
  { path: '/violations', label: 'BRTS Violations', icon: AlertTriangle },
  { path: '/analytics', label: 'Analytics', icon: LineChart },
  { path: '/predictions', label: 'Predictions', icon: Sparkles },
  { path: '/simulation', label: 'What-If Simulation', icon: Cpu }
];

export default function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside className={`fixed bottom-0 top-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-slate-950 p-4 transition-transform duration-300 lg:static lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between px-2 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 font-extrabold text-white text-xl">
              ER
            </div>
            <div>
              <h2 className="font-bold text-white leading-none">E-RAKSHAK</h2>
              <span className="text-[10px] text-slate-500 tracking-wider font-semibold">COMMAND CENTER</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-900 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-emerald-500/10 text-emerald-400 border-l-4 border-emerald-500 pl-3' 
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-900 p-2 text-center text-xs text-slate-600">
          v1.0.0 &copy; 2026 Surat ATCS
        </div>
      </aside>
    </>
  );
}
