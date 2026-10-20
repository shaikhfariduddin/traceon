import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { ShieldCheck, UserCheck, Wrench } from 'lucide-react';

const icons = {
  inspector: UserCheck,
  supervisor: Wrench,
  manager: ShieldCheck,
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/auth/users');
        setUsers(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load demo accounts.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Demo Accounts & Roles</h1>
        <p className="text-xs text-slate-500 mt-1">
          Seeded accounts for judging. Passwords are local demo credentials only. The backend still enforces every action.
        </p>
      </div>
      {error && <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs">{error}</div>}
      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
      ) : (
        <div className="grid gap-4">
          {users.map((u) => {
            const Icon = icons[u.role] || UserCheck;
            return (
              <div key={u.id} className="bg-white border rounded-xl p-5 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg"><Icon className="w-5 h-5" /></div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{u.full_name}</div>
                    <div className="text-xs text-slate-500">{u.username} Â· {u.email}</div>
                  </div>
                </div>
                <span className="text-[11px] font-bold uppercase px-2 py-1 rounded-full bg-slate-100 border">{u.role}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="text-xs text-slate-500 bg-white border rounded-xl p-4">
        <div><strong>inspector / inspector123</strong> â€” upload, review, request evidence</div>
        <div><strong>supervisor / supervisor123</strong> â€” assign and complete corrective work</div>
        <div><strong>manager / manager123</strong> â€” resolve disputes, archive products, hold/release batches</div>
      </div>
    </div>
  );
}
