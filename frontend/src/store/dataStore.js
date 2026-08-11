import { create } from 'zustand';
import { dummyJunctions } from '../dummyData/junctions';
import { dummyAlerts } from '../dummyData/alerts';
import { dummyKpiData } from '../dummyData/kpiData';

export const useDataStore = create((set, get) => ({
  junctions: dummyJunctions,
  alerts: dummyAlerts,
  kpi: dummyKpiData,
  violations: [
    { id: 1, junction_id: 'J-001', vehicle_class: 'car', license_plate: 'GJ-05-AB-1234', status: 'active', timestamp: new Date(Date.now() - 300000).toISOString() },
    { id: 2, junction_id: 'J-003', vehicle_class: 'auto', license_plate: 'GJ-05-CD-5678', status: 'active', timestamp: new Date(Date.now() - 600000).toISOString() },
    { id: 3, junction_id: 'J-001', vehicle_class: '2-wheeler', license_plate: 'GJ-05-XY-9999', status: 'acknowledged', timestamp: new Date(Date.now() - 1200000).toISOString() }
  ],
  signals: [
    { id: 1, junction_id: 'J-001', phase: 'NS_GREEN', duration: 45, mode: 'RL', timestamp: new Date().toISOString() },
    { id: 2, junction_id: 'J-002', phase: 'EW_GREEN', duration: 30, mode: 'WEBSTER', timestamp: new Date().toISOString() },
    { id: 3, junction_id: 'J-003', phase: 'NS_GREEN', duration: 60, mode: 'RL', timestamp: new Date().toISOString() }
  ],

  setJunctions: (junctions) => set({ junctions }),
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts.slice(0, 49)] })),
  setKpi: (kpi) => set({ kpi }),
  setViolations: (violations) => set({ violations }),
  acknowledgeViolation: (id) => set((state) => ({
    violations: state.violations.map(v => v.id === id ? { ...v, status: 'acknowledged' } : v)
  })),
  setSignals: (signals) => set({ signals }),
  updateSignal: (signal) => set((state) => {
    // If signal doesn't exist, we add it, otherwise update it
    const exists = state.signals.some(s => s.junction_id === signal.junction_id);
    const updatedSignals = exists 
      ? state.signals.map(s => s.junction_id === signal.junction_id ? { ...s, ...signal } : s)
      : [...state.signals, signal];
    return { signals: updatedSignals };
  }),
  
  getJunctionById: (id) => get().junctions.find(j => j.id === id),
  getSignalByJunctionId: (id) => get().signals.find(s => s.junction_id === id)
}));
