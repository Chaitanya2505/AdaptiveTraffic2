import React, { useState } from 'react';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Sparkles, Calendar, CloudRain, ShieldCheck } from 'lucide-react';

const mockForecastData = [
  { time: '19:00', actual: 65, predicted: 68 },
  { time: '19:15', actual: 70, predicted: 72 },
  { time: '19:30', actual: 78, predicted: 75 },
  { time: '19:45', actual: null, predicted: 82 }, // Future starts here
  { time: '20:00', actual: null, predicted: 88 },
  { time: '20:15', actual: null, predicted: 85 },
  { time: '20:30', actual: null, predicted: 70 },
  { time: '20:45', actual: null, predicted: 55 },
  { time: '21:00', actual: null, predicted: 42 }
];

export default function PredictionsPage() {
  const [selectedHorizon, setSelectedHorizon] = useState('30_min');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-white tracking-tight">Congestion Forecasts</h2>
        <p className="text-xs text-slate-500 font-medium">Predictive modeling for peak window bottlenecks and bottleneck mitigation</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Forecast chart */}
        <div className="lg:col-span-2 space-y-6">
          <Card 
            title="Predictive Traffic Load Index" 
            subtitle="Next 2-hour traffic index forecast mapping predictions to actual index history"
            action={
              <select
                value={selectedHorizon}
                onChange={(e) => setSelectedHorizon(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
              >
                <option value="30_min">30 Mins Horizon</option>
                <option value="1_hr">1 Hour Horizon</option>
                <option value="2_hr">2 Hours Horizon</option>
              </select>
            }
          >
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockForecastData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, pt: 10 }} />
                  <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} name="Actual Load" activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="predicted" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" name="Predicted Load" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Model Confidence Card */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Card title="Prediction Engine State" subtitle="LSTM & Spatio-Temporal GNN validation details">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Mean Absolute Percentage Error</span>
                  <span className="text-xs font-bold text-white">4.82% MAPE</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">GNN Prediction Confidence</span>
                  <span className="text-xs font-bold text-emerald-400">92.4%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Last Trained Timestamp</span>
                  <span className="text-xs text-slate-500">Today, 04:00 AM</span>
                </div>
              </div>
            </Card>

            <Card title="Congestion Alert Warnings" subtitle="Predicted alerts flagged before they develop">
              <div className="flex items-start gap-3 rounded-lg border border-yellow-900/30 bg-yellow-950/20 p-4 text-xs text-yellow-400">
                <CloudRain className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Heavy Inflow Forecast (20:00 - 20:30)</span>
                  <p className="mt-1 text-slate-300 leading-normal">
                    Rain predicted at 20:00 is forecasted to decrease Ring Road throughput by 22%. Recommend preemptively activating RL green wave timings.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Contributing Factors */}
        <Card 
          title="Contributing Factors" 
          subtitle="Impact factors driving congestion forecasts"
          action={<Sparkles className="h-5 w-5 text-emerald-400" />}
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-850 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-blue-400" />
                  Surat Peak Hours
                </span>
                <span className="text-xs font-bold text-red-400">+35% Impact</span>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                Standard office/school egress hours causing spike in J-001 and J-002 intersection volumes.
              </p>
            </div>

            <div className="rounded-lg border border-slate-850 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <CloudRain className="h-4 w-4 text-cyan-400" />
                  Precipitation Forecast
                </span>
                <span className="text-xs font-bold text-yellow-400">+22% Impact</span>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                Light rain is predicted to reduce average travel speed from 38km/h to 24km/h across central Surat.
              </p>
            </div>

            <div className="rounded-lg border border-slate-850 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
                  BRTS Lane Enforcement
                </span>
                <span className="text-xs font-bold text-emerald-400">-15% Impact</span>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                Active automated cameras are reducing lane encroachments, maintaining constant transit flow.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
