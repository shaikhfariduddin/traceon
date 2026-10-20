import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import {
  ListOrdered, ShieldAlert, AlertTriangle, Clock, Eye, Sparkles,
  BarChart2, CheckCircle2, ChevronRight, Info
} from 'lucide-react';

export default function PriorityQueue() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulationResult, setSimulationResult] = useState(null);
  const [showSimModal, setShowSimModal] = useState(false);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    fetchPriorityQueue();
  }, []);

  const fetchPriorityQueue = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/priority-queue');
      setQueue(res.data);
    } catch (err) {
      console.error('Failed to load priority queue', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunSimulation = async () => {
    setSimLoading(true);
    setShowSimModal(true);
    try {
      const res = await api.get('/dashboard/priority-evaluation');
      setSimulationResult(res.data);
    } catch (err) {
      console.error('Simulation failed', err);
    } finally {
      setSimLoading(false);
    }
  };

  const getPriorityBadge = (level) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-300 font-extrabold';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-300 font-bold';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 border-amber-300 font-semibold';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Evidence-Based Inspection Priority Queue
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
              Buildathon Innovation
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Dynamic prioritization engine ordering pending cases by relational defect evidence, overdue risk, and image quality
          </p>
        </div>

        <button
          onClick={handleRunSimulation}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow transition self-start md:self-auto"
        >
          <BarChart2 className="w-4 h-4" />
          <span>Run FIFO vs Priority Evaluation</span>
        </button>
      </div>

      {/* Innovation Explanation Banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-5 rounded-xl text-white shadow-md flex items-start space-x-4 border border-indigo-700">
        <Sparkles className="w-6 h-6 text-indigo-400 flex-shrink-0 mt-1" />
        <div className="text-xs space-y-1">
          <h3 className="font-bold text-sm text-white">Why Evidence-Based Prioritisation?</h3>
          <p className="text-slate-300">
            Standard factory queues process inspections in chronological order (FIFO), allowing critical overdue repairs or persistent defect clusters to wait in line.
            Our algorithm scores each inspection based on <strong>6 transparent factors</strong>: Overdue Actions (+100), Reopened Defects (+80), Manager Disputes (+70), Recurring Batch Defects (+40), Pending Review (+30), and Image Quality Alerts (+25).
          </p>
        </div>
      </div>

      {/* Prioritized Queue List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : queue.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Rank / Score</th>
                  <th className="py-3 px-4">Priority Level</th>
                  <th className="py-3 px-4">Tile Reference</th>
                  <th className="py-3 px-4">Batch</th>
                  <th className="py-3 px-4">Explainable Priority Reasons</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {queue.map((item, idx) => (
                  <tr key={item.inspection_id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold font-mono text-slate-400">#{idx + 1}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-bold font-mono text-slate-800 border">
                          {item.priority_score} pts
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase border ${getPriorityBadge(item.priority_level)}`}>
                        {item.priority_level}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {item.item_reference}
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-600">
                      {item.batch_code}
                    </td>

                    <td className="py-3 px-4 max-w-md">
                      <div className="flex flex-wrap gap-1.5">
                        {item.priority_reasons.map((r, rIdx) => (
                          <span key={rIdx} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                            â€¢ {r}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="capitalize text-slate-600 font-medium">
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link
                        to={`/inspections/${item.inspection_id}`}
                        className="inline-flex items-center space-x-1 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-semibold border border-indigo-200 transition"
                      >
                        <span>Review</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400 text-xs">
            Queue is currently empty. No active inspections awaiting review.
          </div>
        )}
      </div>

      {/* SIMULATION & EVALUATION MODAL */}
      {showSimModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <BarChart2 className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Innovation Evaluation: FIFO vs Evidence-Based Priority Queue
                </h2>
              </div>
              <button
                onClick={() => setShowSimModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                âœ•
              </button>
            </div>

            {simLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="text-xs text-slate-500">Executing comparative queue dispatch simulation...</span>
              </div>
            ) : simulationResult ? (
              <div className="space-y-4 text-xs text-slate-700">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">Standard FIFO Queue</span>
                    <div className="text-2xl font-bold text-slate-800 mt-1">
                      Rank #{simulationResult.average_rank_fifo || 'â€”'}
                    </div>
                    <span className="text-[10px] text-slate-400">Average critical case position</span>
                  </div>

                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 text-center">
                    <span className="text-[11px] font-semibold text-indigo-600 uppercase">Evidence-Based Queue</span>
                    <div className="text-2xl font-bold text-indigo-700 mt-1">
                      Rank #{simulationResult.average_rank_priority_queue || 'â€”'}
                    </div>
                    <span className="text-[10px] text-indigo-500">Average critical case position</span>
                  </div>
                </div>

                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex items-center space-x-3 text-emerald-900">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                  <div>
                    <strong className="text-sm">Measured Detection Speedup: {simulationResult.detection_speedup_improvement_pct}%</strong>
                    <p className="text-[11px] text-emerald-800 mt-0.5">{simulationResult.conclusion}</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] space-y-1">
                  <div><strong>Methodology:</strong> {simulationResult.methodology}</div>
                  <div><strong>Evaluated Sample Set:</strong> {simulationResult.sample_size} registered inspection cases</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">Simulation unavailable.</div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowSimModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
