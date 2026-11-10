const KEY = 'linktrack_token'

export const getToken = () => localStorage.getItem(KEY)
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY))

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
