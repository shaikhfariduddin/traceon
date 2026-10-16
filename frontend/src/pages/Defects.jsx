import React, { useState } from 'react'
import { api } from '../api.js'
import { Badge, Empty, ErrorNote, Field, Loading, ReasonButton, SecureImage, fmtDate, fmtTime, pretty, useApp, useAsync } from '../ui.jsx'

function ActionRow({ a, user, onChange, setErr }) {
  const assigner = user.role !== 'supervisor'
  const mine = a.owner_id === user.id
  const step = async (status) => { setErr(null); try { await api.patch(`/actions/${a.id}`, { status }); onChange() } catch (e) { setErr(e) } }
  return (
    <tr><td><strong>{a.title}</strong>{a.notes && <small>{a.notes}</small>}</td><td>{a.owner_name}</td>
      <td>{fmtDate(a.target_date)} {a.overdue && <Badge value="failed" label="overdue" />}</td><td><Badge value={a.status} /></td>
      <td>
        {(mine || assigner) && a.status === 'open' && <button className="btn sm ghost" onClick={() => step('in_progress')}>Start</button>}{' '}
        {(mine || assigner) && ['open', 'in_progress'].includes(a.status) && <button className="btn sm" onClick={() => step('done')}>Mark done</button>}{' '}
        {assigner && ['open', 'in_progress'].includes(a.status) && <ReasonButton danger label="Cancel" onConfirm={async (reason) => { await api.patch(`/actions/${a.id}`, { status: 'cancelled', reason }); onChange() }} />}</td></tr>
  )
}

