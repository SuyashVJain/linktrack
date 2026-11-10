import { useEffect, useState } from 'react'
import { getToken, setToken } from './api.js'
import { Link, navigate, usePath } from './router.jsx'
import Landing from './Landing.jsx'
import Links from './Links.jsx'
import AuthPage from './AuthPage.jsx'
import Stats from './Stats.jsx'

function Blobs() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-[#0b0b1a] via-[#14102b] to-[#0a1024]" aria-hidden>
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-violet-600/40 blur-3xl" />
      <div className="absolute -right-24 top-1/3 h-[28rem] w-[28rem] rounded-full bg-indigo-500/30 blur-3xl" />
      <div className="absolute -bottom-32 left-1/4 h-96 w-96 rounded-full bg-fuchsia-600/25 blur-3xl" />
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(!!getToken())
  const path = usePath()

  useEffect(() => {
    const out = () => setAuthed(false)
    addEventListener('logout', out)
    return () => removeEventListener('logout', out)
  }, [])

  let page
  let m
  if (path === '/login' || path === '/register') {
    page = <AuthPage mode={path.slice(1)} onAuth={() => setAuthed(true)} />
  } else if (path === '/links') {
    page = <Links authed={authed} />
  } else if ((m = path.match(/^\/stats\/([A-Za-z0-9_-]+)$/))) {
    page = <Stats token={m[1]} />
  } else {
    page = <Landing authed={authed} />
  }

  const nav = 'text-sm text-white/70 transition hover:text-white'
  return (
    <>
      <Blobs />
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6">
        <header className="mb-6 flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold tracking-tight">link<span className="text-violet-400">track</span></Link>
          <nav className="flex items-center gap-4">
            <Link to="/links" className={nav}>My links</Link>
            {authed ? (
              <button className={nav} onClick={() => { setToken(null); setAuthed(false); navigate('/') }}>Log out</button>
            ) : (
              <>
                <Link to="/login" className={nav}>Log in</Link>
                <Link to="/register" className="btn-ghost">Sign up</Link>
              </>
            )}
          </nav>
        </header>

        {!authed && (
          <div className="glass mb-6 border-amber-300/20 px-4 py-3 text-sm text-amber-100/90">
            You are not signed in. <Link to="/register" className="font-medium underline underline-offset-2">Sign up</Link> to keep your links and stats on any device.
          </div>
        )}

        <main className="flex-1">{page}</main>
      </div>
    </>
  )
}
