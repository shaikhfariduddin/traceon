import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Camera, Upload, AlertCircle, CheckCircle, Image as ImageIcon, Sparkles } from 'lucide-react';

export default function NewInspection() {
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState('');
  const [itemRef, setItemRef] = useState('');
  const [sampleType, setSampleType] = useState('individual_tile');
  const [location, setLocation] = useState('Kiln 2 Exit Station');
  const [notes, setNotes] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchBatches();
    // Default item reference
    setItemRef(`TILE-${Math.floor(1000 + Math.random() * 9000)}`);
  }, []);

  const fetchBatches = async () => {
    try {
      const res = await api.get('/batches');
      setBatches(res.data);
      if (res.data.length > 0) {
        setBatchId(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load batches', err);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setPreviews(newPreviews);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setSelectedFiles(files);
      const newPreviews = files.map((file) => URL.createObjectURL(file));
      setPreviews(newPreviews);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!batchId) {
      setError('Please select a batch.');
      return;
    }
    if (!itemRef.trim()) {
      setError('Please provide a unique tile item reference.');
      return;
    }
    if (selectedFiles.length === 0) {
      setError('Please upload at least one tile photograph for inspection.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Create Inspection record
      const inspRes = await api.post('/inspections', {
        batch_id: parseInt(batchId),
        item_reference: itemRef.trim(),
        sample_type: sampleType,
        location: location.trim(),
        notes: notes.trim()
      });
      const inspectionId = inspRes.data.id;

      // 2. Upload images
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      await api.post(`/inspections/${inspectionId}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      try {
        await api.post(`/inspections/${inspectionId}/analyze`);
      } catch (analyzeErr) {
        // Original evidence is already stored; continue to the review/recovery screen.
        console.error('Inference failed; inspection retained', analyzeErr);
      }

      navigate(`/inspections/${inspectionId}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit inspection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">New Tile Quality Inspection</h1>
              <p className="text-xs text-slate-400">
                Register sample tile, upload high-resolution photographs, and trigger AI defect analysis
              </p>
            </div>
          </div>
          <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800 px-2.5 py-1 rounded-full font-medium">
            Stage 1 & 2: Register & Upload
          </span>
        </div>

        {error && (
          <div className="m-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Batch Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Target Batch *
              </label>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                required
                className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    Batch {b.batch_code} ({b.product?.name || 'Product'}) â€” Status: {b.status}
                  </option>
                ))}
              </select>
            </div>

            {/* Distinct Item Reference */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Tile Item Reference *
              </label>
              <input
                type="text"
                value={itemRef}
                onChange={(e) => setItemRef(e.target.value)}
                placeholder="e.g. TILE-A1-04"
                required
                className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <span className="text-[11px] text-slate-400">Unique identifier for this physical tile sample</span>
            </div>

            {/* Sample Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Sample Scope / Type *
              </label>
              <select
                value={sampleType}
                onChange={(e) => setSampleType(e.target.value)}
                className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="individual_tile">Individual Tile (Close-up)</option>
                <option value="surface_sample">Tile Surface Texture Specimen</option>
                <option value="batch_sample">Wider Installation / Setting Sample</option>
              </select>
            </div>

            {/* Inspection Location */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Inspection Line / Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Kiln 2 Exit, Setting Bed 4"
                className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

          </div>

          {/* Inspector Notes / Observations */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Inspector Initial Observations
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Surface appears to have hairline fracture near top left corner during visual sweep."
              className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Drag & Drop File Upload Area */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Tile Photographs Upload *
            </label>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-6 text-center bg-slate-50 transition cursor-pointer"
              onClick={() => document.getElementById('file-upload-input').click()}
            >
              <input
                id="file-upload-input"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/bmp"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center">
                <Upload className="w-8 h-8 text-indigo-600 mb-2" />
                <p className="text-sm font-semibold text-slate-700">
                  Click to browse or drag and drop tile photographs
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports PNG, JPG, JPEG, WEBP (Max 20MB per image)
                </p>
              </div>
            </div>
          </div>

          {/* Previews */}
          {previews.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
                Selected Evidence ({previews.length} Image{previews.length > 1 ? 's' : ''})
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {previews.map((url, idx) => (
                  <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-200 aspect-square bg-slate-100 group">
                    <img src={url} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-medium">
                      {selectedFiles[idx]?.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Action */}
          <div className="flex justify-end pt-4 border-t border-slate-200">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm shadow transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Running AI Quality Analysis...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Submit & Run AI Analysis</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
