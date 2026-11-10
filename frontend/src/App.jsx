import { useEffect, useState } from 'react'
import { getToken, setToken } from './api.js'
import { Link, navigate, usePath } from './router.jsx'
import { Icon, Logo } from './ui.jsx'
import Landing from './Landing.jsx'
import Links from './Links.jsx'
import AuthPage from './AuthPage.jsx'
import Stats from './Stats.jsx'
import NotFound from './NotFound.jsx'

function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#060b1a]" aria-hidden>
      <div className="absolute -left-40 bottom-0 h-[32rem] w-[32rem] rounded-full bg-blue-600/25 blur-[120px]" />
      <div className="absolute -right-40 -top-20 h-[28rem] w-[28rem] rounded-full bg-indigo-600/20 blur-[120px]" />
    </div>
  )
}

const TITLES = { '/': 'LinkTrack - Short links with click stats', '/links': 'My links - LinkTrack', '/login': 'Log in - LinkTrack', '/register': 'Create account - LinkTrack' }

export default function App() {
  const [authed, setAuthed] = useState(!!getToken())
  const [menu, setMenu] = useState(false)
  const path = usePath()

  useEffect(() => {
    const out = () => setAuthed(false)
    addEventListener('logout', out)
    return () => removeEventListener('logout', out)
  }, [])
  useEffect(() => setMenu(false), [path])

  const stats = path.match(/^\/stats\/([A-Za-z0-9_-]+)$/)
  let page
  if (path === '/login' || path === '/register') page = <AuthPage mode={path.slice(1)} onAuth={() => setAuthed(true)} />
  else if (path === '/links') page = <Links authed={authed} />
  else if (stats) page = <Stats token={stats[1]} authed={authed} />
  else if (path === '/') page = <Landing authed={authed} />
  else page = <NotFound />

  useEffect(() => {
    document.title = stats ? 'Link stats - LinkTrack' : TITLES[path] || 'Page not found - LinkTrack'
  }, [path, stats])

  // There is no account-wide stats page, so "Stats" only appears while viewing one link's stats.
  const tabs = [['/', 'Home'], ['/links', 'My Links'], ...(stats ? [[path, 'Stats']] : [])]
  const tab = (to, label) => (
    <Link key={to} to={to} className={`border-b-2 py-1 text-base transition ${path === to ? 'border-accent-soft text-white' : 'border-transparent text-white/70 hover:text-white'}`}>{label}</Link>
  )
  const logout = () => { setToken(null); setAuthed(false); navigate('/') }

  const auth = authed ? (
    <button className="btn-ghost" onClick={logout}>Log out</button>
  ) : (
    <>
      <Link to="/login" className="btn-ghost">Log in</Link>
      <Link to="/register" className="btn !h-10 !px-4 !text-sm">Sign up</Link>
    </>
  )

  return (
    <>
      <Background />
      <div className="shell flex min-h-screen flex-col py-6">
        <header className="glass relative mb-8 flex items-center justify-between px-4 py-2 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold" >
            <Logo className="h-8 w-8" /><span>LinkTrack</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Main">{tabs.map(([to, l]) => tab(to, l))}</nav>
          <div className="hidden items-center gap-2 md:flex">{auth}</div>
          <button className="icon-btn md:hidden" onClick={() => setMenu(!menu)} aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu}><Icon name={menu ? 'x' : 'menu'} className="h-6 w-6" /></button>
          {menu && (
            <div className="glass-raised pop absolute inset-x-0 top-full z-30 mt-2 flex flex-col gap-4 bg-[#0c1428]/95 p-6 md:hidden">
              {tabs.map(([to, l]) => <Link key={to} to={to} className={`text-lg ${path === to ? 'text-white' : 'text-white/70'}`}>{l}</Link>)}
              <div className="flex gap-2 [&>*]:flex-1">{auth}</div>
            </div>
          )}
        </header>
        <main className="flex-1"><div key={path} className="enter">{page}</div></main>
        <footer className="mt-16 border-t border-white/10 py-6 text-sm text-white/60">LinkTrack. Short links with click stats.</footer>
      </div>
    </>
  )
}
