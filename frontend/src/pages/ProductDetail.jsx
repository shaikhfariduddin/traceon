import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Layers, Plus } from 'lucide-react';

export default function ProductDetail() {
  const { id } = useParams();
  const { hasRole } = useAuth();
  const [product, setProduct] = useState(null);
  const [batches, setBatches] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showBatch, setShowBatch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [batchForm, setBatchForm] = useState({
    batch_code: '',
    quantity: 1000,
    supplier: '',
    production_date: new Date().toISOString().slice(0, 10),
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [pRes, bRes, iRes] = await Promise.all([
        api.get(`/products/${id}`),
        api.get('/batches', { params: { product_id: id } }),
        api.get('/inspections', { params: { product_id: id } }),
      ]);
      setProduct(pRes.data);
      setBatches(bRes.data);
      setInspections(iRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load product.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleArchive = async () => {
    if (!window.confirm('Archive this product? Historical inspections remain available.')) return;
    try {
      await api.post(`/products/${id}/archive`);
      await load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Archive refused.');
    }
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/batches', {
        product_id: parseInt(id, 10),
        batch_code: batchForm.batch_code,
        quantity: parseInt(batchForm.quantity, 10),
        supplier: batchForm.supplier || null,
        production_date: new Date(batchForm.production_date).toISOString(),
        status: 'pending',
      });
      setShowBatch(false);
      await load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Batch registration failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center text-sm text-red-700">
        {error || 'Product not found.'}
        <div className="mt-3">
          <Link to="/products" className="text-indigo-600 font-semibold">Back to products</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start space-x-3">
          <Link to="/products" className="p-2 bg-slate-100 rounded-lg text-slate-600">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="font-mono text-xs font-bold text-indigo-600">{product.product_code}</div>
            <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
            <p className="text-xs text-slate-500 mt-1">
              {product.tile_type} Â· {product.dimensions} Â· {product.finish} Â· {product.material}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {hasRole(['inspector', 'supervisor', 'manager']) && !product.is_archived && (
            <button onClick={() => setShowBatch(true)} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold inline-flex items-center space-x-1">
              <Plus className="w-3.5 h-3.5" />
              <span>Register Batch</span>
            </button>
          )}
          {hasRole('manager') && !product.is_archived && (
            <button onClick={handleArchive} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold">
              Archive
            </button>
          )}
        </div>
      </div>

      {product.is_archived && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
          This product is archived. Historical batches and inspections remain searchable.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Batches ({batches.length})</span>
          </h2>
          {batches.length === 0 ? (
            <p className="text-xs text-slate-400">No batches registered.</p>
          ) : (
            <div className="space-y-2">
              {batches.map((b) => (
                <Link key={b.id} to={`/batches/${b.id}`} className="block p-3 rounded-lg border border-slate-200 hover:border-indigo-300">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono font-bold">{b.batch_code}</span>
                    <span className="capitalize">{b.status.replace('_', ' ')}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Qty {b.quantity} Â· Inspected items {b.inspected_count} Â· Confirmed defects {b.defect_count}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Associated Inspections</h2>
          {inspections.length === 0 ? (
            <p className="text-xs text-slate-400">No inspections yet.</p>
          ) : (
            <div className="space-y-2">
              {inspections.slice(0, 12).map((i) => (
                <Link key={i.id} to={`/inspections/${i.id}`} className="flex justify-between text-xs p-2 rounded border border-slate-100 hover:bg-slate-50">
                  <span className="font-mono font-bold">{i.item_reference}</span>
                  <span className="capitalize text-slate-500">{i.status.replace('_', ' ')}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {showBatch && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateBatch} className="bg-white rounded-xl max-w-lg w-full p-6 space-y-3">
            <h2 className="text-base font-bold">Register Batch</h2>
            <input required placeholder="Batch code e.g. B-201" value={batchForm.batch_code} onChange={(e) => setBatchForm({ ...batchForm, batch_code: e.target.value })} className="w-full text-xs border rounded-lg px-3 py-2" />
            <input type="number" required min={1} value={batchForm.quantity} onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })} className="w-full text-xs border rounded-lg px-3 py-2" />
            <input placeholder="Supplier / manufacturer (optional)" value={batchForm.supplier} onChange={(e) => setBatchForm({ ...batchForm, supplier: e.target.value })} className="w-full text-xs border rounded-lg px-3 py-2" />
            <input type="date" required value={batchForm.production_date} onChange={(e) => setBatchForm({ ...batchForm, production_date: e.target.value })} className="w-full text-xs border rounded-lg px-3 py-2" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowBatch(false)} className="px-3 py-2 bg-slate-100 rounded-lg text-xs font-semibold">Cancel</button>
              <button disabled={saving} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold">{saving ? 'Saving...' : 'Create Batch'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
