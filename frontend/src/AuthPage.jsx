import { useState } from 'react'
import { api, claimGuestLinks, setToken } from './api.js'
import { Link, navigate } from './router.jsx'
import { ErrorText, Icon, useToast } from './ui.jsx'

export default function AuthPage({ mode, onAuth }) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const login = mode === 'login'

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { token } = await api('/auth/' + mode, { method: 'POST', body: { email, password } })
      setToken(token)
      onAuth()
      // Claiming is best effort: a failure must not block the login that just succeeded.
      const n = await claimGuestLinks().catch(() => 0)
      if (n > 0) toast(`${n} link${n === 1 ? '' : 's'} saved to your account`)
      navigate('/links')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const tab = (to, label, active) => (
    <Link to={to} className={`flex-1 border-b-2 py-3 text-center text-sm transition ${active ? 'border-accent text-white' : 'border-transparent text-white/50 hover:text-white'}`}>{label}</Link>
  )
  return (
    <section className="grid items-center gap-10 pt-2 lg:grid-cols-2 lg:pt-10">
      <div className="hidden lg:block">
        <h1 className="display text-5xl">Your guest links will be <em>saved</em> to your account.</h1>
        <p className="mt-4 max-w-sm text-white/60">Links you created in this browser are moved to your account when you sign in.</p>
      </div>
      <div className="glass mx-auto w-full max-w-md overflow-hidden">
        <div className="flex border-b border-white/10">{tab('/login', 'Log in', login)}{tab('/register', 'Create account', !login)}</div>
        <form onSubmit={submit} className="space-y-4 p-6">
          <label className="block text-sm">Email
            <div className="relative mt-1.5">
              <Icon name="mail" className="absolute left-3 top-3 h-4 w-4 text-white/40" />
              <input className="field pl-10" type="email" placeholder="you@example.com" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </label>
          <label className="block text-sm">Password
            <div className="relative mt-1.5">
              <Icon name="lock" className="absolute left-3 top-3 h-4 w-4 text-white/40" />
              <input className="field pl-10 pr-10" type={show ? 'text' : 'password'} placeholder="At least 8 characters" required minLength={8}
                autoComplete={login ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="absolute right-3 top-3 text-white/50 hover:text-white" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
                <Icon name={show ? 'eyeOff' : 'eye'} />
              </button>
            </div>
          </label>
          <ErrorText>{error}</ErrorText>
          <button className="btn w-full py-3" disabled={busy}>{login ? 'Log in' : 'Create account'}</button>
          <p className="text-center text-xs text-white/50">Your guest links will be saved to your account.</p>
        </form>
      </div>
    </section>
  )
}
