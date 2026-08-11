import React from 'react';
import { useDataStore } from '../../store/dataStore';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

const SEVERITY_CONFIG = {
  CRITICAL: { icon: AlertTriangle, color: 'text-red-400', border: 'border-red-900/30', bg: 'bg-red-950/20' },
  WARNING: { icon: AlertCircle, color: 'text-yellow-400', border: 'border-yellow-900/30', bg: 'bg-yellow-950/20' },
  INFO: { icon: Info, color: 'text-blue-400', border: 'border-blue-900/30', bg: 'bg-blue-950/20' }
};

export default function AlertFeed() {
  const alerts = useDataStore((state) => state.alerts);

  return (
    <div className="flex flex-col h-[400px] rounded-xl border border-slate-800 bg-slate-950 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live Incident Alerts</h3>
        <span className="rounded bg-slate-900 px-2 py-0.5 text-xs text-slate-400">Real-time</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {alerts.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-500 text-sm">
            No active incidents.
          </div>
        ) : (
          alerts.map((alert) => {
            const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.INFO;
            const Icon = config.icon;

            return (
              <div 
                key={alert.id} 
                className={`flex gap-3 rounded-lg border p-3.5 transition-all ${config.border} ${config.bg}`}
              >
                <div className={`mt-0.5 rounded-full bg-slate-900/50 p-1.5 ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wider ${config.color}`}>
                      {alert.type}
                    </span>
                    <span className="text-[10px] text-slate-500">{alert.timestamp}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300 leading-normal">{alert.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
