import React, { useState } from 'react'
import { api } from '../api.js'
import { Badge, Empty, ErrorNote, Field, Loading, ReasonButton, fmtDate, pretty, useApp, useAsync } from '../ui.jsx'

function Form({ fields, onSubmit, label }) {
  const [v, setV] = useState({})
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null)
    try { await onSubmit(v); setV({}) } catch (x) { setErr(x) } finally { setBusy(false) }   // entries stay on screen if it fails
  }
  return (
    <form onSubmit={submit} className="grid">
      <div className="row">{fields.map(([k, l, type = 'text', opts]) => (
        <Field key={k} label={l}>{opts ? <select value={v[k] || ''} onChange={(e) => setV({ ...v, [k]: e.target.value })}><option value="">Choose...</option>{opts.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
          : <input type={type} value={v[k] || ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}</Field>))}</div>
      <ErrorNote error={err} /><div><button className="btn" disabled={busy}>{busy ? 'Saving...' : label}</button></div>
    </form>
  )
}

function BatchDetail({ id, reload }) {
  const { user } = useApp()
  const b = useAsync(() => api.get(`/batches/${id}`), [id])
  const [dec, setDec] = useState({ decision: 'hold', reason: '', acknowledge: false })
  const [err, setErr] = useState(null)
  const [edit, setEdit] = useState({ quantity: '', production_line: '' })
  if (b.loading && !b.data) return <Loading />
  if (b.error) return <ErrorNote error={b.error} onRetry={b.reload} />
  const x = b.data, c = x.coverage, refresh = () => { b.reload(); reload() }
  const record = async () => { setErr(null); try { await api.post(`/batches/${id}/decisions`, dec); setDec({ decision: 'hold', reason: '', acknowledge: false }); refresh() } catch (e) { setErr(e) } }
  return (
    <section className="card">
      <div className="row spread"><h2>Batch {x.batch_code}</h2><span>{x.status === 'archived' && <Badge value="archived" />} {x.latest_decision ? <Badge value={x.latest_decision.decision} label={`Decision: ${x.latest_decision.decision}`} /> : <Badge value="pending" label="No decision yet" />}</span></div>
      <p className="muted">{x.product_code} - {x.product_name}{x.product_status === 'archived' ? ' (product archived)' : ''} - produced {fmtDate(x.produced_date)} - quantity {x.quantity}</p>
      <div className="grid g4">
        {[['inspected', 'Items inspected'], ['reviewed', 'Items reviewed'], ['with_confirmed_defect', 'Confirmed defective'], ['unreviewed', 'Unreviewed'], ['disputed', 'Disputed']].map(([k, l]) => <div key={k}><b style={{ fontSize: '1.5rem' }}>{c[k]}</b><small>{l}</small></div>)}
        <div><b style={{ fontSize: '1.5rem' }}>{c.defect_rate == null ? 'n/a' : `${(c.defect_rate * 100).toFixed(1)}%`}</b><small>defect rate ({c.with_confirmed_defect}/{c.reviewed} reviewed items)</small></div>
      </div>
      <small style={{ marginTop: 8 }}>{(c.inspected_share_of_batch * 100).toFixed(1)}% of the batch quantity was sampled. One reviewed image never decides a whole batch. Other evidence: {c.other_evidence.surface_images} surface and {c.other_evidence.batch_sample_images} batch-sample images.</small>

      {user.role === 'manager' && x.status === 'active' && (
        <div className="card" style={{ marginTop: 12, background: 'var(--glaze)' }}>
          <h3 style={{ marginTop: 0 }}>Record batch decision (human, separate from image results)</h3>
          <div className="row">
            <Field label="Decision"><select value={dec.decision} onChange={(e) => setDec({ ...dec, decision: e.target.value })}><option value="hold">Hold</option><option value="release">Release</option></select></Field>
            <Field label="Reason"><input value={dec.reason} onChange={(e) => setDec({ ...dec, reason: e.target.value })} /></Field>
          </div>
          {dec.decision === 'release' && (c.unreviewed + c.disputed > 0 || c.open_defects > 0) && (
            <label className="row"><input type="checkbox" style={{ width: 'auto' }} checked={dec.acknowledge} onChange={(e) => setDec({ ...dec, acknowledge: e.target.checked })} />I acknowledge {c.unreviewed + c.disputed} unreviewed/disputed item(s) and {c.open_defects} open defect(s).</label>)}
          <ErrorNote error={err} /><button className="btn" disabled={!dec.reason.trim()} onClick={record}>Record decision</button>
        </div>)}

      <h3>Decision history</h3>
      {x.decisions.length === 0 ? <Empty title="No decisions recorded" /> : (
        <table><thead><tr><th>When</th><th>Decision</th><th>By</th><th>Reason</th><th>Evidence at the time</th></tr></thead><tbody>
          {x.decisions.map((d) => <tr key={d.id}><td>{fmtDate(d.decided_at)}</td><td><Badge value={d.decision} /></td><td>{d.decided_by_name}</td><td>{d.reason}</td><td>{d.items_reviewed}/{d.items_inspected} items reviewed, {d.open_defects} open defect(s)</td></tr>)}</tbody></table>)}

      {x.status === 'active' && (user.role === 'manager' || user.role === 'inspector') && (
        <div className="row" style={{ marginTop: 14 }}>
          <Field label="Quantity"><input type="number" value={edit.quantity} onChange={(e) => setEdit({ ...edit, quantity: e.target.value })} placeholder={x.quantity} /></Field>
          <Field label="Production line"><input value={edit.production_line} onChange={(e) => setEdit({ ...edit, production_line: e.target.value })} placeholder={x.production_line || ''} /></Field>
          <ReasonButton label="Save edit" onConfirm={async (reason) => { const body = { reason }; if (edit.quantity) body.quantity = edit.quantity; if (edit.production_line) body.production_line = edit.production_line; await api.patch(`/batches/${id}`, body); setEdit({ quantity: '', production_line: '' }); refresh() }} />
          {user.role === 'manager' && <ReasonButton danger label="Archive batch" onConfirm={async (reason) => { await api.post(`/batches/${id}/archive`, { reason }); refresh() }} />}
        </div>)}
    </section>
  )
}

export default function Catalog() {
  const { user, params, go } = useApp()
  const [productId, setProductId] = useState(params.product_id || '')
  const [selected, setSelected] = useState(params.batch_id || null)
  const [showArchived, setShowArchived] = useState(false)
  const products = useAsync(() => api.get('/products', { include_archived: true }), [])
  const batches = useAsync(() => api.get('/batches', { product_id: productId, include_archived: showArchived }), [productId, showArchived])
  const canBatch = user.role === 'manager' || user.role === 'inspector'
  return (
    <div className="catalog-page">
      <h1>Products &amp; batches</h1>
      <p className="sub">One product family, many batches. Archiving a product never removes its history.</p>
      <div className="split">
        <section className="card">
          <h2>Products</h2>
          {products.loading && !products.data ? <Loading /> : <ErrorNote error={products.error} onRetry={products.reload} />}
          <ul className="list"><li><button className={`item ${!productId ? 'on' : ''}`} onClick={() => setProductId('')}>All products</button></li>
            {(products.data || []).map((p) => <li key={p.id}><button className={`item ${String(productId) === String(p.id) ? 'on' : ''}`} onClick={() => setProductId(p.id)}><strong>{p.code}</strong> {p.status === 'archived' && <Badge value="archived" />}<small>{p.name} - {p.batch_count} batch(es)</small></button></li>)}</ul>
          {user.role === 'manager' && <><h3>New product</h3><Form label="Add product" fields={[['code', 'Code'], ['name', 'Name'], ['category', 'Category'], ['supplier', 'Supplier (optional)']]} onSubmit={async (v) => { await api.post('/products', v); products.reload() }} /></>}
          {user.role === 'manager' && productId && products.data?.find((p) => String(p.id) === String(productId))?.status === 'active' &&
            <div style={{ marginTop: 10 }}><ReasonButton danger label="Archive product" onConfirm={async (reason) => { await api.post(`/products/${productId}/archive`, { reason }); products.reload(); batches.reload() }} /></div>}
        </section>
        <div>
          <section className="card">
            <div className="row spread"><h2>Batches</h2><label className="row"><input type="checkbox" style={{ width: 'auto' }} checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Show archived</label></div>
            {batches.loading && !batches.data ? <Loading /> : <ErrorNote error={batches.error} onRetry={batches.reload} />}
            {batches.data && (batches.data.length === 0 ? <Empty title="No batches yet" hint={canBatch ? 'Add one below.' : ''} /> : (
              <table><thead><tr><th>Batch</th><th>Product</th><th>Produced</th><th>Qty</th><th>Items reviewed</th><th>Confirmed defective</th><th>Decision</th></tr></thead><tbody>
                {batches.data.map((b) => <tr key={b.id} className={`click ${String(selected) === String(b.id) ? 'on' : ''}`} onClick={() => setSelected(b.id)}>
                  <td><strong>{b.batch_code}</strong> {b.status === 'archived' && <Badge value="archived" />}</td><td>{b.product_code}</td><td>{fmtDate(b.produced_date)}</td><td>{b.quantity}</td>
                  <td>{b.coverage.reviewed}/{b.coverage.inspected}</td><td>{b.coverage.with_confirmed_defect}</td><td>{b.latest_decision ? <Badge value={b.latest_decision.decision} /> : <small>none</small>}</td></tr>)}</tbody></table>))}
            {canBatch && productId && products.data?.find((p) => String(p.id) === String(productId))?.status === 'active' && <><h3>New batch</h3>
              <Form label="Add batch" fields={[['batch_code', 'Batch code'], ['produced_date', 'Produced', 'date'], ['quantity', 'Quantity', 'number'], ['production_line', 'Line (optional)']]}
                onSubmit={async (v) => { await api.post('/batches', { ...v, product_id: Number(productId) }); batches.reload() }} /></>}
          </section>
          {selected && <BatchDetail key={selected} id={selected} reload={batches.reload} />}
          {selected && canBatch && <button className="btn ghost" onClick={() => go('inspect', { batch_id: selected, new: true })}>Start an inspection for this batch</button>}
        </div>
      </div>
    </div>
  )
}
