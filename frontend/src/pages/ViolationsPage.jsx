import React, { useState, useEffect } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { useApi } from '../hooks/useApi';
import { useDataStore } from '../store/dataStore';
import { ShieldCheck, ShieldAlert, Filter, Check } from 'lucide-react';

export default function ViolationsPage() {
  const junctions = useDataStore((state) => state.junctions);
  const violationsStore = useDataStore((state) => state.violations);
  const acknowledgeStore = useDataStore((state) => state.acknowledgeViolation);
  const setViolations = useDataStore((state) => state.setViolations);

  const [selectedJunction, setSelectedJunction] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [violationsList, setViolationsList] = useState([]);

  const { loading, request } = useApi();

  const fetchViolations = async () => {
    try {
      let url = '/violations';
      const params = [];
      if (selectedJunction !== 'ALL') params.push(`junction_id=${selectedJunction}`);
      if (selectedStatus !== 'ALL') params.push(`status=${selectedStatus}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const data = await request('get', url);
      setViolations(data);
      setViolationsList(data);
    } catch (err) {
      console.log("Backend offline, utilizing cached store violations.");
      // Fallback local filtering
      let filtered = [...violationsStore];
      if (selectedJunction !== 'ALL') filtered = filtered.filter(v => v.junction_id === selectedJunction);
      if (selectedStatus !== 'ALL') filtered = filtered.filter(v => v.status === selectedStatus);
      setViolationsList(filtered);
    }
  };

  useEffect(() => {
    fetchViolations();
  }, [selectedJunction, selectedStatus, violationsStore]);

  const handleAcknowledge = async (id) => {
    try {
      await request('post', `/violations/${id}/ack`);
      acknowledgeStore(id);
    } catch (err) {
      console.log("Backend offline, acknowledging locally in state.");
      acknowledgeStore(id);
    }
  };

  // Stats calculation
  const totalCount = violationsList.length;
  const pendingCount = violationsList.filter(v => v.status === 'active').length;
  const acknowledgedCount = violationsList.filter(v => v.status === 'acknowledged').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-white tracking-tight">BRTS Violations</h2>
        <p className="text-xs text-slate-500 font-medium">Audit logs and evidence review for lane intrusions inside transit corridors</p>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Incidents Listed</p>
          <p className="mt-2 text-2xl font-bold text-white">{totalCount}</p>
        </div>
        <div className="rounded-xl border border-slate-850 bg-red-950/15 border-l-4 border-l-red-500 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Active Pending Review</p>
          <p className="mt-2 text-2xl font-bold text-red-500">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-slate-850 bg-emerald-950/15 border-l-4 border-l-emerald-500 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Reviewed & Acknowledged</p>
          <p className="mt-2 text-2xl font-bold text-emerald-500">{acknowledgedCount}</p>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <Card title="Violation Registry Filters" subtitle="Query list by location and audit state">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-400">Filter:</span>
          </div>

          <div>
            <select
              value={selectedJunction}
              onChange={(e) => setSelectedJunction(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Junctions</option>
              {junctions.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="active">Active Pending</option>
              <option value="acknowledged">Acknowledged</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Registry Table Card */}
      <Card title="Violation Registry List">
        <div className="overflow-x-auto">
          {violationsList.length === 0 ? (
            <div className="text-center text-slate-500 py-10 text-sm">
              No violations found matching query criteria.
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-850 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="pb-3 py-2">ID</th>
                  <th className="pb-3 py-2">Junction</th>
                  <th className="pb-3 py-2">Vehicle Class</th>
                  <th className="pb-3 py-2">License Plate</th>
                  <th className="pb-3 py-2">Timestamp</th>
                  <th className="pb-3 py-2">Status</th>
                  <th className="pb-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/50">
                {violationsList.map((v) => {
                  const jName = junctions.find(j => j.id === v.junction_id)?.name || v.junction_id;
                  const isPending = v.status === 'active';

                  return (
                    <tr key={v.id} className="hover:bg-slate-900/10">
                      <td className="py-4 font-mono font-bold text-slate-500">V-{v.id}</td>
                      <td className="py-4 font-semibold text-slate-200">{jName}</td>
                      <td className="py-4 capitalize">
                        <Badge variant="info">{v.vehicle_class}</Badge>
                      </td>
                      <td className="py-4 font-mono font-semibold text-white tracking-wide">{v.license_plate}</td>
                      <td className="py-4 text-slate-400">{new Date(v.timestamp).toLocaleString()}</td>
                      <td className="py-4">
                        <Badge variant={isPending ? 'danger' : 'success'}>
                          {isPending ? 'Pending' : 'Acknowledged'}
                        </Badge>
                      </td>
                      <td className="py-4 text-right">
                        {isPending ? (
                          <Button
                            variant="primary"
                            onClick={() => handleAcknowledge(v.id)}
                            icon={Check}
                            className="py-1 px-3 text-xs"
                          >
                            Acknowledge
                          </Button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                            <ShieldCheck className="h-4.5 w-4.5" /> Checked
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
