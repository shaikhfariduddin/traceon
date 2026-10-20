import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle, Wrench, CheckCircle2, Clock, Plus, ShieldAlert,
  RotateCcw, Check, User, Calendar
} from 'lucide-react';

export default function Defects() {
  const [defects, setDefects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, hasRole } = useAuth();

  // Create action modal
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState(null);
  const [actionTitle, setActionTitle] = useState('');
  const [actionDesc, setActionDesc] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Complete action modal
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [compNotes, setCompNotes] = useState('');

  useEffect(() => {
    fetchDefectsAndUsers();
  }, []);

  const fetchDefectsAndUsers = async () => {
    setLoading(true);
    try {
      const [defRes, usrRes] = await Promise.all([
        api.get('/defects'),
        api.get('/auth/users')
      ]);
      setDefects(defRes.data);
      setUsers(usrRes.data);
      if (usrRes.data.length > 0) {
        setAssignedTo(usrRes.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load defects', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAction = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/defects/${selectedDefect.id}/actions`, {
        defect_id: selectedDefect.id,
        title: actionTitle,
        description: actionDesc,
        assigned_to_id: parseInt(assignedTo),
        due_date: new Date(dueDate).toISOString()
      });
      setShowActionModal(false);
      setActionTitle('');
      setActionDesc('');
      await fetchDefectsAndUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to assign corrective action');
    }
  };

  const handleCompleteAction = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/actions/${selectedAction.id}/complete`, {
        completion_notes: compNotes
      });
      setShowCompleteModal(false);
      setCompNotes('');
      await fetchDefectsAndUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to complete action');
    }
  };

  const handleCloseDefect = async (actionId) => {
    const notes = prompt('Enter resolution verification notes to close this defect:');
    if (!notes) return;
    try {
      await api.post(`/actions/${actionId}/close-defect`, null, {
        params: { resolution_notes: notes }
      });
      await fetchDefectsAndUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to close defect');
    }
  };

  const handleReopenDefect = async (defectId) => {
    const reason = prompt('State the justification for reopening this defect:');
    if (!reason) return;
    try {
      await api.post(`/defects/${defectId}/reopen`, null, {
        params: { reason }
      });
      await fetchDefectsAndUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reopen defect');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Defect Tracking & Corrective Actions
          </h1>
          <p className="text-xs text-slate-500">
            Assign repair owners, enforce due dates, record follow-up reinspection, and audit defect lifecycle
          </p>
        </div>
      </div>

      {/* Defect Cards List */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : defects.length > 0 ? (
        <div className="space-y-4">
          {defects.map((d) => (
            <div key={d.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">

              {/* Defect Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${
                    d.severity === 'critical' ? 'bg-red-100 text-red-700' :
                    d.severity === 'major' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 font-mono">DEF-{d.id}</span>
                      <span className="text-sm font-semibold text-slate-800 capitalize">
                        {d.defect_category.replace('_', ' ')}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                        d.severity === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
                        d.severity === 'major' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                        {d.severity}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        d.status === 'open' ? 'bg-red-100 text-red-800' :
                        d.status === 'in_progress' ? 'bg-amber-100 text-amber-800' :
                        d.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {d.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Item: <Link to={`/inspections/${d.inspection_id}`} className="font-mono text-indigo-600 hover:underline">{d.item_reference}</Link> |
                      Batch: <strong>{d.batch_code}</strong> |
                      Recorded: {new Date(d.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => { setSelectedDefect(d); setShowActionModal(true); }}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Assign Action</span>
                  </button>

                  {d.status === 'resolved' && (
                    <button
                      onClick={() => handleReopenDefect(d.id)}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold transition"
                      title="Reopen if defect persists after repair"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reopen</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Defect Description */}
              <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                {d.description}
              </p>

              {/* Linked Corrective Actions */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Assigned Corrective Actions ({d.corrective_actions?.length || 0})
                </span>

                {d.corrective_actions && d.corrective_actions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {d.corrective_actions.map((act) => (
                      <div key={act.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <strong className="text-slate-900">{act.title}</strong>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            act.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                            act.status === 'overdue' ? 'bg-red-100 text-red-800 font-extrabold' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {act.status}
                          </span>
                        </div>
                        <p className="text-slate-600">{act.description}</p>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                          <span>Owner: <strong className="text-slate-700">{act.assigned_to?.full_name}</strong></span>
                          <span>Due: <strong className="text-slate-700">{new Date(act.due_date).toLocaleDateString()}</strong></span>
                        </div>

                        {act.completion_notes && (
                          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 text-[11px]">
                            <strong>Repair Notes:</strong> {act.completion_notes}
                          </div>
                        )}

                        <div className="pt-2 flex justify-end gap-2">
                          {act.status !== 'completed' && (
                            <button
                              onClick={() => { setSelectedAction(act); setShowCompleteModal(true); }}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium transition"
                            >
                              Record Completion
                            </button>
                          )}
                          {act.status === 'completed' && d.status !== 'resolved' && (
                            <button
                              onClick={() => handleCloseDefect(act.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition"
                            >
                              Confirm Reinspection & Close
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No corrective actions assigned yet.</p>
                )}
              </div>

            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-16 text-center text-slate-400 text-xs">
          No confirmed defects recorded.
        </div>
      )}

      {/* MODAL: ASSIGN CORRECTIVE ACTION */}
      {showActionModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Assign Corrective Action for DEF-{selectedDefect?.id}
            </h2>

            <form onSubmit={handleCreateAction} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Action Title *</label>
                <input
                  type="text"
                  required
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  placeholder="e.g. Calibrate Roller Bed Tension"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Work Description & Scope *</label>
                <textarea
                  rows={3}
                  required
                  value={actionDesc}
                  onChange={(e) => setActionDesc(e.target.value)}
                  placeholder="Detail the required repair, tooling adjustments, or setting realignment..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Owner *</label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Due Date *</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowActionModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
                >
                  Create & Assign Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COMPLETE CORRECTIVE ACTION */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Record Repair Completion for Action #{selectedAction?.id}
            </h2>

            <form onSubmit={handleCompleteAction} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Repair Execution Notes *</label>
                <textarea
                  rows={4}
                  required
                  value={compNotes}
                  onChange={(e) => setCompNotes(e.target.value)}
                  placeholder="Describe the completed corrective actions, parts replaced, or process adjustments made..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold"
                >
                  Save Completion Notes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
