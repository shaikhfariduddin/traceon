import React, { useRef, useState } from 'react'
import { api } from '../api.js'
import { Badge, Empty, ErrorNote, Field, Loading, ReasonButton, SecureImage, fmtTime, pretty, useApp, useAsync } from '../ui.jsx'

function Uploader({ inspection, meta, onDone }) {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const pick = (e) => setRows([...rows, ...[...e.target.files].map((file) => ({ file, ref: file.name.replace(/\.[^.]+$/, ''), kind: 'item', status: 'ready' }))])
  const patch = (i, p) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const run = async () => {
    setBusy(true)
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].status === 'done' || rows[i].status === 'uploading') continue
      patch(i, { status: 'uploading', error: null })
      const form = new FormData()
      form.append('file', rows[i].file); form.append('sample_ref', rows[i].ref); form.append('image_kind', rows[i].kind)
      try { const res = await api.upload(`/inspections/${inspection.id}/images`, form); patch(i, { status: 'done', result: res }) }
      catch (e) { patch(i, { status: 'failed', error: e.message }) }       // failed files stay in the list; nothing already saved is lost
    }
    setBusy(false); onDone()
  }
  const todo = rows.filter((r) => r.status !== 'done').length
  return (
    <div className="card" style={{ background: 'var(--glaze)' }}>
      <h3 style={{ marginTop: 0 }}>Add evidence</h3>
      <input type="file" accept="image/jpeg,image/png,image/bmp" multiple onChange={pick} aria-label="Choose images" />
      <small>JPEG, PNG or BMP, up to {meta?.max_upload_mb} MB each. Say what each image shows: one tile (item), a surface close-up, or a batch sample. Count items, not photos: use the same item reference for several photos of one tile.</small>
      {rows.length > 0 && (
        <table style={{ marginTop: 10 }}><thead><tr><th>File</th><th>Item / sample ref</th><th>Shows</th><th>Status</th></tr></thead><tbody>
          {rows.map((r, i) => (
            <tr key={i}><td>{r.file.name}</td>
              <td><input value={r.ref} disabled={r.status === 'done'} onChange={(e) => patch(i, { ref: e.target.value })} /></td>
              <td><select value={r.kind} disabled={r.status === 'done'} onChange={(e) => patch(i, { kind: e.target.value })}>{(meta?.image_kinds || []).map((k) => <option key={k} value={k}>{pretty(k)}</option>)}</select></td>
              <td>{r.status === 'ready' && 'Ready'}{r.status === 'uploading' && 'Uploading + analysing...'}
                {r.status === 'done' && <Badge value="done" label={r.result.latest_run?.status === 'ok' ? `Saved - AI: ${r.result.latest_run.predicted_label}` : 'Saved - AI unavailable, manual review'} />}
                {r.status === 'failed' && <span style={{ color: 'var(--bad)' }}>{r.error} <button className="link" onClick={() => patch(i, { status: 'ready' })}>retry</button> <button className="link" onClick={() => setRows(rows.filter((_, j) => j !== i))}>remove</button></span>}</td></tr>))}</tbody></table>)}
      {todo > 0 && <div style={{ marginTop: 10 }}><button className="btn" disabled={busy || rows.some((r) => !r.ref.trim())} onClick={run}>{busy ? 'Uploading...' : `Upload ${todo} image(s)`}</button></div>}
    </div>
  )
}

