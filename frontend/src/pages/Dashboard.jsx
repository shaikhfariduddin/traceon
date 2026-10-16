import React, { useState } from 'react'
import { api } from '../api.js'
import { Badge, Empty, ErrorNote, Field, Loading, fmtTime, pretty, useApp, useAsync } from '../ui.jsx'

const CARDS = [
  ['pending_reviews', 'Pending reviews', 'warn', 'review', { review_state: 'pending' }],
  ['needs_more_evidence', 'More evidence requested', 'warn', 'review', { review_state: 'needs_more_evidence' }],
  ['disputed', 'Disputed (reviewers disagree)', 'warn', 'review', { review_state: 'disputed' }],
  ['failed_ai_runs', 'AI failed - manual review', 'bad', 'review', { review_state: 'pending' }],
  ['confirmed_defects', 'Confirmed defects (human)', 'bad', 'defects', {}],
  ['awaiting_reinspection', 'Awaiting reinspection', 'info', 'defects', { status: 'awaiting_reinspection' }],
  ['reopened_defects', 'Reopened defects', 'bad', 'defects', { status: 'reopened' }],
  ['recurring_defects', 'Possible recurrences', 'warn', 'defects', { recurring: 'true' }],
  ['open_actions', 'Open actions', 'info', 'defects', { tab: 'actions', open_only: 'true' }],
  ['overdue_actions', 'Overdue actions', 'bad', 'defects', { tab: 'actions', overdue: 'true' }],
]

