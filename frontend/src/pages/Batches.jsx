import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Layers, Plus, Search } from 'lucide-react';

export default function Batches() {
  const { hasRole } = useAuth();
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_id: '',
    batch_code: '',
    quantity: 1000,
    supplier: '',
    production_date: new Date().toISOString().slice(0, 10),
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (status) params.status = status;
      if (productId) params.product_id = productId;
      const [bRes, pRes] = await Promise.all([
        api.get('/batches', { params }),
        api.get('/products'),
      ]);
      setBatches(bRes.data);
      setProducts(pRes.data);
      if (!form.product_id && pRes.data.length) {
        setForm((f) => ({ ...f, product_id: pRes.data[0].id }));
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load batches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status, productId]);

  const filtered = batches.filter((b) => {
    const term = search.toLowerCase();
    if (!term) return true;
    return (
      b.batch_code.toLowerCase().includes(term) ||
      (b.product?.name || '').toLowerCase().includes(term) ||
      (b.supplier || '').toLowerCase().includes(term)
    );
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/batches', {
        product_id: parseInt(form.product_id, 10),
        batch_code: form.batch_code,
        quantity: parseInt(form.quantity, 10),
        supplier: form.supplier || null,
        production_date: new Date(form.production_date).toISOString(),
        status: 'pending',
      });
      setShowForm(false);
      await load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Batch registration failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Production Batches</h1>
          <p className="text-xs text-slate-500">Batch registration, inspection coverage, and hold/release history.</p>
        </div>
        {hasRole(['inspector', 'supervisor', 'manager']) && (
          <button onClick={() => setShowForm(true)} className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold">
            <Plus className="w-4 h-4" />
            <span>Register Batch</span>
          </button>
        )}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">{error}</div>}

      <div className="flex flex-wrap gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search batch, product, supplier..." className="w-full text-xs bg-slate-50 border rounded-lg pl-9 pr-3 py-2" />
        </div>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className="text-xs border rounded-lg px-3 py-2">
          <option value="">All products</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.product_code}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-xs border rounded-lg px-3 py-2">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_inspection">In inspection</option>
          <option value="on_hold">On hold</option>
          <option value="released">Released</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border py-16 text-center text-xs text-slate-400">No batches match the filters.</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4 text-left">Batch</th>
                <th className="py-3 px-4 text-left">Product</th>
                <th className="py-3 px-4 text-left">Qty</th>
                <th className="py-3 px-4 text-left">Inspected items</th>
                <th className="py-3 px-4 text-left">Confirmed defects</th>
                <th className="py-3 px-4 text-left">Status</th>
                <th className="py-3 px-4 text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-bold">{b.batch_code}</td>
                  <td className="py-3 px-4">{b.product?.name || 'â€”'}</td>
                  <td className="py-3 px-4">{b.quantity}</td>
                  <td className="py-3 px-4">{b.inspected_count}</td>
                  <td className="py-3 px-4 text-red-600 font-semibold">{b.defect_count}</td>
                  <td className="py-3 px-4 capitalize">{b.status.replace('_', ' ')}</td>
                  <td className="py-3 px-4 text-right">
                    <Link to={`/batches/${b.id}`} className="text-indigo-600 font-semibold">Details</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-xl max-w-lg w-full p-6 space-y-3">
            <h2 className="text-base font-bold flex items-center space-x-2"><Layers className="w-4 h-4" /><span>Register Batch</span></h2>
            <select required value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className="w-full text-xs border rounded-lg px-3 py-2">
              {products.filter((p) => !p.is_archived).map((p) => <option key={p.id} value={p.id}>{p.product_code} â€” {p.name}</option>)}
            </select>
            <input required placeholder="Batch code" value={form.batch_code} onChange={(e) => setForm({ ...form, batch_code: e.target.value })} className="w-full text-xs border rounded-lg px-3 py-2" />
            <input type="number" min={1} required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full text-xs border rounded-lg px-3 py-2" />
            <input placeholder="Supplier (optional)" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="w-full text-xs border rounded-lg px-3 py-2" />
            <input type="date" required value={form.production_date} onChange={(e) => setForm({ ...form, production_date: e.target.value })} className="w-full text-xs border rounded-lg px-3 py-2" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 bg-slate-100 rounded-lg text-xs font-semibold">Cancel</button>
              <button disabled={saving} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold">{saving ? 'Saving...' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
