import React, { useState } from 'react'
import { api } from '../api.js'
import { Badge, ErrorNote, Field, Loading, useApp } from '../ui.jsx'

const EXAMPLES = ['Summarise batch B-104', 'What needs attention today?', 'Have we seen cracks before?', 'Is batch B-103 released and defect-free?']

export default function Assistant() {
  const { go } = useApp()
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [range, setRange] = useState({ start: '', end: '' })

  const run = async (fn) => { setBusy(true); setErr(null); try { setRes(await fn()) } catch (e) { setErr(e) } finally { setBusy(false) } }
  const ask = (text) => run(() => api.post('/assistant/ask', { question: text }))
  const open = (c) => ({ defect: () => go('defects', { defect_id: c.id }), image: () => go('review', { image_id: c.id }), batch: () => go('catalog', { batch_id: c.id }), inspection: () => go('inspect', { inspection_id: c.id }) }[c.type]?.())

  return (
    <>
      <h1>Assistant</h1>
      <p className="sub">Answers come only from stored records you are allowed to see, with citations you can open. It explains and summarises; it cannot release batches, close defects or change anything.</p>
      <form className="card" onSubmit={(e) => { e.preventDefault(); q.trim() && ask(q) }}>
        <div className="row"><input style={{ flex: 1, minWidth: 260 }} value={q} maxLength={500} onChange={(e) => setQ(e.target.value)} placeholder="Ask about a batch, open issues, or earlier defects..." aria-label="Question" /><button className="btn" disabled={busy || !q.trim()}>Ask</button></div>
        <div style={{ marginTop: 8 }}>{EXAMPLES.map((e) => <button type="button" key={e} className="chip" onClick={() => { setQ(e); ask(e) }}>{e}</button>)}</div>
      </form>
      <div className="card row">
        <Field label="Report from"><input type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} /></Field>
        <Field label="to"><input type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} /></Field>
        <button className="btn ghost" disabled={busy} onClick={() => run(() => api.post('/assistant/report', { start: range.start || undefined, end: range.end || undefined }))}>Draft quality report</button>
        <small style={{ width: '100%' }}>Leave dates empty for the last 30 days. Observations (human-reviewed) are kept apart from suggestions (unreviewed AI output).</small>
      </div>
      {busy && <Loading text="Gathering records..." />}
      <ErrorNote error={err} />
      {res && !busy && (
        <section className="card" aria-live="polite">
          <div className="row spread"><h2>Answer</h2><span><Badge value={res.status === 'ok' ? 'done' : 'warn'} label={res.status === 'ok' ? 'grounded in records' : res.status.replace('_', ' ')} /> <small style={{ display: 'inline' }}>mode: {res.mode}</small></span></div>
          <div className="answer">{res.answer}</div>
          {res.citations.length > 0 && <div style={{ marginTop: 12 }}><strong>Sources</strong><br />{res.citations.map((c) => <button key={c.ref} className="chip" onClick={() => open(c)}>{c.ref}</button>)}</div>}
          <small style={{ marginTop: 10 }}>The assistant has no ability to change records. Check each cited record before acting.</small>
        </section>)}
    </>
  )
}