export default function Dashboard() {
  const { user, meta, go } = useApp()
  const [f, setF] = useState({ product_id: '', batch_id: '', date_from: '', date_to: '', defect_category: '', review_state: '', action_owner_id: '' })
  const [q, setQ] = useState('')
  const [hits, setHits] = useState(null)
  const [searchErr, setSearchErr] = useState(null)
  const dash = useAsync(() => api.get('/dashboard', f), [JSON.stringify(f)])
  const products = useAsync(() => api.get('/products', { include_archived: true }), [])
  const batches = useAsync(() => api.get('/batches', { product_id: f.product_id, include_archived: true }), [f.product_id])
  const sups = useAsync(() => (user.role === 'supervisor' ? Promise.resolve([]) : api.get('/users', { role: 'supervisor' })), [])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const search = async (e) => {
    e.preventDefault(); setSearchErr(null)
    try { setHits(await api.get('/search', { q })) } catch (x) { setSearchErr(x); setHits(null) }
  }
  const open = (h) => ({ batch: () => go('catalog', { batch_id: h.id }), product: () => go('catalog', { product_id: h.id }),
    inspection: () => go('inspect', { inspection_id: h.id }), defect: () => go('defects', { defect_id: h.id }) }[h.type]())
  const d = dash.data

  return (
    <>
      <h1>Dashboard</h1>
      <p className="sub">What needs attention, which defects are confirmed by people, which actions are open and whether issues come back. AI flags are never counted as defects.</p>

      <form className="card row" onSubmit={search}>
        <input style={{ flex: 1, minWidth: 220 }} placeholder="Search batches, products, inspections, defects..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <button className="btn">Search</button>
        <ErrorNote error={searchErr} />
        {hits && (hits.length === 0 ? <small>No matches.</small> : (
          <ul className="list" style={{ width: '100%' }}>{hits.map((h) => (
            <li key={h.type + h.id}><button type="button" className="item" onClick={() => open(h)}><Badge value="info" label={h.type} /> {h.title} <small>{h.subtitle}</small></button></li>))}</ul>))}
      </form>

      <div className="card">
        <div className="row">
          <Field label="Product"><select value={f.product_id} onChange={(e) => setF({ ...f, product_id: e.target.value, batch_id: '' })}><option value="">All</option>{(products.data || []).map((p) => <option key={p.id} value={p.id}>{p.code}{p.status === 'archived' ? ' (archived)' : ''}</option>)}</select></Field>
          <Field label="Batch"><select value={f.batch_id} onChange={set('batch_id')}><option value="">All</option>{(batches.data || []).map((b) => <option key={b.id} value={b.id}>{b.batch_code}</option>)}</select></Field>
          <Field label="From"><input type="date" value={f.date_from} onChange={set('date_from')} /></Field>
          <Field label="To"><input type="date" value={f.date_to} onChange={set('date_to')} /></Field>
          <Field label="Defect category"><select value={f.defect_category} onChange={set('defect_category')}><option value="">All</option>{(meta?.defect_categories || []).map((c) => <option key={c} value={c}>{pretty(c)}</option>)}</select></Field>
          <Field label="Review state"><select value={f.review_state} onChange={set('review_state')}><option value="">All</option>{['pending', 'needs_more_evidence', 'disputed', 'no_defect', 'defect_confirmed'].map((c) => <option key={c} value={c}>{pretty(c)}</option>)}</select></Field>
          {user.role !== 'supervisor' && <Field label="Action owner"><select value={f.action_owner_id} onChange={set('action_owner_id')}><option value="">Anyone</option>{(sups.data || []).map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></Field>}
        </div>
      </div>

      {dash.loading && !d ? <Loading /> : <ErrorNote error={dash.error} onRetry={dash.reload} />}
      {d && (
        <>
          <div className="grid g4" style={{ marginBottom: 14 }}>
            {CARDS.map(([key, label, tone, page, params]) => (
              <button key={key} className={`stat ${tone}`} onClick={() => go(page, { ...params, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) })}>
                <b>{d.cards[key]}</b><span>{label}</span></button>))}
          </div>

          <div className="grid g2">
            <section className="card">
              <h2>Inspection coverage</h2>
              <div className="row" style={{ gap: 24 }}>
                <div><b style={{ fontSize: '1.6rem' }}>{d.items.inspected}</b><small>items inspected</small></div>
                <div><b style={{ fontSize: '1.6rem' }}>{d.items.reviewed}</b><small>items fully reviewed</small></div>
                <div><b style={{ fontSize: '1.6rem' }}>{d.items.with_confirmed_defect}</b><small>with confirmed defect</small></div>
                <div><b style={{ fontSize: '1.6rem' }}>{d.items.defect_rate == null ? 'n/a' : `${(d.items.defect_rate * 100).toFixed(1)}%`}</b><small>defect rate ({d.items.with_confirmed_defect}/{d.items.reviewed})</small></div>
              </div>
              <small style={{ marginTop: 10 }}>{d.rate_definition}</small>
            </section>
            <section className="card">
              <h2>Weekly defect rate</h2>
              {d.trend.length === 0 ? <Empty title="No reviewed items in this selection yet" /> : (
                <div className="trend" role="img" aria-label="Weekly defect rate">{d.trend.map((t) => (
                  <div className="bar" key={t.week_start} title={`${t.items_with_defect} defective of ${t.items_reviewed} reviewed items`}>
                    <i style={{ height: `${Math.max(2, t.defect_rate * 100)}%` }} /><span>{(t.defect_rate * 100).toFixed(0)}%<br />{t.items_with_defect}/{t.items_reviewed}<br />{t.week_start.slice(5)}</span></div>))}</div>)}
              <small>{d.trend_note}</small>
            </section>
          </div>

          <section className="card">
            <h2>Recent activity</h2>
            {d.recent_activity.length === 0 ? <Empty title="Nothing recorded yet" /> : (
              <table><thead><tr><th>When</th><th>Who</th><th>What</th><th>Reason</th></tr></thead><tbody>
                {d.recent_activity.map((a) => (<tr key={a.id}><td>{fmtTime(a.at)}</td><td>{a.actor_name || 'system'}</td><td>{pretty(a.entity)} #{a.entity_id} {pretty(a.action)}</td><td>{a.reason || ''}</td></tr>))}</tbody></table>)}
          </section>
        </>)}
    </>
  )
}
