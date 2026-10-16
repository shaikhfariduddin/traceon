// Tiny API client. Errors carry the server's message and code so screens can show them verbatim.
const BASE = import.meta.env.VITE_API || '/api'

export const session = {
  get token() { return sessionStorage.getItem('traceon_token') },
  set token(v) { v ? sessionStorage.setItem('traceon_token', v) : sessionStorage.removeItem('traceon_token') },
}

async function request(method, path, { body, form, headers = {} } = {}) {
  const opts = { method, headers: { ...headers } }
  if (session.token) opts.headers.Authorization = `Bearer ${session.token}`
  if (form) opts.body = form
  else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body) }
  let res
  try { res = await fetch(`${BASE}${path}`, opts) }
  catch { const e = new Error('Cannot reach the server. Your entries are still on screen - check the backend is running and try again.'); e.code = 'NETWORK'; throw e }
  if (res.status === 401 && path !== '/auth/login') { session.token = null; window.dispatchEvent(new Event('traceon-logout')) }
  if (!res.ok) {
    let info = {}
    try { info = (await res.json()).error || {} } catch { /* non-JSON error */ }
    const e = new Error(info.message || `Request failed (${res.status})`)
    e.code = info.code || 'ERROR'; e.status = res.status
    throw e
  }
  return res.status === 204 ? null : res.json()
}

const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null))
  return s.toString() ? `?${s}` : ''
}

export const api = {
  get: (path, params) => request('GET', path + qs(params)),
  post: (path, body, headers) => request('POST', path, { body: body ?? {}, headers }),
  patch: (path, body) => request('PATCH', path, { body }),
  del: (path) => request('DELETE', path),
  upload: (path, form) => request('POST', path, { form }),
  // Files are permission-checked, so they are fetched with the token and shown from a blob URL.
  async blobUrl(path) {
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${session.token}` } })
    if (!res.ok) throw new Error('Image unavailable')
    return URL.createObjectURL(await res.blob())
  },
}
