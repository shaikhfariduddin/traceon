import React, { useState } from 'react'
import { api } from '../api.js'
import { Badge, Empty, ErrorNote, Field, Loading, ScoreBar, SecureImage, fmtTime, pretty, useApp, useAsync } from '../ui.jsx'

function ReviewForm({ image, meta, onDone, resolve }) {
  const run = image.latest_run
  const [v, setV] = useState({ decision: '', defect_category: '', severity: '', description: '', reason: '' })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })
  const ai = run?.status === 'ok' ? run.predicted_label : null
  const differs = (ai === 'good' && v.decision === 'defect_confirmed') || (ai === 'defective' && v.decision === 'no_defect')
  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      await api.post(`/images/${image.id}/${resolve ? 'resolve' : 'reviews'}`, { ...v, model_run_id: run?.id })
      onDone()
    } catch (e) { setErr(e) } finally { setBusy(false) }
  }
  const choices = resolve ? ['no_defect', 'defect_confirmed'] : meta.decisions
  return (
    <div className="card" style={{ background: 'var(--glaze)' }}>
      <h3 style={{ marginTop: 0 }}>{resolve ? 'Resolve dispute (manager)' : 'Your decision'}</h3>
      <div className="choices" role="radiogroup">{choices.map((d) => (
        <button type="button" key={d} role="radio" aria-checked={v.decision === d} className={`choice ${v.decision === d ? 'on' : ''}`} onClick={() => setV({ ...v, decision: d })}>
          {{ no_defect: 'No defect', defect_confirmed: 'Defect confirmed', needs_more_evidence: 'Need more evidence' }[d]}</button>))}</div>
      {v.decision === 'defect_confirmed' && (
        <div className="row" style={{ marginTop: 10 }}>
          <Field label="Defect category (human-confirmed)"><select value={v.defect_category} onChange={set('defect_category')}><option value="">Choose...</option>{meta.defect_categories.map((c) => <option key={c} value={c}>{pretty(c)}</option>)}</select></Field>
          <Field label="Severity"><select value={v.severity} onChange={set('severity')}><option value="">Choose...</option>{meta.severities.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="What and where"><input value={v.description} onChange={set('description')} /></Field></div>)}
      <div style={{ marginTop: 10 }}><Field label={differs ? 'Reason (required - you disagree with the AI)' : 'Reason / explanation'} hint={!run || run.status !== 'ok' ? 'No AI result: please explain what you saw.' : ''}>
        <textarea value={v.reason} onChange={set('reason')} /></Field></div>
      <ErrorNote error={err} />
      <button className="btn" disabled={busy || !v.decision} onClick={submit}>{busy ? 'Saving...' : resolve ? 'Record resolution' : 'Save review'}</button>
    </div>
  )
}

