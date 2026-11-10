const TOKEN_KEY = 'linktrack_token'
const GUEST_KEY = 'linktrack_guest_links'

// localStorage can throw (private mode, blocked storage); the app still works without it.
const read = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* ignore */ } }

export const getToken = () => read(TOKEN_KEY)
export const setToken = (t) => write(TOKEN_KEY, t)

// Guest links are kept as [{slug, stats_token}].
export function getGuestLinks() {
  try { return JSON.parse(read(GUEST_KEY)) || [] } catch { return [] }
}
export const addGuestLink = (l) =>
  write(GUEST_KEY, JSON.stringify([{ slug: l.slug, stats_token: l.stats_token }, ...getGuestLinks()]))
export const removeGuestLink = (token) =>
  write(GUEST_KEY, JSON.stringify(getGuestLinks().filter((l) => l.stats_token !== token)))
export const clearGuestLinks = () => write(GUEST_KEY, null)

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(getToken() && { Authorization: 'Bearer ' + getToken() }),
    },
    body: body && JSON.stringify(body),
  })
  if (res.status === 401 && getToken()) {
    setToken(null)
    window.dispatchEvent(new Event('logout'))
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

// After login or register, move any guest links onto the account. Returns how many were claimed.
export async function claimGuestLinks() {
  const tokens = getGuestLinks().map((l) => l.stats_token)
  if (!tokens.length) return 0
  const { claimed } = await api('/links/claim', { method: 'POST', body: { tokens } })
  clearGuestLinks()
  return claimed
}
