import { useState } from 'react'
import { api, setToken } from './api.js'

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      const { token } = await api('/auth/' + mode, { method: 'POST', body: { email, password } })
      setToken(token)
      onAuth()
    } catch (err) {
      setError(err.message)
    }
  }

  const input = 'w-full rounded border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none'
  return (
    <form onSubmit={submit} className="mx-auto mt-24 w-full max-w-sm space-y-4 px-4">
      <h1 className="text-2xl font-semibold">linktrack</h1>
      <p className="text-sm text-slate-500">{mode === 'login' ? 'Log in to your account.' : 'Create an account.'}</p>
      <input className={input} type="email" placeholder="Email" required autoComplete="email"
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={input} type="password" placeholder="Password (min 8 characters)" required minLength={8}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className="w-full rounded bg-slate-900 py-2 text-white hover:bg-slate-700">
        {mode === 'login' ? 'Log in' : 'Register'}
      </button>
      <button type="button" className="text-sm text-slate-500 hover:text-slate-900"
        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
        {mode === 'login' ? 'No account yet? Register' : 'Have an account? Log in'}
      </button>
    </form>
  )
}
