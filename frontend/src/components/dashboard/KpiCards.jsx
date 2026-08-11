import React from 'react';
import { useDataStore } from '../../store/dataStore';
import { Activity, Clock, TrendingUp, AlertTriangle, Gauge, Server } from 'lucide-react';

const KPI_CONFIG = [
  { key: 'active_junctions', label: 'Active Junctions', icon: Activity, color: 'text-blue-400', border: 'border-l-blue-500', format: (v) => `${v}/3` },
  { key: 'avg_wait_time', label: 'Avg Wait Time', icon: Clock, color: 'text-yellow-400', border: 'border-l-yellow-500', format: (v) => `${v}s`, trend: '-18%' },
  { key: 'throughput', label: 'Flow Throughput', icon: TrendingUp, color: 'text-emerald-400', border: 'border-l-emerald-500', format: (v) => `${v.toLocaleString()} veh/hr`, trend: '+12%' },
  { key: 'violations', label: 'BRTS Violations', icon: AlertTriangle, color: 'text-red-400', border: 'border-l-red-500', format: (v) => v, trend: '-65%' },
  { key: 'congestion', label: 'Congestion Index', icon: Gauge, color: 'text-purple-400', border: 'border-l-purple-500', format: (v) => `${v}%` },
  { key: 'health', label: 'System Health', icon: Server, color: 'text-cyan-400', border: 'border-l-cyan-500', format: (v) => `${v}%` }
];

export default function KpiCards() {
  const kpi = useDataStore((state) => state.kpi);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
      {KPI_CONFIG.map((config) => {
        const Icon = config.icon;
        const value = kpi[config.key] !== undefined ? kpi[config.key] : 0;
        
        return (
          <div 
            key={config.key} 
            className={`flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-5 shadow-sm border-l-4 ${config.border}`}
          >
            <div>
              <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">{config.label}</p>
              <p className="mt-2 text-2xl font-bold text-white leading-none">
                {config.format(value)}
              </p>
              {config.trend && (
                <p className="mt-2 text-xs flex items-center gap-1">
                  <span className={config.trend.startsWith('+') ? 'text-green-400' : 'text-red-400'}>
                    {config.trend}
                  </span>
                  <span className="text-slate-500">vs last hour</span>
                </p>
              )}
            </div>
            <div className={`rounded-lg bg-slate-900 p-3 ${config.color}`}>
              <Icon className="h-6 w-6" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
