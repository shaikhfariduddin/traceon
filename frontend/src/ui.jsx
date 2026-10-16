import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api.js'

export const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function useAsync(fn, deps) {
  const [state, set] = useState({ data: null, error: null, loading: true })
  const run = useCallback(() => {
    set((s) => ({ ...s, loading: true, error: null }))
    return fn().then((data) => set({ data, error: null, loading: false }), (error) => set({ data: null, error, loading: false }))
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { run() }, [run])
  return { ...state, reload: run }
}

export const pretty = (s) => (s || '').replaceAll('_', ' ')
export const fmtDate = (s) => (s ? s.slice(0, 10) : '')
export const fmtTime = (s) => (s ? s.replace('T', ' ').slice(0, 16) : '')

const TONE = {
  defect_confirmed: 'bad', defective: 'bad', open: 'bad', reopened: 'bad', disputed: 'warn', uncertain: 'warn',
  needs_more_evidence: 'warn', pending: 'warn', awaiting_reinspection: 'warn', in_progress: 'info', failed: 'bad',
  no_defect: 'good', good: 'good', closed: 'good', done: 'good', release: 'good', hold: 'bad', ok: 'good',
  withdrawn: 'mute', cancelled: 'mute', archived: 'mute',
}
export const Badge = ({ value, label }) => <span className={`badge ${TONE[value] || 'mute'}`}>{label || pretty(value)}</span>

export const Loading = ({ text = 'Loading...' }) => <div className="state"><span className="spinner" />{text}</div>
export const Empty = ({ title, hint }) => <div className="state empty"><strong>{title}</strong>{hint && <span>{hint}</span>}</div>
export const ErrorNote = ({ error, onRetry }) => error ? (
  <div className="note bad" role="alert">{error.message}{onRetry && <button className="link" onClick={onRetry}>Retry</button>}</div>) : null

export function Field({ label, children, hint }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

export function SecureImage({ path, alt, className = '' }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true, made = null
    setUrl(null); setFailed(false)
    api.blobUrl(path).then((u) => { made = u; live ? setUrl(u) : URL.revokeObjectURL(u) }, () => live && setFailed(true))
    return () => { live = false; if (made) URL.revokeObjectURL(made) }
  }, [path])
  if (failed) return <div className={`img-ph ${className}`}>Image unavailable</div>
  if (!url) return <div className={`img-ph ${className}`}><span className="spinner" /></div>
  return <img className={className} src={url} alt={alt} />
}

// A button that asks for the reason first: important changes are recorded with who/when/why.
export function ReasonButton({ label, onConfirm, danger, placeholder = 'Reason (recorded in history)' }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  if (!open) return <button className={`btn ${danger ? 'danger' : 'ghost'}`} onClick={() => setOpen(true)}>{label}</button>
  const go = async () => {
    setBusy(true); setErr(null)
    try { await onConfirm(reason); setOpen(false); setReason('') } catch (e) { setErr(e) } finally { setBusy(false) }
  }
  return (
    <span className="reason-box">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} autoFocus />
      <button className="btn primary" disabled={busy || !reason.trim()} onClick={go}>{busy ? '...' : 'Confirm'}</button>
      <button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
      <ErrorNote error={err} />
    </span>
  )
}

// Score vs threshold. The score is a distance, NOT a probability - the bar says so.
export function ScoreBar({ run }) {
  if (!run || run.status !== 'ok') return null
  const max = run.threshold * 2
  const pos = Math.min(100, (run.score / max) * 100)
  const lo = (run.threshold * 0.9 / max) * 100, hi = (run.threshold * 1.1 / max) * 100
  return (
    <div className="scorebar" title="Anomaly score relative to the calibrated threshold">
      <div className="track">
        <div className="band" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
        <div className="tick" style={{ left: '50%' }} />
        <div className="marker" style={{ left: `${pos}%` }} />
      </div>
      <div className="scale"><span>0</span><span>threshold {run.threshold.toFixed(2)}</span><span>{max.toFixed(2)}+</span></div>
      <small>Score {run.score.toFixed(3)} - a distance from normal tiles, not a probability. Shaded = uncertain zone.</small>
    </div>
  )
}
