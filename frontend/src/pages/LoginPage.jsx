import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/common/Button';
import { ShieldAlert, LogIn } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      // Error handled by hook
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-900 px-4">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 font-extrabold text-white text-2xl shadow-lg shadow-emerald-500/20">
            ER
          </div>
          <h2 className="mt-4 text-xl font-bold text-white tracking-tight">E-Rakshak Traffic Hub</h2>
          <p className="mt-1.5 text-xs text-slate-500 tracking-wide uppercase">Operator Sign In</p>
        </div>

        {error && (
          <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-red-900/30 bg-red-950/20 p-3.5 text-xs text-red-400">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="leading-normal">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g., admin"
              className="mt-2 w-full rounded-lg border border-slate-850 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-2 w-full rounded-lg border border-slate-850 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <Button 
            type="submit"
            loading={loading}
            icon={LogIn}
            className="w-full mt-2"
          >
            Login to Command Center
          </Button>
        </form>

        <div className="mt-6 border-t border-slate-900 pt-4 text-center text-[10px] text-slate-600 leading-normal">
          <p>For testing, use Seeded Accounts:</p>
          <p className="mt-1">Admin: <span className="text-slate-500 font-mono">admin / adminpassword</span></p>
          <p>Operator: <span className="text-slate-500 font-mono">operator / operatorpassword</span></p>
        </div>
      </div>
    </div>
  );
}
