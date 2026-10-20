import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles, Send, ShieldCheck, Database, FileText, CheckCircle2,
  ExternalLink, AlertCircle, Bookmark
} from 'lucide-react';

export default function QualityIntelligence() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState('qa'); // 'qa' or 'report'
  const [error, setError] = useState('');
  const [batches, setBatches] = useState([]);
  const [reportBatchId, setReportBatchId] = useState('');

  useEffect(() => {
    api.get('/batches').then((res) => {
      setBatches(res.data);
      if (res.data.length) {
        const preferred = res.data.find((b) => b.batch_code === 'B-104') || res.data[0];
        setReportBatchId(String(preferred.id));
      }
    }).catch(() => {});
  }, []);

  const sampleQuestions = [
    'Summarise batch B-104.',
    'Have we seen this defect before?',
    'What needs attention today?',
    'Which corrective actions are overdue?',
    'Summarise batch B-101.'
  ];

  const handleAsk = async (qText) => {
    const q = qText || query;
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    setResponse(null);
    try {
      const res = await api.post('/ai/ask', { query: q });
      setResponse(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate grounded response.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = reportBatchId ? { batch_id: parseInt(reportBatchId, 10) } : {};
      const res = await api.post('/ai/reports', payload);
      setReport(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to compile quality report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-gradient-to-tr from-indigo-600 to-violet-600 text-white rounded-lg shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  GenAI Quality Intelligence & RAG
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Google Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Strictly grounded in authorised PostgreSQL inspection and defect records with traceable citations
              </p>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-100 p-1 rounded-lg self-start sm:self-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('qa')}
            className={`px-3 py-1.5 rounded-md transition ${activeTab === 'qa' ? 'bg-white shadow text-indigo-600' : 'text-slate-600'}`}
          >
            Evidence-Backed Q&A
          </button>
          <button
            onClick={() => { setActiveTab('report'); if (!report) handleGenerateReport(); }}
            className={`px-3 py-1.5 rounded-md transition ${activeTab === 'report' ? 'bg-white shadow text-indigo-600' : 'text-slate-600'}`}
          >
            Batch Audit Report
          </button>
        </div>
      </div>

      {activeTab === 'qa' ? (
        <div className="space-y-6">

          {/* Query Box Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">

            {/* Sample Question Chips */}
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Suggested Quality Questions (Click to Ask):
              </span>
              <div className="flex flex-wrap gap-2">
                {sampleQuestions.map((sq, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setQuery(sq); handleAsk(sq); }}
                    className="text-xs bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition font-medium text-left"
                  >
                    "{sq}"
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={(e) => { e.preventDefault(); handleAsk(); }} className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about batch coverage, overdue repairs, defect history, or current alerts..."
                className="flex-1 text-sm bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs shadow flex items-center space-x-1.5 transition disabled:opacity-50"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Ask RAG</span>
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Response Display */}
          {response && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden space-y-4 p-6">

              {/* Header Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-md">
                    <Database className="w-4 h-4" />
                  </span>
                  <span className="font-bold text-slate-900">Grounded Intelligence Result</span>
                </div>

                <div className="flex items-center space-x-2 text-[11px]">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Role Verified: {response.grounding_stats?.role || user?.role}</span>
                  </span>
                  <span className="text-slate-400">
                    {response.provider}
                  </span>
                </div>
              </div>

              {/* Answer Content */}
              <div className="prose prose-sm max-w-none text-slate-800 text-xs sm:text-sm whitespace-pre-line leading-relaxed">
                {response.answer}
              </div>

              {/* Grounded Database Citations Section */}
              {response.citations && response.citations.length > 0 && (
                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block flex items-center space-x-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Verified Database Source Citations ({response.citations.length}):</span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {response.citations.map((c, idx) => (
                      <Link
                        key={idx}
                        to={c.url_path}
                        className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 transition flex items-center justify-between group"
                      >
                        <div className="truncate">
                          <span className="font-mono font-bold text-indigo-600 text-xs mr-1.5">
                            [{c.identifier}]
                          </span>
                          <span className="text-xs text-slate-700 font-medium">
                            {c.label}
                          </span>
                        </div>
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 flex-shrink-0 ml-2" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <p className="text-[11px] text-slate-400 italic pt-2">
                * {response.disclaimer}
              </p>

            </div>
          )}

        </div>
      ) : (
        /* Report View */
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Report batch</label>
              <select
                value={reportBatchId}
                onChange={(e) => setReportBatchId(e.target.value)}
                className="w-full text-xs border rounded-lg px-3 py-2"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.batch_code} â€” {b.product?.name || 'product'}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleGenerateReport}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
            >
              Generate cited report
            </button>
          </div>
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">{error}</div>}
          {report ? (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Formal Audit Document</span>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">{report.title}</h2>
                <div className="text-xs text-slate-400 mt-1">Generated: {report.generated_at} by {report.key_metrics?.report_generated_by} ({report.key_metrics?.role})</div>
              </div>

              <p className="text-sm text-slate-700">{report.summary_text}</p>

              <div className="grid grid-cols-3 gap-4 text-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase">Batch Status</div>
                  <div className="text-lg font-bold text-slate-900 capitalize mt-1">{report.key_metrics.batch_status}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase">Inspected Tiles</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">{report.key_metrics.inspected_items}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase">Confirmed Defects</div>
                  <div className="text-lg font-bold text-red-600 mt-1">{report.key_metrics.confirmed_defects}</div>
                </div>
              </div>

              <div className="space-y-4">
                {report.sections.map((sec, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <h3 className="text-sm font-bold text-slate-900 mb-1">{sec.heading}</h3>
                    <p className="text-xs text-slate-600">{sec.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">Loading audit report...</div>
          )}
        </div>
      )}

    </div>
  );
}
