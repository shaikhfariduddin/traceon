import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export default function BatchDetail() {
  const { id } = useParams();
  const { hasRole } = useAuth();
  const [batch, setBatch] = useState(null);
  const [inspections, setInspections] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState('hold');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [denied, setDenied] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [bRes, iRes, dRes] = await Promise.all([
        api.get(`/batches/${id}`),
        api.get('/inspections', { params: { batch_id: id } }),
        api.get(`/batches/${id}/decisions`),
      ]);
      setBatch(bRes.data);
      setInspections(iRes.data);
      setDecisions(dRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load batch.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleDecision = async (e) => {
    e.preventDefault();
    setDenied('');
    setSubmitting(true);
    try {
      await api.post(`/batches/${id}/decision`, { decision, reason });
      setReason('');
      await load();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Batch decision refused.';
      setDenied(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  }
  if (error || !batch) {
    return <div className="p-8 text-center text-sm text-red-700">{error || 'Batch not found.'}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-start space-x-3">
        <Link to="/batches" className="p-2 bg-slate-100 rounded-lg"><ArrowLeft className="w-4 h-4" /></Link>
        <div>
          <div className="font-mono text-xs font-bold text-indigo-600">{batch.batch_code}</div>
          <h1 className="text-2xl font-bold text-slate-900">{batch.product?.name || 'Tile batch'}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Status <span className="capitalize font-semibold text-slate-700">{batch.status.replace('_', ' ')}</span> Â·
            Quantity {batch.quantity} Â· Distinct inspected items {batch.inspected_count} Â· Confirmed defects {batch.defect_count}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border p-5">
          <div className="flex justify-between mb-3">
            <h2 className="text-sm font-bold">Inspections in this batch</h2>
            <Link to="/inspections/new" className="text-xs font-semibold text-indigo-600">New inspection</Link>
          </div>
          {inspections.length === 0 ? (
            <p className="text-xs text-slate-400">No inspections recorded.</p>
          ) : (
            <table className="min-w-full text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left py-2">Item</th>
                  <th className="text-left py-2">AI</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inspections.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2"><Link className="font-mono font-bold text-indigo-600" to={`/inspections/${i.id}`}>{i.item_reference}</Link></td>
                    <td className="py-2 capitalize">{i.latest_model_result?.predicted_class || 'pending'}</td>
                    <td className="py-2 capitalize">{i.status.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-bold mb-2 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Manager hold / release</span>
            </h2>
            <p className="text-[11px] text-slate-500 mb-3">
              Batch decisions are separate from individual tile outcomes. Only a Quality Manager can record them.
            </p>
            <form onSubmit={handleDecision} className="space-y-2">
              <select value={decision} onChange={(e) => setDecision(e.target.value)} className="w-full text-xs border rounded-lg px-2 py-2">
                <option value="hold">Hold</option>
                <option value="release">Release</option>
                <option value="conditional">Conditional</option>
              </select>
              <textarea required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Decision reason..." className="w-full text-xs border rounded-lg px-2 py-2" />
              {denied && <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-[11px]">{denied}</div>}
              <button disabled={submitting} className="w-full py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                {hasRole('manager') ? 'Record official decision' : 'Attempt decision (backend enforced)'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-xs font-bold uppercase text-slate-500 mb-2">Decision history</h2>
            {decisions.length === 0 ? (
              <p className="text-xs text-slate-400">No batch decisions yet.</p>
            ) : (
              <div className="space-y-2">
                {decisions.map((d) => (
                  <div key={d.id} className="p-2 bg-slate-50 rounded border text-xs">
                    <div className="font-semibold capitalize">{d.decision}</div>
                    <div className="text-slate-600">{d.reason}</div>
                    <div className="text-[10px] text-slate-400 mt-1">{d.created_at ? new Date(d.created_at).toLocaleString() : ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
