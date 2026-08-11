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

  // Live Shared Vision Sensing Signal Telemetry State synced across pages
  visionSignalState: {
    activeLaneId: 'LANE_1_NORTH',
    activeLaneIndex: 0,
    remainingSec: 35,
    totalDuration: 35,
    lightColor: 'GREEN', // 'GREEN' | 'YELLOW' | 'RED'
    masterMode: 'DYNAMIC_CYCLE', // 'DYNAMIC_CYCLE' | 'ALL_GREEN_HOLD' | 'ALL_RED_HOLD' | 'SCANNING_TRAFFIC'
    statusMessage: 'Vision AI Dynamic Cycle Active',
    isAutoCycleActive: true,
    laneTimers: {
      LANE_1_NORTH: { duration: 35, vehicles: 6, meters: 24.5, density: 'MODERATE (45%)', cars: 3, bikes: 2, autos: 1, buses: 0, trucks: 0 },
      LANE_2_SOUTH: { duration: 25, vehicles: 4, meters: 15.0, density: 'LOW (30%)', cars: 2, bikes: 1, autos: 1, buses: 0, trucks: 0 },
      LANE_3_EAST: { duration: 50, vehicles: 9, meters: 38.0, density: 'HIGH (75%)', cars: 4, bikes: 3, autos: 1, buses: 0, trucks: 1 },
      LANE_4_WEST: { duration: 30, vehicles: 5, meters: 18.5, density: 'MODERATE (40%)', cars: 2, bikes: 2, autos: 1, buses: 0, trucks: 0 }
    }
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
