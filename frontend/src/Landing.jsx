import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { addGuestLink, api } from './api.js'
import { Link, navigate } from './router.jsx'
import { copyText, display, ErrorText, GuestBanner, Icon, useToast } from './ui.jsx'

const EMPTY = { target_url: '', slug: '', label: '' }

function CopyField({ value }) {
  const toast = useToast()
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <span className="min-w-0 flex-1 truncate font-mono text-sm">{display(value)}</span>
      <button onClick={() => copyText(toast, value)} aria-label="Copy" className="text-white/60 transition hover:text-white"><Icon name="copy" /></button>
    </div>
  )
}

function Result({ link, authed, onReset }) {
  const qr = useRef(null)
  const statsUrl = `${location.origin}/app/stats/${link.stats_token}`
  const download = () => {
    const a = document.createElement('a')
    a.href = qr.current.toDataURL('image/png')
    a.download = `${link.slug}-qr.png`
    a.click()
  }
  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300"><Icon name="check" className="h-6 w-6" /></div>
        <div>
          <h1 className="display text-3xl">Link created</h1>
          <p className="text-sm text-white/60">Your short link is ready to use.</p>
        </div>
      </div>
      <div className="glass grid gap-6 p-5 sm:grid-cols-[1fr_auto] sm:p-6">
        <div className="min-w-0 space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium">Short link</p>
            <CopyField value={link.short_url} />
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">Private stats link <Icon name="info" className="h-3.5 w-3.5 text-white/40" /></p>
            <CopyField value={statsUrl} />
            <p className="mt-2 inline-flex items-center gap-2 rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
              <Icon name="lock" className="h-3.5 w-3.5" />
              {authed ? 'Anyone with this link can view stats and delete the link.' : 'Save this link. Anyone with it can view stats and delete the link.'}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 sm:border-l sm:border-white/10 sm:pl-6">
          <p className="self-start text-sm font-medium">QR code</p>
          <div className="rounded-lg bg-white p-2"><QRCodeCanvas ref={qr} value={link.short_url} size={140} marginSize={1} /></div>
          <button className="btn-ghost w-full" onClick={download}><Icon name="download" />Download PNG</button>
        </div>
      </div>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <button className="btn-ghost justify-center py-2.5" onClick={() => navigate(`/stats/${link.stats_token}`)}><Icon name="bars" />View stats</button>
        <button className="btn justify-center" onClick={onReset}><Icon name="plus" />Create another</button>
      </div>
    </section>
  )
}

export default function Landing({ authed }) {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
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
      setForm(EMPTY)
      toast('Link created successfully')
      if (!authed) toast('This is a guest link. Sign up to keep it.', 'warning')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (link) return <Result link={link} authed={authed} onReset={() => setLink(null)} />

  // The server builds short_url from BASE_URL; before a link exists the page host is the best guess.
  const prefix = location.host + '/'
  const perks = [['bolt', 'Shorten instantly'], ['bars', 'Track clicks'], ['layers', 'No signup required']]
  return (
    <section>
      <div className="grid items-center gap-10 pt-4 lg:grid-cols-2 lg:pt-10">
        <div>
          <h1 className="display text-4xl sm:text-5xl lg:text-6xl">Shorten URLs and <em>track</em> their performance.</h1>
          <p className="mt-4 max-w-md text-white/60">Create short links, share them instantly, and see how they perform.</p>
          <ul className="mt-8 hidden space-y-4 text-sm text-white/80 lg:block">
            {perks.map(([i, t]) => <li key={t} className="flex items-center gap-3"><Icon name={i} className="h-5 w-5 text-white/60" />{t}</li>)}
          </ul>
        </div>

        <form onSubmit={submit} className="glass space-y-4 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-medium"><Icon name="link" className="h-5 w-5 text-accent" />Shorten a URL</h2>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <input className="field" type="url" required placeholder="Paste a long URL (e.g. https://example.com/...)" aria-label="URL to shorten"
              value={form.target_url} onChange={set('target_url')} />
            <button className="btn px-5" disabled={busy}>{busy ? 'Shortening…' : 'Shorten'}</button>
          </div>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-white/70 transition hover:text-white">
              Advanced <Icon name="chevron" className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-white/50">Custom slug (optional)
                <div className="mt-1 flex items-center rounded-lg border border-white/10 bg-white/[0.04] pl-3 focus-within:border-accent/70 focus-within:ring-2 focus-within:ring-accent/25">
                  <span className="truncate font-mono text-xs text-white/50">{prefix}</span>
                  <input className="w-full min-w-0 bg-transparent py-2.5 pr-3 font-mono text-sm text-white outline-none placeholder-white/30" placeholder="my-link" value={form.slug} onChange={set('slug')} />
                </div>
              </label>
              <label className="text-xs text-white/50">Label (optional)
                <input className="field mt-1" placeholder="e.g. portfolio, campaign" value={form.label} onChange={set('label')} />
              </label>
            </div>
          </details>
          <ErrorText>{error}</ErrorText>
        </form>
      </div>
      {!authed && <GuestBanner className="mt-8" />}
    </section>
  )
}
