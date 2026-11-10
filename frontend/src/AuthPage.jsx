import { useState } from 'react'
import { api, claimGuestLinks, setToken } from './api.js'
import { Link, navigate } from './router.jsx'
import { ErrorText, useToast } from './ui.jsx'

export default function AuthPage({ mode, onAuth }) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  return (
    <form onSubmit={submit} className="glass mx-auto mt-6 max-w-sm space-y-4 p-6 sm:mt-12">
      <h1 className="text-2xl font-semibold">{login ? 'Log in' : 'Create an account'}</h1>
      <p className="text-sm text-white/60">{login ? 'Welcome back.' : 'Links you made as a guest on this device are saved to your account.'}</p>
      <input className="field" type="email" placeholder="Email" required autoComplete="email" aria-label="Email"
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="field" type="password" placeholder="Password (min 8 characters)" required minLength={8} aria-label="Password"
        autoComplete={login ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      <button className="btn w-full" disabled={busy}>{login ? 'Log in' : 'Sign up'}</button>
      <p className="text-center text-sm text-white/60">
        {login ? <>No account? <Link to="/register" className="text-violet-300 hover:underline">Sign up</Link></>
          : <>Have an account? <Link to="/login" className="text-violet-300 hover:underline">Log in</Link></>}
      </p>
    </form>
  )
}
