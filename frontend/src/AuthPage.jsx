import { useState } from 'react'
import { api, claimGuestLinks, setToken } from './api.js'
import { Link, navigate } from './router.jsx'
import { ErrorText, Icon, useToast } from './ui.jsx'

// Route a server message to the field it is about, so it shows next to that input.
function fieldFor(msg) {
  const m = msg.toLowerCase()
  if (m.includes('invalid email or password')) return 'form'
  if (m.includes('email')) return 'email'
  if (m.includes('password')) return 'password'
  return 'form'
}

export default function AuthPage({ mode, onAuth }) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const login = mode === 'login'

  async function submit(e) {
    e.preventDefault()
    setErrors({})
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
      setErrors({ [fieldFor(err.message)]: err.message })
      setBusy(false)
    }
  }

  const tab = (to, label, active) => (
    <Link to={to} className={`flex-1 border-b-2 py-4 text-center text-base transition ${active ? 'border-accent-soft text-white' : 'border-transparent text-white/70 hover:text-white'}`}>{label}</Link>
  )
  const err = (k) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `err-${k}` : undefined })
  return (
    <section className="grid items-start gap-8 pt-2 lg:grid-cols-2 lg:items-center lg:gap-16 lg:pt-8">
      <div className="hidden lg:block">
        <h1 className="display" style={{ fontSize: 'clamp(2.5rem, 1.2rem + 3vw, 4.5rem)' }}>Your guest links will be <em>saved</em> to your account.</h1>
        <p className="mt-6 max-w-md text-lg text-white/70">Links you created in this browser are moved to your account when you sign in.</p>
      </div>
      <div className="glass-raised mx-auto w-full max-w-md overflow-hidden lg:mx-0 lg:ml-auto">
        <div className="flex border-b border-white/10" role="tablist">{tab('/login', 'Log in', login)}{tab('/register', 'Create account', !login)}</div>
        <form onSubmit={submit} noValidate className="space-y-6 p-6 sm:p-8">
          <div>
            <label htmlFor="email" className="mb-2 block text-base">Email</label>
            <div className="relative">
              <Icon name="mail" className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-white/60" />
              <input id="email" className="field pl-12" type="email" placeholder="you@example.com" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} {...err('email')} />
            </div>
            <ErrorText id="err-email">{errors.email}</ErrorText>
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-base">Password</label>
            <div className="relative">
              <Icon name="lock" className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-white/60" />
              <input id="password" className="field pl-12 pr-14" type={show ? 'text' : 'password'} placeholder="At least 8 characters" required
                autoComplete={login ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} {...err('password')} />
              <button type="button" className="icon-btn absolute right-1 top-1" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
                <Icon name={show ? 'eyeOff' : 'eye'} />
              </button>
            </div>
            <ErrorText id="err-password">{errors.password}</ErrorText>
          </div>
          <ErrorText id="err-form">{errors.form}</ErrorText>
          <button className="btn w-full" disabled={busy}>{busy ? 'Please wait…' : login ? 'Log in' : 'Create account'}</button>
          <p className="helper text-center">Your guest links will be saved to your account.</p>
        </form>
      </div>
    </section>
  )
}
