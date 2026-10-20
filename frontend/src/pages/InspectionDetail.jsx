import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, RefreshCw, Eye,
  ShieldCheck, Wrench, FileText, ArrowLeft, HelpCircle, CheckSquare
} from 'lucide-react';

export default function InspectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Review form state
  const [decision, setDecision] = useState('confirmed_defect');
  const [defectCategory, setDefectCategory] = useState('crack');
  const [severity, setSeverity] = useState('major');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Dispute resolution state
  const [managerNotes, setManagerNotes] = useState('');
  const [managerDecision, setManagerDecision] = useState('confirmed_defect');

  useEffect(() => {
    fetchInspection();
  }, [id]);

  const fetchInspection = async () => {
    try {
      const res = await api.get(`/inspections/${id}`);
      setInspection(res.data);
      if (res.data.latest_model_result?.defect_type && res.data.latest_model_result.defect_type !== 'none') {
        setDefectCategory(res.data.latest_model_result.defect_type);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load inspection record.');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await api.post(`/inspections/${id}/review`, {
        review_decision: decision,
        confirmed_category: decision.includes('defect') ? defectCategory : null,
        severity: decision.includes('defect') ? severity : 'minor',
        notes: reviewNotes,
        description: reviewNotes || `Confirmed ${defectCategory} observation`
      });
      await fetchInspection();
      setReviewNotes('');
    } catch (err) {
      alert(err.response?.data?.detail || 'Review submission failed');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleResolveDispute = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await api.post(`/inspections/${id}/resolve-dispute`, {
        review_decision: managerDecision,
        confirmed_category: managerDecision.includes('defect') ? defectCategory : null,
        severity: severity,
        notes: managerNotes
      });
      await fetchInspection();
      setManagerNotes('');
    } catch (err) {
      alert(err.response?.data?.detail || 'Dispute resolution failed');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleRetryInference = async () => {
    try {
      await api.post(`/inspections/${id}/analyze`);
      await fetchInspection();
    } catch (err) {
      alert(err.response?.data?.detail || 'Inference retry failed. Original evidence is retained.');
    }
  };

  const handleReinspect = async () => {
    try {
      const res = await api.post(`/inspections/${id}/reinspect`);
      navigate(`/inspections/${res.data.id}`);
    } catch (err) {
      alert(err.response?.data?.detail || 'Reinspection creation failed.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !inspection) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error || 'Inspection record not found.'}
        </div>
        <Link to="/inspections" className="mt-4 inline-block text-indigo-600 font-semibold text-sm">
          &larr; Back to Inspections
        </Link>
      </div>
    );
  }

  const latestResult = inspection.latest_model_result;
  const isDisputed = inspection.reviews?.some((r) => r.review_decision === 'disputed');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Top Breadcrumb & Metadata */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-200 gap-4">
        <div className="flex items-center space-x-3">
          <Link to="/inspections" className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 font-mono">
                {inspection.item_reference}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${
                inspection.status.includes('defect') ? 'bg-red-100 text-red-800 border-red-300' :
                inspection.status === 'confirmed_good' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                inspection.status === 'closed' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {inspection.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Batch: <span className="font-semibold text-slate-700">{inspection.batch_code}</span> |
              Product: <span className="font-semibold text-slate-700">{inspection.product_name}</span> |
              Inspector: <span className="font-semibold text-slate-700">{inspection.inspector?.full_name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleRetryInference}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-run AI Inference</span>
          </button>
          <button
            onClick={handleReinspect}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 transition"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Create Follow-up Inspection</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left = Visual Evidence, Right = AI Output & Human Review */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* LEFT COLUMN: Original Uploaded Photographic Evidence & OpenCV Quality Checks */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Original Photographic Evidence</span>
              <span className="text-xs font-normal text-slate-500">
                {inspection.images?.length || 0} image(s) on file
              </span>
            </h2>

            {inspection.images && inspection.images.length > 0 ? (
              <div className="space-y-4">
                {inspection.images.map((img) => (
                  <div key={img.id} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-900">
                    <img
                      src={img.file_path}
                      alt={img.original_filename}
                      className="w-full h-80 object-contain bg-slate-950"
                    />

                    {/* OpenCV Quality Verification Bar */}
                    <div className="p-3 bg-slate-800 text-slate-300 text-xs flex flex-wrap items-center justify-between gap-2 border-t border-slate-700">
                      <div className="flex items-center space-x-4">
                        <span>Resolution: <strong className="text-white">{img.width}x{img.height}</strong></span>
                        <span>
                          Blur Score: <strong className={img.blur_score < 30 ? 'text-amber-400' : 'text-emerald-400'}>
                            {img.blur_score ?? 'N/A'}
                          </strong>
                        </span>
                        <span>
                          Luminance: <strong className="text-white">{img.brightness_score ?? 'N/A'}</strong>
                        </span>
                      </div>
                      <div>
                        {img.is_uncertain ? (
                          <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-semibold text-[10px]">
                            âš ï¸ Quality Alert: Low Sharpness / Lighting
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold text-[10px]">
                            âœ“ Quality Validated
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 text-sm">
                No photographs uploaded.
              </div>
            )}

            {/* Inspector Observations & Metadata */}
            <div className="mt-4 pt-4 border-t border-slate-100 text-xs space-y-1.5">
              <div><strong className="text-slate-600">Sample Scope:</strong> <span className="capitalize">{inspection.sample_type?.replace('_', ' ')}</span></div>
              <div><strong className="text-slate-600">Inspection Location:</strong> {inspection.location || 'Not specified'}</div>
              <div><strong className="text-slate-600">Initial Observations:</strong> {inspection.notes || 'None recorded'}</div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: AI Suggestion & Human-in-the-Loop Review */}
        <div className="space-y-6">

          {/* AI Suggestion Card */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="text-lg">ðŸ¤–</span>
                <h2 className="text-sm font-bold text-slate-900">PyTorch ML Inspection Suggestion</h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                Model: {latestResult?.model_name || 'TileDefectClassifier'} ({latestResult?.model_version || 'v1.0.0'})
              </span>
            </div>

            {(inspection.status === 'ai_failed' || latestResult?.status === 'failed') && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs">
                Inference failed. Original photographs are retained. Use Re-run AI Inference or submit a manual review.
                {latestResult?.error_message ? ` Detail: ${latestResult.error_message}` : ''}
              </div>
            )}
            {latestResult ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div>
                    <div className="text-xs text-slate-500 uppercase font-semibold">Predicted Class</div>
                    <div className={`text-xl font-bold uppercase ${latestResult.predicted_class === 'defective' ? 'text-red-600' : 'text-emerald-600'}`}>
                      {latestResult.predicted_class}
                    </div>
                  </div>

                  {latestResult.defect_type && latestResult.defect_type !== 'none' && (
                    <div>
                      <div className="text-xs text-slate-500 uppercase font-semibold">Defect Subtype</div>
                      <div className="text-base font-bold text-indigo-700 capitalize">
                        {latestResult.defect_type.replace('_', ' ')}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs text-slate-500 uppercase font-semibold">Confidence Score</div>
                    <div className="text-xl font-bold text-slate-800">
                      {(latestResult.confidence_score * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>Inference Latency: <strong>{latestResult.processing_time_ms} ms</strong></span>
                  <span>Inference Status: <strong className="capitalize">{latestResult.status}</strong></span>
                </div>

                {/* Mandatory Regulatory Warning */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Human Review Required:</strong> This machine learning output is an automated decision aid.
                    Tile acceptance, rejection, and corrective actions must be confirmed by an authorized human inspector.
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                Inference pending. Click "Re-run AI Inference" to evaluate.
              </div>
            )}
          </div>

          {/* Human Review Panel */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center space-x-2">
              <CheckSquare className="w-4 h-4 text-indigo-600" />
              <span>Inspector Human Decision Record</span>
            </h2>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Review Decision *
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setDecision('confirmed_defect')}
                    className={`py-2 px-3 rounded-lg border font-semibold text-left transition ${
                      decision === 'confirmed_defect'
                        ? 'bg-red-50 border-red-500 text-red-700 ring-1 ring-red-500'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Confirm Defect
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('confirmed_good')}
                    className={`py-2 px-3 rounded-lg border font-semibold text-left transition ${
                      decision === 'confirmed_good'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Confirm Good / Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('corrected_defect')}
                    className={`py-2 px-3 rounded-lg border font-semibold text-left transition ${
                      decision === 'corrected_defect'
                        ? 'bg-amber-50 border-amber-500 text-amber-700 ring-1 ring-amber-500'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Correct AI Suggestion
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('disputed')}
                    className={`py-2 px-3 rounded-lg border font-semibold text-left transition ${
                      decision === 'disputed'
                        ? 'bg-purple-50 border-purple-500 text-purple-700 ring-1 ring-purple-500'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Dispute / Escalate to QA Manager
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('more_evidence_needed')}
                    className={`py-2 px-3 rounded-lg border font-semibold text-left transition ${
                      decision === 'more_evidence_needed'
                        ? 'bg-slate-100 border-slate-500 text-slate-800 ring-1 ring-slate-500'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Request Additional Evidence
                  </button>
                </div>
              </div>

              {/* Supported Defect Category Selection (ML Classes + Manual Checklist) */}
              {decision.includes('defect') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Observed Category *
                    </label>
                    <select
                      value={defectCategory}
                      onChange={(e) => setDefectCategory(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-indigo-500"
                    >
                      <optgroup label="Supported ML Dataset Classes">
                        <option value="crack">Crack / Fracture</option>
                        <option value="glue_strip">Glue Strip / Adhesive Residue</option>
                        <option value="gray_stroke">Gray Stroke / Glaze Blemish</option>
                        <option value="oil">Oil Spot / Contamination</option>
                        <option value="rough">Rough Surface / Texture Flaw</option>
                      </optgroup>
                      <optgroup label="Manual Visual & Installation Checklist">
                        <option value="uneven_alignment">Uneven Tile Alignment</option>
                        <option value="inconsistent_grout">Inconsistent Grout Spacing</option>
                        <option value="chipped_corner">Chipped Corner / Broken Edge</option>
                        <option value="surface_scratch">Surface Scratch</option>
                        <option value="stain">Persistent Stain / Discoloration</option>
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Severity *
                    </label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="minor">Minor (Cosmetic)</option>
                      <option value="major">Major (Performance Impact)</option>
                      <option value="critical">Critical (Batch Rejection)</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Inspector Review Notes & Explanation *
                </label>
                <textarea
                  rows={2}
                  required
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Record justification for confirming or overriding AI prediction..."
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={submittingReview}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs shadow transition disabled:opacity-50"
              >
                {submittingReview ? 'Recording Decision...' : 'Submit Human Review'}
              </button>
            </form>
          </div>

          {/* MANAGER DISPUTE RESOLUTION PANEL (Visible if disputed or user is Manager) */}
          {(isDisputed || hasRole('manager')) && (
            <div className="bg-purple-50 p-5 rounded-xl border border-purple-200">
              <div className="flex items-center space-x-2 text-purple-900 font-bold text-sm mb-2">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                <span>Quality Manager Dispute Resolution</span>
              </div>
              <p className="text-xs text-purple-700 mb-3">
                Manager-level authority to resolve conflicting inspection reviews and issue final disposition.
              </p>

              <form onSubmit={handleResolveDispute} className="space-y-3">
                <div className="flex gap-2 text-xs">
                  <select
                    value={managerDecision}
                    onChange={(e) => setManagerDecision(e.target.value)}
                    className="flex-1 bg-white border border-purple-300 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  >
                    <option value="confirmed_defect">Manager Confirm Defect</option>
                    <option value="confirmed_good">Manager Overrule & Confirm Good</option>
                  </select>

                  <select
                    value={defectCategory}
                    onChange={(e) => setDefectCategory(e.target.value)}
                    className="flex-1 bg-white border border-purple-300 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  >
                    <option value="crack">Crack / Fracture</option>
                    <option value="glue_strip">Glue Strip</option>
                    <option value="gray_stroke">Gray Stroke</option>
                    <option value="oil">Oil Spot</option>
                    <option value="rough">Rough Surface</option>
                    <option value="uneven_alignment">Uneven Alignment</option>
                  </select>
                </div>

                <textarea
                  rows={2}
                  required
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  placeholder="Managerial justification for resolving dispute..."
                  className="w-full text-xs bg-white border border-purple-300 rounded-lg px-3 py-2"
                />

                <button
                  type="submit"
                  disabled={submittingReview}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg text-xs transition disabled:opacity-50"
                >
                  Resolve Dispute (Manager Official Record)
                </button>
              </form>
            </div>
          )}

          {inspection.defects && inspection.defects.length > 0 && (
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Linked Defects</h2>
              <div className="space-y-2">
                {inspection.defects.map((d) => (
                  <Link key={d.id} to="/defects" className="block p-2.5 bg-red-50 border border-red-100 rounded-lg text-xs">
                    <span className="font-mono font-bold text-red-700">DEF-{d.id}</span>
                    <span className="ml-2 capitalize">{d.defect_category.replace('_', ' ')}</span>
                    <span className="ml-2 uppercase text-[10px] font-bold">{d.status}</span>
                    <p className="text-slate-600 mt-1">{d.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Review History Trail (Never Overwritten!) */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Decision & Review History (Audit Trail)
            </h2>
            <div className="space-y-2 text-xs">
              {inspection.reviews && inspection.reviews.length > 0 ? (
                inspection.reviews.map((r) => (
                  <div key={r.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{r.reviewer?.full_name} ({r.reviewer?.role})</span>
                      <span className="text-[10px] text-slate-400">{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 font-semibold text-indigo-600 capitalize">
                      Decision: {r.review_decision.replace('_', ' ')}
                      {r.confirmed_category && ` (${r.confirmed_category})`}
                    </div>
                    {r.notes && <p className="text-slate-600 mt-0.5">{r.notes}</p>}
                  </div>
                ))
              ) : (
                <p className="text-slate-400">No human reviews recorded yet.</p>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
