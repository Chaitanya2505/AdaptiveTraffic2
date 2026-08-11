import React, { useEffect } from 'react';
import KpiCards from '../components/dashboard/KpiCards';
import LiveMap from '../components/dashboard/LiveMap';
import AlertFeed from '../components/dashboard/AlertFeed';
import SignalStatus from '../components/dashboard/SignalStatus';
import { useApi } from '../hooks/useApi';
import { useDataStore } from '../store/dataStore';

export default function Dashboard() {
  const { request } = useApi();
  const setKpi = useDataStore((state) => state.setKpi);
  const setJunctions = useDataStore((state) => state.setJunctions);
  const setAlerts = useDataStore((state) => state.setAlerts);
  const setSignals = useDataStore((state) => state.setSignals);

  // Poll active backend data on mount if backend is active
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch junctions from backend
        const junctionsData = await request('get', '/junctions');
        setJunctions(junctionsData);

        // Fetch live signals status for J-001, J-002, J-003 to populate state
        const signalPromises = junctionsData.map(j => request('get', `/signals/${j.id}/history?limit=1`).catch(() => []));
        const signalResponses = await Promise.all(signalPromises);
        const activeSignals = signalResponses.map((res, i) => {
          if (res && res.length > 0) return res[0];
          return { junction_id: junctionsData[i].id, phase: 'ALL_RED', duration: 0, mode: 'MANUAL' };
        });
        setSignals(activeSignals);

        // Fetch violations count
        const violationsData = await request('get', '/violations');
        // Fetch active warnings count to compute KPI
        const activeViolations = violationsData.filter(v => v.status === 'active').length;

        // Fetch active warnings to update Alerts feed
        const alertsData = violationsData.map(v => ({
          id: `V-${v.id}`,
          severity: 'CRITICAL',
          type: 'BRTS Corridor Intrusion',
          message: `${v.vehicle_class.toUpperCase()} (${v.license_plate}) detected in BRTS lane at J-001`,
          timestamp: new Date(v.timestamp).toLocaleTimeString(),
          junction_id: v.junction_id
        }));
        if (alertsData.length > 0) {
          setAlerts(alertsData);
        }

        // Dynamically compute/set KPI values based on backend response
        setKpi({
          active_junctions: junctionsData.filter(j => j.status === 'active').length,
          avg_wait_time: 35,
          throughput: 1450,
          violations: activeViolations,
          congestion: 42,
          health: 99
        });
      } catch (err) {
        console.log("Backend offline or connection error. Falling back to dummy mock data.");
      }
    };

    fetchDashboardData();
  }, [request, setJunctions, setKpi, setAlerts, setSignals]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-white tracking-tight">System Dashboard</h2>
        <p className="text-xs text-slate-500">Real-time adaptive traffic and intrusion enforcement status</p>
      </div>

      {/* 6 KPI Cards summary */}
      <KpiCards />

      {/* Live Map & Alert Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="mb-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Surat Traffic Live Map</h3>
            <p className="text-xs text-slate-500 mt-1">Select a junction circle to view active properties</p>
          </div>
          <LiveMap />
        </div>
        <AlertFeed />
      </div>

      {/* Active Signal status */}
      <SignalStatus />
    </div>
  );
}
