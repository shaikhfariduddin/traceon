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
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const r = await api.post('/auth/login', f)
      session.token = r.token
      onDone(r.user)
    } catch (x) {
      setErr(x)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="visual-top">
          <span className="logo"><i /><i /><i /><i /></span>
          <span>TRACEON</span>
          <span className="visual-tag">QUALITY INTELLIGENCE</span>
        </div>

        <div className="visual-content">
          <span className="eyebrow">SMARTER INSPECTION. BETTER TILES.</span>
          <h1>Every tile tells a story.<br />
            <span>We help you spot it.</span>
          </h1>
          <p>
            AI-powered quality inspection that helps your team
            detect defects, review results and take action with confidence.
          </p>

          <div className="tile-scene">
            <div className="tile-grid">
              <div className="tile tile-one"><span /></div>
              <div className="tile tile-two"><span /></div>
              <div className="tile tile-three"><span /></div>
              <div className="tile tile-four"><span /></div>
            </div>
            <div className="scan-label">
              <span className="scan-dot" />
              AI VISION SYSTEM
              <span className="scan-line" />
              TILE ANALYSIS
            </div>
            <div className="scan-corner corner-tl" />
            <div className="scan-corner corner-br" />
          </div>
        </div>

        <div className="visual-footer">
          <span>PRECISION IN EVERY PIXEL</span>
          <span>AI ASSISTS. PEOPLE DECIDE.</span>
        </div>
      </section>

      <section className="login-side">
        <form className="login-form" onSubmit={submit}>
          <div className="mobile-brand">
            <span className="logo"><i /><i /><i /><i /></span>
            <span>Traceon</span>
          </div>

          <div className="form-heading">
            <span className="eyebrow">WELCOME BACK</span>
            <h2>Good to see you.</h2>
            <p>Sign in to continue to your quality workspace.</p>
          </div>

          <div className="grid">
            <Field label="Username">
              <input
                value={f.username}
                onChange={(e) => setF({ ...f, username: e.target.value })}
                placeholder="Enter your username"
                autoComplete="username"
                autoFocus
              />
            </Field>

            <Field label="Password">
              <input
                type="password"
                value={f.password}
                onChange={(e) => setF({ ...f, password: e.target.value })}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </Field>

            <ErrorNote error={err} />

            <button className="btn login-submit" disabled={busy || !f.username || !f.password}>
              {busy ? 'Signing in...' : 'Sign in to Traceon'}
              {!busy && <span aria-hidden="true"> ↗</span>}
            </button>
          </div>

          <div className="login-divider"><span>DEMO ACCESS</span></div>
          <div className="demo-info">
            <span className="demo-icon">✦</span>
            <p>
              Try <strong>manager</strong> or <strong>inspector</strong>
              <br />Password: <strong>demo1234</strong>
            </p>
          </div>

          <p className="login-legal">AI-powered inspection · Human-verified decisions</p>
        </form>
      </section>
    </div>
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
