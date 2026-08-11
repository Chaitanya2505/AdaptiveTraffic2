import React from 'react';
import { useDataStore } from '../../store/dataStore';
import Card from '../common/Card';
import Badge from '../common/Badge';
import { TrafficCone } from 'lucide-react';

export default function SignalStatus() {
  const signals = useDataStore((state) => state.signals);
  const junctions = useDataStore((state) => state.junctions);

  return (
    <Card 
      title="Active Signal Phases" 
      subtitle="Current cycle status and optimization mode across junctions"
      action={<TrafficCone className="h-5 w-5 text-emerald-400" />}
    >
      <div className="space-y-4">
        {junctions.map((j) => {
          const signal = signals.find((s) => s.junction_id === j.id) || {
            phase: 'ALL_RED',
            duration: 0,
            mode: 'MANUAL'
          };
          
          const isGreen = signal.phase.endsWith('GREEN');
          const isYellow = signal.phase.endsWith('YELLOW');
          
          let indicatorBg = 'bg-red-500';
          let indicatorText = 'text-red-400';
          if (isGreen) {
            indicatorBg = 'bg-green-500';
            indicatorText = 'text-green-400';
          } else if (isYellow) {
            indicatorBg = 'bg-yellow-500';
            indicatorText = 'text-yellow-400';
          }

          const badgeVariant = signal.mode === 'RL' ? 'critical' : signal.mode === 'WEBSTER' ? 'info' : 'warning';

          return (
            <div 
              key={j.id} 
              className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h4 className="text-sm font-bold text-slate-100">{j.name}</h4>
                <p className="mt-1 text-xs text-slate-500">ID: {j.id}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Mode */}
                <Badge variant={badgeVariant}>
                  {signal.mode === 'RL' ? 'AI Optimized' : signal.mode}
                </Badge>

                {/* Phase Indicator */}
                <div className="flex items-center gap-2 rounded-lg bg-slate-950 px-3.5 py-2 border border-slate-800">
                  <span className={`h-2.5 w-2.5 rounded-full ${indicatorBg} animate-pulse`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${indicatorText}`}>
                    {signal.phase.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-400 border-l border-slate-800 pl-2">
                    {signal.duration}s
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