function Detail({ id, onChange }) {
  const { user, meta, go } = useApp()
  const d = useAsync(() => api.get(`/images/${id}`), [id])
  const [err, setErr] = useState(null)
  if (d.loading && !d.data) return <Loading />
  if (d.error) return <ErrorNote error={d.error} onRetry={d.reload} />
  const x = d.data, run = x.latest_run
  const refresh = () => { d.reload(); onChange() }
  const canReview = user.role !== 'supervisor' && x.inspection_status === 'submitted' && !x.resolved
  return (
    <section className="card">
      <div className="row spread"><h2>Image #{x.id} - {x.batch_code} / {x.sample_ref}</h2><Badge value={x.review_state} /></div>
      <p className="muted">{pretty(x.image_kind)} - inspection #{x.inspection_id} - {fmtTime(x.inspected_at)} - {x.width}x{x.height}px</p>
      {x.low_quality ? <div className="note warn">Low image quality (blur score {x.blur_score?.toFixed(1)}). The machine result may be less reliable - consider requesting a clearer photo.</div> : null}
      <div className="imgs">
        <figure><SecureImage path={`/images/${x.id}/file`} alt="Original" /><figcaption>Original evidence (never modified)</figcaption></figure>
        {run?.heatmap_available && <figure><SecureImage path={`/images/${x.id}/file?run_id=${run.id}`} alt="Where the AI looked" /><figcaption>Where the model saw unusual appearance (red = near or above its threshold)</figcaption></figure>}
      </div>

      <h3>Machine suggestion (not a confirmed result)</h3>
      {!run && <Empty title="Not processed yet" />}
      {run?.status === 'failed' && (<div className="note bad">AI processing failed - this needs manual review. <small>{run.error}</small>
        {user.role !== 'supervisor' && <button className="btn sm ghost" onClick={async () => { setErr(null); try { await api.post(`/images/${x.id}/process`); refresh() } catch (e) { setErr(e) } }}>Retry AI</button>}</div>)}
      {run?.status === 'ok' && (<><div className="row"><Badge value={run.predicted_label} label={`AI suggests: ${run.predicted_label}`} /><small>{run.model_name} {run.model_version} - {run.processing_ms} ms - attempt {run.attempt_no}</small></div><ScoreBar run={run} /></>)}
      <ErrorNote error={err} />

      {x.defect && <p>Linked defect: <button className="link" onClick={() => go('defects', { defect_id: x.defect.id })}>#{x.defect.id} {pretty(x.defect.category)} ({x.defect.status})</button></p>}
      {canReview && x.review_state !== 'disputed' && <ReviewForm key={`r${x.id}${x.reviews.length}`} image={x} meta={meta} onDone={refresh} />}
      {canReview && x.review_state === 'disputed' && user.role === 'manager' && <ReviewForm key={`d${x.id}`} resolve image={x} meta={meta} onDone={refresh} />}
      {x.review_state === 'disputed' && user.role !== 'manager' && <div className="note warn">Reviewers disagree. A quality manager must resolve this.</div>}
      {x.inspection_status !== 'submitted' && <div className="note info">The inspection must be submitted before images can be reviewed.</div>}

      <h3>History</h3>
      <div className="tl">
        {x.reviews.map((r) => <div key={'r' + r.id}><strong>{r.reviewer_name}</strong> {r.kind === 'resolution' ? 'resolved: ' : 'decided: '}<Badge value={r.decision} /> {r.agrees_with_ai === 1 && <small>agrees with AI</small>}{r.agrees_with_ai === 0 && <small>differs from AI</small>}<small>{fmtTime(r.created_at)}{r.reason ? ` - "${r.reason}"` : ''}</small></div>)}
        {x.runs.map((r) => <div key={'m' + r.id}>AI attempt {r.attempt_no}: <Badge value={r.status === 'ok' ? r.predicted_label : 'failed'} /><small>{fmtTime(r.created_at)}{r.status === 'ok' ? ` - score ${r.score.toFixed(3)} / threshold ${r.threshold.toFixed(3)}` : ` - ${r.error}`}</small></div>)}
      </div>
    </section>
  )
}

export default function Review() {
  const { params } = useApp()
  const [f, setF] = useState({ review_state: params.review_state || '', batch_id: params.batch_id || '', product_id: params.product_id || '', defect_category: params.defect_category || '' })
  const [selected, setSelected] = useState(params.image_id || null)
  const q = useAsync(() => api.get('/reviews/queue', f), [JSON.stringify(f)])
  return (
    <div className="review-page">
      <h1>Review queue</h1>
      <p className="sub">Ordered by review priority: failed or low-quality results and scores close to the AI threshold come first, because that is where a human check matters most.</p>
      <div className="split">
        <section className="card">
          <Field label="State"><select value={f.review_state} onChange={(e) => setF({ ...f, review_state: e.target.value })}><option value="">Needs attention (default)</option>{['pending', 'needs_more_evidence', 'disputed', 'no_defect', 'defect_confirmed'].map((s) => <option key={s} value={s}>{pretty(s)}</option>)}</select></Field>
          {q.loading && !q.data ? <Loading /> : <ErrorNote error={q.error} onRetry={q.reload} />}
          {q.data && (q.data.length === 0 ? <Empty title="Nothing to review" hint="Submitted inspections with unreviewed images appear here." /> : (
            <ul className="list">{q.data.map((im) => (
              <li key={im.id}><button className={`item ${String(selected) === String(im.id) ? 'on' : ''}`} onClick={() => setSelected(im.id)}>
                <strong>{im.batch_code} / {im.sample_ref}</strong> <Badge value={im.review_state} />
                <small>Priority {im.priority} - {im.priority_reason}</small>
                <small>AI: {im.latest_run?.status === 'ok' ? im.latest_run.predicted_label : 'unavailable'}{im.is_follow_up ? ' - follow-up' : ''}</small></button></li>))}</ul>))}
        </section>
        {selected ? <Detail key={selected} id={selected} onChange={q.reload} /> : <Empty title="Select an image to review" />}
      </div>
    </div>
  )
}
