import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useDataStore } from './store/dataStore';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import VisionPage from './pages/VisionPage';
import SignalsPage from './pages/SignalsPage';
import ViolationsPage from './pages/ViolationsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import PredictionsPage from './pages/PredictionsPage';
import SimulationPage from './pages/SimulationPage';
import LoginPage from './pages/LoginPage';

const LANE_ORDER = ['LANE_1_NORTH', 'LANE_2_SOUTH', 'LANE_3_EAST', 'LANE_4_WEST'];

// Protect routes by ensuring operator is authenticated
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
}

export default function App() {
  const setVisionSignalState = useDataStore((state) => state.setVisionSignalState);

  // Master Global Countdown Timer Loop running continuously in background
  useEffect(() => {
    const timer = setInterval(() => {
      setVisionSignalState((prev) => {
        if (!prev.isAutoCycleActive) return prev;

        // Case A: Currently in SCANNING_TRAFFIC mode
        if (prev.masterMode === 'SCANNING_TRAFFIC') {
          if (prev.remainingSec <= 1) {
            const l1Duration = prev.laneTimers?.['LANE_1_NORTH']?.duration || 35;
            return {
              ...prev,
              masterMode: 'DYNAMIC_CYCLE',
              statusMessage: 'Vision AI Dynamic Cycle Active',
              activeLaneIndex: 0,
              activeLaneId: 'LANE_1_NORTH',
              remainingSec: l1Duration,
              totalDuration: l1Duration,
              lightColor: 'GREEN'
            };
          }
          return {
            ...prev,
            remainingSec: prev.remainingSec - 1
          };
        }

        // Case B: Currently in ALL_GREEN_HOLD mode
        if (prev.masterMode === 'ALL_GREEN_HOLD') {
          if (prev.remainingSec <= 1) {
            return {
              ...prev,
              masterMode: 'SCANNING_TRAFFIC',
              statusMessage: 'Scanning 4-Lane CCTV Feeds for Vehicle Density...',
              remainingSec: 4,
              lightColor: 'YELLOW'
            };
          }
          return {
            ...prev,
            remainingSec: prev.remainingSec - 1,
            lightColor: 'GREEN'
          };
        }

        // Case C: Currently in ALL_RED_HOLD mode
        if (prev.masterMode === 'ALL_RED_HOLD') {
          if (prev.remainingSec <= 1) {
            return {
              ...prev,
              masterMode: 'SCANNING_TRAFFIC',
              statusMessage: 'Emergency Clearance Complete. Resuming Traffic Flow...',
              remainingSec: 3,
              lightColor: 'YELLOW'
            };
          }
          return {
            ...prev,
            remainingSec: prev.remainingSec - 1,
            lightColor: 'RED'
          };
        }

        // Case D: Standard DYNAMIC_CYCLE rotation
        if (prev.remainingSec <= 1) {
          const nextIndex = (prev.activeLaneIndex + 1) % 4;
          const nextLaneKey = LANE_ORDER[nextIndex];
          const nextDuration = prev.laneTimers?.[nextLaneKey]?.duration || 35;

          return {
            ...prev,
            activeLaneIndex: nextIndex,
            activeLaneId: nextLaneKey,
            remainingSec: nextDuration,
            totalDuration: nextDuration,
            lightColor: 'GREEN'
          };
        }

        const nextSec = prev.remainingSec - 1;
        let nextColor = 'GREEN';
        if (nextSec <= 5 && nextSec > 0) {
          nextColor = 'YELLOW';
        } else if (nextSec <= 0) {
          nextColor = 'RED';
        }

        return {
          ...prev,
          remainingSec: nextSec,
          lightColor: nextColor
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [setVisionSignalState]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth page */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected Dashboard pages */}
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/vision" element={<ProtectedRoute><VisionPage /></ProtectedRoute>} />
        <Route path="/signals" element={<ProtectedRoute><SignalsPage /></ProtectedRoute>} />
        <Route path="/violations" element={<ProtectedRoute><ViolationsPage /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
        <Route path="/predictions" element={<ProtectedRoute><PredictionsPage /></ProtectedRoute>} />
        <Route path="/simulation" element={<ProtectedRoute><SimulationPage /></ProtectedRoute>} />
        
        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
