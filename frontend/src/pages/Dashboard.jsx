import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LiveMap from '../components/dashboard/LiveMap';
import { 
  Eye, ShieldAlert, Cpu, BarChart3, ArrowUpRight, 
  Layers, CheckCircle2, Compass, Radio
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useDataStore } from '../store/dataStore';

const SURAT_CORRIDOR_JUNCTIONS = [
  { id: 'J_SVNIT', name: 'SVNIT / Ichchhanath Circle', lat: 21.167790, lon: 72.785022, speedLimit: 50 },
  { id: 'J_GHODDOD', name: 'Ghod Dod Road Commercial Cross', lat: 21.175400, lon: 72.805200, speedLimit: 50 },
  { id: 'J_MAJURA', name: 'Majura Gate BRTS Multi-Leg Hub', lat: 21.182450, lon: 72.823200, speedLimit: 50 },
  { id: 'J_SAHARA', name: 'Sahara Darwaja Railway Flyover', lat: 21.196600, lon: 72.846500, speedLimit: 50 }
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { request } = useApi();
  const setJunctions = useDataStore((state) => state.setJunctions);
  const junctions = useDataStore((state) => state.junctions);

  useEffect(() => {
    const fetchJunctions = async () => {
      try {
        const juncData = await request('get', '/junctions').catch(() => []);
        if (juncData && juncData.length > 0) {
          setJunctions(juncData);
        } else if (!junctions || junctions.length === 0) {
          setJunctions(SURAT_CORRIDOR_JUNCTIONS.map(j => ({
            ...j,
            status: 'normal',
            has_brts: j.id.includes('MAJURA') || j.id.includes('SAHARA')
          })));
        }
      } catch (err) {
        console.warn('Junctions fetch error:', err);
      }
    };
    fetchJunctions();
  }, [request, setJunctions]);

  const coreFeatures = [
    {
      id: 'vision',
      title: 'Vision Sensing & AI Perception',
      subtitle: 'Multi-Lane CCTV Vehicle Detection',
      description: 'Powered by IISc-AIM UVH-26 (YOLOv11-S) fine-tuned on Indian mixed traffic. Classifies 13 vehicle categories with standardized IRC:106-1990 Passenger Car Equivalent (PCE) volume estimation.',
      icon: Eye,
      color: 'text-cyan-400',
      border: 'border-cyan-500/30 hover:border-cyan-500',
      bgGlow: 'from-cyan-950/30 to-slate-950',
      tag: 'UVH-26 Deep Learning',
      route: '/vision',
      actionText: 'Open Vision Sensing'
    },
    {
      id: 'brts',
      title: 'BRTS Dedicated Lane Guard',
      subtitle: 'Transit Corridor Violation Enforcement',
      description: 'Employs Baidu RT-DETR Transformer models with interactive polygonal ROI calibration. Utilizes ray-casting point-in-polygon verification to log unauthorized private vehicle intrusions with automated evidence captures.',
      icon: ShieldAlert,
      color: 'text-indigo-400',
      border: 'border-indigo-500/30 hover:border-indigo-500',
      bgGlow: 'from-indigo-950/30 to-slate-950',
      tag: 'RT-DETR Transformer',
      route: '/brts-guard',
      actionText: 'Open BRTS Lane Guard'
    },
    {
      id: 'sumo',
      title: 'SUMO Micro-Simulation & Control',
      subtitle: 'TraCI-Driven Adaptive Signal Optimization',
      description: 'Real-time 60 FPS hardware-accelerated 2D Digital Twin. Executes Webster Max-Pressure queue balancing, dynamic phase extensions (12s–60s), and coordinated 12.5s Green Wave arterial progression bands.',
      icon: Cpu,
      color: 'text-emerald-400',
      border: 'border-emerald-500/30 hover:border-emerald-500',
      bgGlow: 'from-emerald-950/30 to-slate-950',
      tag: 'SUMO + TraCI Physics',
      route: '/simulation',
      actionText: 'Launch Simulation Twin'
    },
    {
      id: 'analytics',
      title: 'Advanced Transportation Analytics',
      subtitle: 'HCM Standards & Empirical What-If Engine',
      description: 'Evaluates intersection performance with Highway Capacity Manual (HCM 2010/2022) LOS A–F ratings. Compares live adaptive policy against pre-timed baselines (+31.6% throughput, -36.0% delay, -23.1% CO2) with PDF/CSV exports.',
      icon: BarChart3,
      color: 'text-amber-400',
      border: 'border-amber-500/30 hover:border-amber-500',
      bgGlow: 'from-amber-950/30 to-slate-950',
      tag: 'HCM 2022 LOS & PDF Export',
      route: '/analytics',
      actionText: 'View 4-Junction Analytics'
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Title Banner */}
      <div className="flex flex-col gap-2 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <h1 className="text-2xl font-black text-white tracking-tight">
            TrafficPulse Command Center
          </h1>
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
            Surat Smart Mobility Platform
          </span>
        </div>
        <p className="text-xs text-slate-400">
          AI-Powered Adaptive Traffic Management & Arterial Digital Twin across Surat Corridor Intersections
        </p>
      </div>

      {/* 2. Surat Interactive GIS Live Map */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Surat Traffic GIS Live Map
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            Grounded on Surat GPS Coordinates
          </span>
        </div>

        {/* The Live Interactive Map */}
        <div className="rounded-xl overflow-hidden border border-slate-800/80 shadow-inner">
          <LiveMap />
        </div>
      </div>

      {/* 3. Core System Features Grid (4 Main Pillars) */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            System Modules & Core Capabilities
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {coreFeatures.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.id}
                onClick={() => navigate(feat.route)}
                className={`cursor-pointer group rounded-2xl border bg-gradient-to-b ${feat.bgGlow} p-6 shadow-xl transition-all duration-200 hover:-translate-y-1 ${feat.border} flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl bg-slate-900 border border-slate-800 ${feat.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                          {feat.title}
                        </h4>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">
                          {feat.subtitle}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 shrink-0">
                      {feat.tag}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mt-4">
                    {feat.description}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs font-bold">
                  <span className={`${feat.color} flex items-center gap-1 group-hover:underline`}>
                    {feat.actionText} <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                  <span className="text-[11px] text-slate-500">Live Module</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
