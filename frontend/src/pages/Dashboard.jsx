import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Package, Layers, CheckCircle2, AlertOctagon, Clock, AlertTriangle,
  TrendingUp, Activity, ArrowRight, ShieldAlert, Sparkles, Filter,
  Camera, ListOrdered, ShieldCheck, Cpu
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchDashboardMetrics();
  }, [selectedProduct, selectedBatch]);

  const fetchFilters = async () => {
    try {
      const [prodRes, batchRes] = await Promise.all([
        api.get('/products'),
        api.get('/batches')
      ]);
      setProducts(prodRes.data);
      setBatches(batchRes.data);
    } catch (err) {
      console.error('Failed to load filters', err);
    }
  };

  const fetchDashboardMetrics = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedProduct) params.product_id = selectedProduct;
      if (selectedBatch) params.batch_id = selectedBatch;
      const res = await api.get('/dashboard', { params });
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch dashboard metrics', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* Executive Welcome Hero & Quick Action Launchpad */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Google Gemini 3.8 Flash & PyTorch Active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Tile Quality Intelligence & Verification
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Connected inspection evidence, neural visual inference, human review governance, and grounded quality intelligence.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/inspections/new"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition hover:scale-[1.02] active:scale-[0.98]"
            >
              <Camera className="w-4 h-4" />
              <span>New Inspection</span>
            </Link>

            <Link
              to="/priority-queue"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold text-xs transition hover:scale-[1.02] active:scale-[0.98]"
            >
              <ListOrdered className="w-4 h-4 text-amber-400" />
              <span>Priority Queue</span>
            </Link>

            <Link
              to="/quality-ai"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 font-bold text-xs transition hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Gemini Intel</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-3 bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span>Active Scope:</span>
          <span className="text-slate-500 font-normal">
            {selectedProduct || selectedBatch ? 'Filtered View' : 'All Catalogue & Production Lots'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedProduct}
            onChange={(e) => { setSelectedProduct(e.target.value); setSelectedBatch(''); }}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium"
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.product_code} â€” {p.name}</option>
            ))}
          </select>

          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium"
          >
            <option value="">All Batches</option>
            {batches
              .filter((b) => !selectedProduct || b.product_id === parseInt(selectedProduct))
              .map((b) => (
                <option key={b.id} value={b.id}>{b.batch_code} ({b.status.toUpperCase()})</option>
              ))}
          </select>

          {(selectedProduct || selectedBatch) && (
            <button
              onClick={() => { setSelectedProduct(''); setSelectedBatch(''); }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Executive KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">

        {/* Distinct Tiles Inspected */}
        <Link
          to="/inspections"
          className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Distinct Tiles</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 group-hover:text-emerald-600 transition">
            {stats?.distinct_inspected_items ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-medium">
            Distinct physical pieces
          </div>
        </Link>

        {/* Confirmed Defect Rate % */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Defect Rate</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {stats?.overall_confirmed_defect_rate_pct ?? 0}%
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-medium">
            Confirmed defects / items
          </div>
        </div>

        {/* Confirmed Defects */}
        <Link
          to="/defects"
          className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-red-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Confirmed</span>
            <div className="p-1.5 bg-red-50 text-red-600 rounded-lg group-hover:bg-red-600 group-hover:text-white transition">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-red-600">
            {stats?.confirmed_defects_count ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-medium">
            Verified by human review
          </div>
        </Link>

        {/* Pending Review Queue */}
        <Link
          to="/priority-queue"
          className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Review</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-600 group-hover:text-white transition">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600">
            {stats?.pending_reviews_count ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-medium">
            Awaiting human sign-off
          </div>
        </Link>

        {/* Open Actions & Overdue */}
        <Link
          to="/defects"
          className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Open Actions</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-600 group-hover:text-white transition">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 group-hover:text-indigo-600 transition">
            {stats?.open_actions_count ?? 0}
          </div>
          <div className="text-[10px] text-red-500 font-bold mt-1">
            {stats?.overdue_actions_count ?? 0} overdue
          </div>
        </Link>

        {/* Reopened Defects */}
        <Link
          to="/defects"
          className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-purple-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reopened</span>
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-purple-700">
            {stats?.reopened_defects_count ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-medium">
            Recurring after repair
          </div>
        </Link>

      </div>

      {/* Main Visualizations: 14-Day Trend + Supported Defect Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Trend Graph (2 Columns) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">14-Day Physical Inspection Volume & Defect Rate</h2>
                <p className="text-xs text-slate-500">Daily physical tile volume and verified defect rate</p>
              </div>
              <div className="flex items-center space-x-3 text-xs">
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 bg-indigo-500 rounded-sm"></span>
                  <span className="text-slate-600 font-medium">Inspected Volume</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 bg-red-500 rounded-sm"></span>
                  <span className="text-slate-600 font-medium">Confirmed Defects</span>
                </span>
              </div>
            </div>

            <div className="h-56 flex items-end justify-between gap-1 pt-6 px-2 border-b border-slate-100">
              {stats?.trends && stats.trends.length > 0 ? (
                stats.trends.map((t, idx) => {
                  const maxVol = Math.max(...stats.trends.map((x) => x.inspected_items), 10);
                  const heightPct = Math.min(Math.round((t.inspected_items / maxVol) * 100), 100);
                  const defectHeightPct = Math.min(Math.round((t.confirmed_defects / maxVol) * 100), 100);

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center group relative">
                      {/* Tooltip */}
                      <div className="absolute -top-12 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[10px] py-1 px-2.5 rounded-lg shadow-xl z-20 whitespace-nowrap">
                        <span className="font-semibold">{t.date}</span>
                        <span>Items: {t.inspected_items} | Defects: {t.confirmed_defects} ({t.defect_rate_pct}%)</span>
                      </div>

                      <div className="w-full flex items-end justify-center gap-1 h-44">
                        <div
                          style={{ height: `${Math.max(heightPct, 6)}%` }}
                          className="w-full max-w-[16px] bg-indigo-100 group-hover:bg-indigo-300 rounded-t transition"
                        ></div>
                        <div
                          style={{ height: `${Math.max(defectHeightPct, t.confirmed_defects > 0 ? 10 : 0)}%` }}
                          className="w-full max-w-[16px] bg-red-400 group-hover:bg-red-600 rounded-t transition"
                        ></div>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-2 truncate w-full text-center">
                        {t.date.split(' ')[1] || t.date}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center w-full h-full text-xs text-slate-400">
                  No trend history recorded yet.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Model Version: <strong>TileDefectClassifier_v1.0.0</strong></span>
            <Link to="/inspections" className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center space-x-1">
              <span>View full inspection logs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Defect Categories Breakdown */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-slate-900">Supported Defect Classes</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border">
                MVTec AD Dataset
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">Confirmed real defect distribution</p>

            <div className="space-y-3.5">
              {stats?.defect_categories && stats.defect_categories.length > 0 ? (
                stats.defect_categories.map((c, idx) => {
                  const maxC = Math.max(...stats.defect_categories.map((x) => x.count), 1);
                  const pct = Math.round((c.count / maxC) * 100);
                  const categoryColors = {
                    crack: 'bg-red-500',
                    glue_strip: 'bg-amber-500',
                    gray_stroke: 'bg-slate-500',
                    oil: 'bg-blue-500',
                    rough: 'bg-orange-500'
                  };
                  const barColor = categoryColors[c.category] || 'bg-indigo-600';

                  return (
                    <div key={idx}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-800 capitalize">
                          {c.category.replace('_', ' ')}
                        </span>
                        <span className="font-bold text-slate-900">{c.count} cases</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all ${barColor}`}
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-slate-400 py-6 text-center">
                  No confirmed defects recorded.
                </div>
              )}
            </div>
          </div>

          <Link
            to="/quality-ai"
            className="mt-6 flex items-center justify-center space-x-2 py-2.5 px-4 bg-gradient-to-r from-indigo-50 to-violet-50 hover:from-indigo-100 hover:to-violet-100 text-indigo-700 font-bold rounded-xl text-xs transition border border-indigo-200/80 shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Ask Google Gemini 3.8 Intelligence</span>
          </Link>
        </div>

      </div>

      {/* Recent Traceability Audit Trail */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Traceable Quality Activity</h2>
              <p className="text-xs text-slate-500">PostgreSQL Immutable Audit Trail with user and role attribution</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Live Stream
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Actor</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Entity</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Reason / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {stats?.recent_activity && stats.recent_activity.length > 0 ? (
                stats.recent_activity.slice(0, 8).map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                      {new Date(a.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{a.actor_name}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 border text-slate-600">
                        {a.actor_role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-600">{a.entity_name} #{a.entity_id}</td>
                    <td className="py-2.5 px-3 font-bold text-indigo-600">{a.action}</td>
                    <td className="py-2.5 px-3 text-slate-600 truncate max-w-xs">{a.reason || 'â€”'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-slate-400">
                    No activity recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
