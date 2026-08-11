import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useDataStore } from '../../store/dataStore';
import { Menu, Bell, User, LogOut, ChevronDown } from 'lucide-react';

export default function TopBar({ onMenuToggle }) {
  const { user, logout } = useAuth();
  const alerts = useDataStore((state) => state.alerts);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Count active warnings and critical alerts
  const activeAlertCount = alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'WARNING').length;

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950 px-6">
      <div className="flex items-center gap-4">
        {/* Toggle mobile sidebar */}
        <button 
          onClick={onMenuToggle}
          className="rounded p-1 text-slate-400 hover:bg-slate-900 hover:text-white lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="hidden text-lg font-semibold text-white sm:block">
          Surat Smart Traffic Command Dashboard
        </h1>
      </div>

      <div className="flex items-center gap-6">
        {/* Notifications Alert Count */}
        <div className="relative cursor-pointer rounded-full p-2 text-slate-400 hover:bg-slate-900 hover:text-white">
          <Bell className="h-5 w-5" />
          {activeAlertCount > 0 && (
            <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-slate-950 animate-pulse">
              {activeAlertCount}
            </span>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-900"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 font-bold text-white text-sm">
              {user?.username ? user.username[0].toUpperCase() : 'U'}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold text-white">{user?.username || 'Operator'}</p>
              <p className="text-[10px] text-slate-400 capitalize">{user?.role || 'Guest'}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>

          {dropdownOpen && (
            <>
              {/* Overlay to close dropdown */}
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-48 rounded-lg border border-slate-800 bg-slate-950 p-1 shadow-lg z-20">
                <div className="px-4 py-2 border-b border-slate-900">
                  <p className="text-sm font-semibold text-white">{user?.email || 'operator@surat.gov.in'}</p>
                </div>
                <button 
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 rounded px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
