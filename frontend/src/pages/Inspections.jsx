import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Camera, Search, Filter, Eye, AlertOctagon, CheckCircle2, Clock } from 'lucide-react';

export default function Inspections() {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [sampleType, setSampleType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchInspections();
  }, [statusFilter, sampleType]);

  const fetchInspections = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status_filter = statusFilter;
      if (sampleType) params.sample_type = sampleType;
      const res = await api.get('/inspections', { params });
      setInspections(res.data);
    } catch (err) {
      console.error('Failed to load inspections', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = inspections.filter((i) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      i.item_reference.toLowerCase().includes(term) ||
      (i.location && i.location.toLowerCase().includes(term)) ||
      (i.inspector?.full_name && i.inspector.full_name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Searchable Inspection History</h1>
          <p className="text-xs text-slate-500">
            Complete traceable log of tile inspections, AI classification flags, and human confirmation decisions
          </p>
        </div>

        <Link
          to="/inspections/new"
          className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow transition self-start sm:self-auto"
        >
          <Camera className="w-4 h-4" />
          <span>New Inspection</span>
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Tile Reference, Location, Inspector..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
        >
          <option value="">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="in_review">In Review</option>
          <option value="confirmed_defect">Confirmed Defect</option>
          <option value="confirmed_good">Confirmed Good</option>
          <option value="closed">Closed / Resolved</option>
        </select>

        <select
          value={sampleType}
          onChange={(e) => setSampleType(e.target.value)}
          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
        >
          <option value="">All Sample Types</option>
          <option value="individual_tile">Individual Tile</option>
          <option value="surface_sample">Surface Texture Specimen</option>
          <option value="batch_sample">Batch Sample</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Evidence</th>
                  <th className="py-3 px-4">Tile Reference</th>
                  <th className="py-3 px-4">Sample Type</th>
                  <th className="py-3 px-4">AI Prediction</th>
                  <th className="py-3 px-4">Human Status</th>
                  <th className="py-3 px-4">Inspector</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((insp) => {
                  const thumb = insp.images && insp.images.length > 0 ? insp.images[0].file_path : null;
                  const res = insp.latest_model_result;
                  const rev = insp.latest_review;

                  return (
                    <tr key={insp.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-4">
                        {thumb ? (
                          <img src={thumb} alt={insp.item_reference} className="w-10 h-10 object-cover rounded border border-slate-200 bg-slate-100" />
                        ) : (
                          <div className="w-10 h-10 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-[10px] text-slate-400">
                            No img
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-bold font-mono text-slate-900">
                        {insp.item_reference}
                      </td>
                      <td className="py-2.5 px-4 capitalize">
                        {insp.sample_type.replace('_', ' ')}
                      </td>
                      <td className="py-2.5 px-4">
                        {res ? (
                          <div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              res.predicted_class === 'defective'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {res.predicted_class}
                            </span>
                            {res.defect_type && res.defect_type !== 'none' && (
                              <div className="text-[10px] text-slate-400 capitalize mt-0.5 font-medium">
                                {res.defect_type.replace('_', ' ')} ({(res.confidence_score * 100).toFixed(0)}%)
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Pending</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize border ${
                          insp.status.includes('defect') ? 'bg-red-100 text-red-800 border-red-300' :
                          insp.status === 'confirmed_good' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                          insp.status === 'closed' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                          'bg-amber-100 text-amber-800 border-amber-300'
                        }`}>
                          {insp.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {insp.inspector?.full_name || 'Inspector'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(insp.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Link
                          to={`/inspections/${insp.id}`}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400 text-xs">
            No inspection records match the selected filters.
          </div>
        )}
      </div>

    </div>
  );
}
