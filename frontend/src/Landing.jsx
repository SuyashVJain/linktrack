import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { addGuestLink, api } from './api.js'
import { Link } from './router.jsx'
import { CopyButton, ErrorText } from './ui.jsx'

function Result({ link }) {
  const qr = useRef(null)
  const statsUrl = `${location.origin}/app/stats/${link.stats_token}`
  const download = () => {
    const a = document.createElement('a')
    a.href = qr.current.toDataURL('image/png')
    a.download = `${link.slug}-qr.png`
    a.click()
  }
  return (
    <div className="glass mt-8 grid gap-6 p-6 text-left sm:grid-cols-[1fr_auto]">
      <div className="min-w-0 space-y-4">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wider text-white/50">Short link</p>
          <div className="flex flex-wrap items-center gap-3">
            <a href={link.short_url} target="_blank" rel="noreferrer" className="truncate text-lg font-medium text-violet-300 hover:underline">{link.short_url}</a>
            <CopyButton text={link.short_url} />
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs uppercase tracking-wider text-white/50">Private stats link</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link to={`/stats/${link.stats_token}`} className="truncate text-sm text-white/80 hover:underline">{statsUrl}</Link>
            <CopyButton text={statsUrl} />
          </div>
          <p className="mt-1 text-xs text-white/40">Anyone with this link can view stats and delete the link. Keep it private.</p>
        </div>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-xl bg-white p-2">
          <QRCodeCanvas ref={qr} value={link.short_url} size={144} marginSize={1} />
        </div>
        <button className="btn-ghost" onClick={download}>Download QR</button>
      </div>
    </div>
  )
}

export default function Landing({ authed }) {
  const [form, setForm] = useState({ target_url: '', slug: '', label: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [link, setLink] = useState(null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const l = await api('/links', { method: 'POST', body: form })
      if (!authed) addGuestLink(l)
      setLink(l)
      setForm({ target_url: '', slug: '', label: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="pt-6 text-center sm:pt-14">
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
        Short links.<br /><span className="bg-gradient-to-r from-violet-300 to-indigo-300 bg-clip-text text-transparent">Real numbers.</span>
      </h1>
      <p className="mx-auto mt-4 max-w-md text-white/60">Shorten a URL, share it, and see how many people clicked and where they came from. No account needed.</p>

      <form onSubmit={submit} className="glass mx-auto mt-10 space-y-4 p-4 text-left sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input className="field" type="url" required placeholder="https://example.com/a/very/long/url" aria-label="URL to shorten"
            value={form.target_url} onChange={set('target_url')} />
          <button className="btn sm:w-40" disabled={busy}>{busy ? 'Shortening…' : 'Shorten'}</button>
        </div>
        <details className="group">
          <summary className="cursor-pointer select-none text-sm text-white/50 transition hover:text-white/80">Advanced</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input className="field" placeholder="Custom slug (optional)" aria-label="Custom slug" value={form.slug} onChange={set('slug')} />
            <input className="field" placeholder="Label (optional)" aria-label="Label" value={form.label} onChange={set('label')} />
          </div>
        </details>
        <ErrorText>{error}</ErrorText>
      </form>

      {link && <Result link={link} />}
    </section>
  )
}
