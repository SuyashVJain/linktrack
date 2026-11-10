import { useEffect, useState } from 'react'
import { getToken, setToken } from './api.js'
import Auth from './Auth.jsx'
import Dashboard from './Dashboard.jsx'
import Stats from './Stats.jsx'

// Minimal hash router: "#/" is the dashboard, "#/links/:id" the stats page.
const useHash = () => {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return hash
}

export default function App() {
  const [authed, setAuthed] = useState(!!getToken())
  const hash = useHash()

  useEffect(() => {
    const out = () => setAuthed(false)
    addEventListener('logout', out)
    return () => removeEventListener('logout', out)
  }, [])

  if (!authed) return <Auth onAuth={() => setAuthed(true)} />

  const stats = hash.match(/^#\/links\/(\d+)$/)
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <a href="#/" className="text-lg font-semibold">linktrack</a>
        <button
          className="text-sm text-slate-500 hover:text-slate-900"
          onClick={() => { setToken(null); setAuthed(false) }}
        >
          Log out
        </button>
      </header>
      {stats ? <Stats id={stats[1]} /> : <Dashboard />}
    </div>
  )
}
