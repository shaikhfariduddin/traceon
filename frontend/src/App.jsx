import React, { useCallback, useEffect, useState } from 'react'
import { api, session } from './api.js'
import { Ctx, ErrorNote, Field, Loading } from './ui.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Catalog from './pages/Catalog.jsx'
import Inspect from './pages/Inspect.jsx'
import Review from './pages/Review.jsx'
import Defects from './pages/Defects.jsx'
import Assistant from './pages/Assistant.jsx'

const PAGES = [
  ['dashboard', 'Dashboard', Dashboard, ['inspector', 'supervisor', 'manager']],
  ['catalog', 'Products & batches', Catalog, ['inspector', 'manager', 'supervisor']],
  ['inspect', 'Inspections', Inspect, ['inspector', 'manager', 'supervisor']],
  ['review', 'Review queue', Review, ['inspector', 'manager', 'supervisor']],
  ['defects', 'Defects & actions', Defects, ['inspector', 'manager', 'supervisor']],
  ['assistant', 'Assistant', Assistant, ['inspector', 'manager', 'supervisor']],
]

function Login({ onDone }) {
  const [f, setF] = useState({ username: '', password: '' })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null)
    try { const r = await api.post('/auth/login', f); session.token = r.token; onDone(r.user) }
    catch (x) { setErr(x) } finally { setBusy(false) }
  }
  return (
    <form className="login card" onSubmit={submit}>
      <div className="brand" style={{ color: 'var(--ink)' }}><span className="logo"><i /><i /><i /><i /></span>Traceon</div>
      <p className="sub">Tile inspection &amp; defect tracking. AI suggests; people decide.</p>
      <div className="grid">
        <Field label="Username"><input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoFocus /></Field>
        <Field label="Password"><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <ErrorNote error={err} />
        <button className="btn" disabled={busy || !f.username || !f.password}>{busy ? 'Signing in...' : 'Sign in'}</button>
        <small>Demo accounts: manager, inspector, inspector2, supervisor, supervisor2 (password demo1234)</small>
      </div>
    </form>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [meta, setMeta] = useState(null)
  const [booting, setBooting] = useState(!!session.token)
  const [route, setRoute] = useState({ page: 'dashboard', params: {} })
  const go = useCallback((page, params = {}) => setRoute({ page, params, k: Date.now() }), [])

  const load = useCallback(async () => {
    try { setUser(await api.get('/me')); setMeta(await api.get('/meta')) } catch { session.token = null; setUser(null) }
    setBooting(false)
  }, [])
  useEffect(() => { if (session.token) load() }, [load])
  useEffect(() => { const h = () => setUser(null); window.addEventListener('traceon-logout', h); return () => window.removeEventListener('traceon-logout', h) }, [])

  if (booting) return <Loading text="Starting..." />
  if (!user) return <Login onDone={(u) => { setUser(u); load() }} />
  const Page = PAGES.find((p) => p[0] === route.page)?.[2] || Dashboard
  return (
    <Ctx.Provider value={{ user, meta, go, params: route.params, refreshMeta: load }}>
      <div className="shell">
        <nav className="rail" aria-label="Main">
          <div className="brand"><span className="logo"><i /><i /><i /><i /></span>Traceon</div>
          {PAGES.filter((p) => p[3].includes(user.role)).map(([id, label]) => (
            <button key={id} className={`nav ${route.page === id ? 'on' : ''}`} onClick={() => go(id)}>{label}</button>))}
          <div className="who"><strong>{user.full_name}</strong>{user.role}
            <div><button className="link" style={{ color: '#9fc0ff', padding: 0 }} onClick={() => { session.token = null; setUser(null) }}>Sign out</button></div></div>
        </nav>
        <main>
          {meta && !meta.ai.available && <div className="note warn">AI suggestions are unavailable. {meta.ai.reason} Inspections still work: images are stored and go to manual review.</div>}
          <Page key={route.k || route.page} />
        </main>
      </div>
    </Ctx.Provider>
  )
}