function Detail({ id, onChange }) {
  const { user, meta, go } = useApp()
  const d = useAsync(() => api.get(`/defects/${id}`), [id])
  const sups = useAsync(() => (user.role === 'supervisor' ? Promise.resolve([]) : api.get('/users', { role: 'supervisor' })), [])
  const [nf, setNf] = useState({ title: '', owner_id: '', target_date: '', notes: '' })
  const [err, setErr] = useState(null)
  if (d.loading && !d.data) return <Loading />
  if (d.error) return <ErrorNote error={d.error} onRetry={d.reload} />
  const x = d.data
  const refresh = () => { d.reload(); onChange() }
  const decider = user.role !== 'supervisor'
  const canAssign = decider && !['closed', 'withdrawn'].includes(x.status) && x.review_state === 'defect_confirmed'
  const add = async () => { setErr(null); try { await api.post(`/defects/${id}/actions`, { ...nf, owner_id: Number(nf.owner_id) }); setNf({ title: '', owner_id: '', target_date: '', notes: '' }); refresh() } catch (e) { setErr(e) } }
  const fuDone = x.follow_ups.filter((f) => f.status === 'submitted').length
  return (
    <section className="card">
      <div className="row spread"><h2>Defect #{x.id} - {pretty(x.category)} ({x.severity})</h2><Badge value={x.status} /></div>
      <p className="muted">Batch {x.batch_code} - item {x.sample_ref} - {x.description}</p>
      {x.recurrence && <div className="note warn">Possible recurrence: the same category appeared earlier as defect #{x.recurrence.id} on batch {x.recurrence.batch_code} ({x.recurrence.status}). {x.recurrence.note}</div>}
      {x.review_state !== 'defect_confirmed' && <div className="note warn">The image review state is "{pretty(x.review_state)}", so this defect is not currently confirmed.</div>}
      <div className="imgs"><figure><SecureImage path={`/images/${x.image_id}/file`} alt="Evidence" /><figcaption>Evidence <button className="link" onClick={() => go('review', { image_id: x.image_id })}>open review</button></figcaption></figure></div>
      <ErrorNote error={err} />

      <h3>Corrective actions</h3>
      {x.actions.length === 0 ? <Empty title="No actions yet" /> : (
        <table><thead><tr><th>Action</th><th>Owner</th><th>Target</th><th>Status</th><th /></tr></thead><tbody>{x.actions.map((a) => <ActionRow key={a.id} a={a} user={user} setErr={setErr} onChange={refresh} />)}</tbody></table>)}
      {canAssign && (
        <div className="card" style={{ background: 'var(--glaze)', marginTop: 10 }}>
          <div className="row">
            <Field label="Action"><input value={nf.title} onChange={(e) => setNf({ ...nf, title: e.target.value })} /></Field>
            <Field label="Owner"><select value={nf.owner_id} onChange={(e) => setNf({ ...nf, owner_id: e.target.value })}><option value="">Choose...</option>{(sups.data || []).map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></Field>
            <Field label="Target date"><input type="date" value={nf.target_date} onChange={(e) => setNf({ ...nf, target_date: e.target.value })} /></Field>
            <Field label="Notes"><input value={nf.notes} onChange={(e) => setNf({ ...nf, notes: e.target.value })} /></Field>
            <button className="btn" disabled={!nf.title || !nf.owner_id || !nf.target_date} onClick={add}>Assign action</button></div></div>)}

      <h3>Follow-up inspections</h3>
      {x.follow_ups.length === 0 ? <small>None yet.</small> : <ul>{x.follow_ups.map((f) => <li key={f.id}><button className="link" onClick={() => go('inspect', { inspection_id: f.id })}>Inspection #{f.id}</button> - {f.status} - {fmtDate(f.inspected_at)}</li>)}</ul>}
      {['awaiting_reinspection', 'reopened', 'open'].includes(x.status) && (
        <button className="btn ghost" onClick={() => go('inspect', { follow_up_of_defect_id: x.id, batch_id: x.batch_id, batch_code: x.batch_code })}>Submit follow-up evidence</button>)}
      {decider && (
        <div className="row" style={{ marginTop: 12 }}>
          {x.status === 'awaiting_reinspection' && <ReasonButton label={`Close defect${fuDone ? '' : ' (needs a follow-up)'}`} onConfirm={async (reason) => { await api.post(`/defects/${id}/close`, { reason }); refresh() }} />}
          {['awaiting_reinspection', 'closed'].includes(x.status) && <ReasonButton danger label="Reopen" onConfirm={async (reason) => { await api.post(`/defects/${id}/reopen`, { reason }); refresh() }} />}
        </div>)}

      <h3>History (nothing is deleted)</h3>
      <div className="tl">{x.history.map((h) => <div key={h.id}><strong>{h.actor_name || 'system'}</strong> {pretty(h.action)}<small>{fmtTime(h.at)}{h.reason ? ` - "${h.reason}"` : ''}</small></div>)}</div>
    </section>
  )
}

export default function Defects() {
  const { user, meta, params } = useApp()
  const [tab, setTab] = useState(params.tab || (user.role === 'supervisor' ? 'actions' : 'defects'))
  const [selected, setSelected] = useState(params.defect_id || null)
  const [f, setF] = useState({ status: params.status || '', defect_category: params.defect_category || '', recurring: params.recurring || '', batch_id: params.batch_id || '', product_id: params.product_id || '', action_owner_id: params.action_owner_id || '', review_state: params.review_state || '' })
  const af = { open_only: params.open_only || '', overdue: params.overdue || '', status: tab === 'actions' ? f.status : '', batch_id: f.batch_id, product_id: f.product_id, defect_category: f.defect_category, action_owner_id: f.action_owner_id }
  const defects = useAsync(() => api.get('/defects', f), [JSON.stringify(f)])
  const actions = useAsync(() => api.get('/actions', af), [JSON.stringify(af), tab])
  const [err, setErr] = useState(null)
  const reloadAll = () => { defects.reload(); actions.reload() }
  return (
    <>
      <h1>Defects &amp; actions</h1>
      <p className="sub">Human-confirmed defects, the work assigned to fix them, and the reinspection evidence. Closing or reopening never deletes earlier findings.</p>
      <div className="row" style={{ marginBottom: 12 }}>
        {user.role !== 'supervisor' && <button className={`choice ${tab === 'defects' ? 'on' : ''}`} onClick={() => setTab('defects')}>Defects</button>}
        <button className={`choice ${tab === 'actions' ? 'on' : ''}`} onClick={() => setTab('actions')}>{user.role === 'supervisor' ? 'My actions' : 'Actions'}</button>
        <Field label="Defect status"><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Any</option>{['open', 'awaiting_reinspection', 'reopened', 'closed'].map((s) => <option key={s} value={s}>{pretty(s)}</option>)}</select></Field>
        <Field label="Category"><select value={f.defect_category} onChange={(e) => setF({ ...f, defect_category: e.target.value })}><option value="">Any</option>{meta.defect_categories.map((c) => <option key={c} value={c}>{pretty(c)}</option>)}</select></Field>
        <label className="row"><input type="checkbox" style={{ width: 'auto' }} checked={!!f.recurring} onChange={(e) => setF({ ...f, recurring: e.target.checked ? 'true' : '' })} />Possible recurrences only</label>
      </div>
      <ErrorNote error={err} />
      <div className="split">
        <section className="card">
          {tab === 'defects' ? (defects.loading && !defects.data ? <Loading /> : defects.error ? <ErrorNote error={defects.error} onRetry={defects.reload} /> :
            defects.data.length === 0 ? <Empty title="No defects match" hint="Defects appear here once a reviewer confirms them." /> : (
              <ul className="list">{defects.data.filter((d) => d.review_state === 'defect_confirmed' || f.status).map((d) => (
                <li key={d.id}><button className={`item ${String(selected) === String(d.id) ? 'on' : ''}`} onClick={() => setSelected(d.id)}>
                  <strong>#{d.id} {pretty(d.category)}</strong> <Badge value={d.status} />{d.recurrence_of ? <> <Badge value="warn" label="recurrence?" /></> : null}
                  <small>{d.batch_code} - {d.severity} - {d.open_actions} open action(s){d.overdue_actions ? ` (${d.overdue_actions} overdue)` : ''}</small></button></li>))}</ul>))
            : (actions.loading && !actions.data ? <Loading /> : actions.error ? <ErrorNote error={actions.error} onRetry={actions.reload} /> :
              actions.data.length === 0 ? <Empty title="No actions match" /> : (
                <ul className="list">{actions.data.map((a) => (
                  <li key={a.id}><button className={`item ${String(selected) === String(a.defect_id) ? 'on' : ''}`} onClick={() => setSelected(a.defect_id)}>
                    <strong>{a.title}</strong> <Badge value={a.status} />{a.overdue && <> <Badge value="failed" label="overdue" /></>}
                    <small>{a.batch_code} - {pretty(a.category)} - {a.owner_name} - due {fmtDate(a.target_date)}</small></button></li>))}</ul>))}
        </section>
        {selected ? <Detail key={selected} id={selected} onChange={reloadAll} /> : <Empty title="Select a defect or action" />}
      </div>
    </>
  )
}
