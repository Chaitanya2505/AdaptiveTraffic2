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
    { id: 1, junction_id: 'J-001', phase: 'LANE_1_NORTH', duration: 45, mode: 'MANUAL', timestamp: new Date().toISOString() },
    { id: 2, junction_id: 'J-002', phase: 'LANE_3_EAST', duration: 30, mode: 'MANUAL', timestamp: new Date().toISOString() },
    { id: 3, junction_id: 'J-003', phase: 'LANE_1_NORTH', duration: 60, mode: 'MANUAL', timestamp: new Date().toISOString() }
  ],

  // Shared Vision Sensing Telemetry State
  // Real-world IRC:106-1990 PCE (Passenger Car Equivalent) Queue Length Engine
  visionSignalState: {
    activeLaneId: 'LANE_1_NORTH',
    activeLaneIndex: 0,
    remainingSec: 0,
    totalDuration: 0,
    lightColor: 'RED',
    masterMode: 'WAITING',
    statusMessage: 'Waiting for Vision AI or Manual Override',
    isAutoCycleActive: false,
    laneTimers: {}
  },

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
    const exists = state.signals.some(s => s.junction_id === signal.junction_id);
    const updatedSignals = exists 
      ? state.signals.map(s => s.junction_id === signal.junction_id ? { ...s, ...signal } : s)
      : [...state.signals, signal];
    return { signals: updatedSignals };
  }),

  setVisionSignalState: (updater) => set((state) => {
    const nextVal = typeof updater === 'function' ? updater(state.visionSignalState) : { ...state.visionSignalState, ...updater };
    return { visionSignalState: nextVal };
  }),

  getJunctionById: (id) => get().junctions.find(j => j.id === id),
  getSignalByJunctionId: (id) => get().signals.find(s => s.junction_id === id)
}));