function Detail({ id, onChange }) {
  const { user, meta, go } = useApp()
  const d = useAsync(() => api.get(`/inspections/${id}`), [id])
  const [notes, setNotes] = useState(null)
  const [err, setErr] = useState(null)
  if (d.loading && !d.data) return <Loading />
  if (d.error) return <ErrorNote error={d.error} onRetry={d.reload} />
  const x = d.data
  const refresh = () => { d.reload(); onChange() }
  const mine = x.inspector_id === user.id || user.role === 'manager'
  const act = async (fn) => { setErr(null); try { await fn(); refresh() } catch (e) { setErr(e) } }
  const canUpload = x.status !== 'archived' && (user.role !== 'supervisor' || (x.follow_up_of_defect_id && x.inspector_id === user.id))
  return (
    <section className="card">
      <div className="row spread"><h2>Inspection #{x.id} - batch {x.batch_code}</h2><Badge value={x.status === 'submitted' ? 'done' : x.status} label={x.status} /></div>
      <p className="muted">{x.product_code} - inspector {x.inspector_name} - {fmtTime(x.inspected_at)} - {x.item_count} item(s), {x.image_count} image(s){x.follow_up_of_defect_id ? ` - follow-up for defect #${x.follow_up_of_defect_id}` : ''}</p>
      <ErrorNote error={err} />
      {x.status !== 'archived' && mine && (
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Field label="Observations"><textarea value={notes ?? x.notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          {x.status === 'draft' ? <button className="btn ghost" disabled={notes == null} onClick={() => act(async () => { await api.patch(`/inspections/${id}`, { notes }); setNotes(null) })}>Save notes</button>
            : <ReasonButton label="Correct notes" onConfirm={async (reason) => { await api.patch(`/inspections/${id}`, { notes: notes ?? x.notes, reason }); setNotes(null); refresh() }} />}
        </div>)}
      {x.revisions.length > 1 && <small>{x.revisions.length - 1} correction(s) - the original text is kept: "{x.revisions[x.revisions.length - 1].notes}"</small>}

      {canUpload && <Uploader inspection={x} meta={meta} onDone={refresh} />}
      <h3>Images</h3>
      {x.images.length === 0 ? <Empty title="No images yet" hint="Upload at least one image before submitting." /> : (
        <div className="imgs">{x.images.map((im) => (
          <figure key={im.id}>
            <SecureImage path={`/images/${im.id}/file`} alt={`Item ${im.sample_ref}`} />
            <figcaption><strong>{im.sample_ref}</strong> - {pretty(im.image_kind)} <br />
              {im.latest_run?.status === 'ok' ? <Badge value={im.latest_run.predicted_label} label={`AI: ${im.latest_run.predicted_label}`} /> : <Badge value="failed" label="AI unavailable" />}{' '}
              <Badge value={im.review_state} />{im.low_quality ? <> <Badge value="warn" label="low quality" /></> : null}<br />
              {x.status === 'submitted' && <button className="link" style={{ padding: 0 }} onClick={() => go('review', { image_id: im.id })}>Review</button>}
              {im.latest_run?.status === 'failed' && user.role !== 'supervisor' && <button className="link" onClick={() => act(() => api.post(`/images/${im.id}/process`))}>Retry AI</button>}</figcaption></figure>))}</div>)}

      <div className="row" style={{ marginTop: 14 }}>
        {x.status === 'draft' && mine && <button className="btn" onClick={() => act(() => api.post(`/inspections/${id}/submit`))} disabled={x.images.length === 0}>Submit inspection for review</button>}
        {x.status === 'draft' && mine && x.images.length === 0 && <button className="btn danger" onClick={() => act(async () => { await api.del(`/inspections/${id}`); onChange(true) })}>Delete empty draft</button>}
        {x.status !== 'archived' && mine && x.images.length > 0 && <ReasonButton danger label="Archive" onConfirm={async (reason) => { await api.post(`/inspections/${id}/archive`, { reason }); refresh() }} />}
      </div>
    </section>
  )
}

export default function Inspect() {
  const { user, params } = useApp()
  const [selected, setSelected] = useState(params.inspection_id || null)
  const [form, setForm] = useState({ batch_id: params.batch_id || '', notes: '' })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const idem = useRef(crypto.randomUUID())          // the same key is re-sent on a double click or retry -> no duplicate record
  const follow = params.follow_up_of_defect_id
  const list = useAsync(() => api.get('/inspections', { batch_id: params.batch_id && !params.new ? params.batch_id : '' }), [])
  const batches = useAsync(() => (user.role === 'supervisor' ? Promise.resolve([]) : api.get('/batches')), [])

  const create = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null)
    try {
      const res = await api.post('/inspections', { batch_id: Number(form.batch_id), notes: form.notes, follow_up_of_defect_id: follow ? Number(follow) : undefined }, { 'Idempotency-Key': idem.current })
      idem.current = crypto.randomUUID(); setSelected(res.id); setForm({ ...form, notes: '' }); list.reload()
    } catch (x) { setErr(x) } finally { setBusy(false) }
  }
  const canCreate = user.role !== 'supervisor' || follow
  return (
    <>
      <h1>Inspections</h1>
      <p className="sub">Create an inspection for a batch, upload evidence, then submit it so reviewers can decide. Uploads are kept even if AI processing fails.</p>
      {canCreate && (
        <form className="card" onSubmit={create}>
          <h2>{follow ? `New follow-up inspection for defect #${follow}` : 'New inspection'}</h2>
          <div className="row">
            <Field label="Batch"><select required value={form.batch_id} disabled={!!follow} onChange={(e) => setForm({ ...form, batch_id: e.target.value })}>
              <option value="">Choose a batch...</option>{follow && params.batch_id && <option value={params.batch_id}>{params.batch_code || `Batch ${params.batch_id}`}</option>}
              {(batches.data || []).map((b) => <option key={b.id} value={b.id}>{b.batch_code} - {b.product_code}</option>)}</select></Field>
            <Field label="Observations (optional)"><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <button className="btn" disabled={busy || !form.batch_id}>{busy ? 'Creating...' : 'Create draft'}</button>
          </div>
          <ErrorNote error={err} />
        </form>)}
      <div className="split">
        <section className="card">
          <h2>Recent inspections</h2>
          {list.loading && !list.data ? <Loading /> : <ErrorNote error={list.error} onRetry={list.reload} />}
          {list.data && (list.data.length === 0 ? <Empty title="No inspections yet" hint={canCreate ? 'Create the first one above.' : ''} /> : (
            <ul className="list">{list.data.map((n) => (
              <li key={n.id}><button className={`item ${String(selected) === String(n.id) ? 'on' : ''}`} onClick={() => setSelected(n.id)}>
                <strong>#{n.id} - {n.batch_code}</strong> <Badge value={n.status === 'submitted' ? 'done' : n.status} label={n.status} />
                <small>{fmtTime(n.inspected_at)} - {n.inspector_name} - {n.item_count} item(s)/{n.image_count} img{n.follow_up_of_defect_id ? ' - follow-up' : ''}</small></button></li>))}</ul>))}
        </section>
        {selected ? <Detail key={selected} id={selected} onChange={(gone) => { list.reload(); if (gone === true) setSelected(null) }} /> : <Empty title="Select or create an inspection" />}
      </div>
    </>
  )
}
