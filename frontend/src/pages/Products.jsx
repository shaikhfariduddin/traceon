import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Archive, Package, Plus, Search } from 'lucide-react';

const emptyForm = {
  product_code: '',
  name: '',
  tile_type: 'Porcelain',
  dimensions: '600x600 mm',
  finish: 'Satin',
  material: 'Vitrified Porcelain',
};

export default function Products() {
  const { hasRole } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const canRegister = hasRole(['inspector', 'supervisor', 'manager']);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = products.filter((p) => {
    const term = search.toLowerCase();
    if (!term) return true;
    return (
      p.product_code.toLowerCase().includes(term) ||
      p.name.toLowerCase().includes(term) ||
      (p.tile_type || '').toLowerCase().includes(term)
    );
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/products', form);
      setShowForm(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Product registration failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tile Products</h1>
          <p className="text-xs text-slate-500">Register product lines, finishes, and catalogue identifiers.</p>
        </div>
        {canRegister && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Register Product</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">{error}</div>
      )}

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product code, name, or type..."
          className="w-full text-xs bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-xs text-slate-400">
          No products match the current search.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to={`/products/${p.id}`}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-indigo-400 transition shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                  <Package className="w-5 h-5" />
                </div>
                {p.is_archived && (
                  <span className="inline-flex items-center space-x-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border">
                    <Archive className="w-3 h-3" />
                    <span>Archived</span>
                  </span>
                )}
              </div>
              <div className="mt-3 font-mono text-xs font-bold text-indigo-600">{p.product_code}</div>
              <h2 className="text-sm font-bold text-slate-900 mt-1">{p.name}</h2>
              <p className="text-xs text-slate-500 mt-2">
                {p.tile_type} Â· {p.dimensions || 'n/a'} Â· {p.finish || 'n/a'}
              </p>
            </Link>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Register Tile Product</h2>
            {[
              ['product_code', 'Product ID / Code'],
              ['name', 'Product Name'],
              ['tile_type', 'Tile Type / Category'],
              ['dimensions', 'Dimensions'],
              ['finish', 'Finish'],
              ['material', 'Material'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{label} *</label>
                <input
                  required={key === 'product_code' || key === 'name' || key === 'tile_type'}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-semibold">
                Cancel
              </button>
              <button disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                {saving ? 'Saving...' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
