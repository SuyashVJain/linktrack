import { useEffect, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { addGuestLink, api, getGuestLinks } from './api.js'
import { loadGuest } from './Links.jsx'
import { Link, navigate } from './router.jsx'
import { CopyIcon, display, ErrorText, GuestBanner, Icon, Skeleton, useToast } from './ui.jsx'

const EMPTY = { target_url: '', slug: '', label: '' }

// Route a server message to the field it is about, so it shows next to that input.
function fieldFor(msg) {
  const m = msg.toLowerCase()
  if (m.includes('slug')) return 'slug'
  if (m.includes('url')) return 'url'
  if (m.includes('label')) return 'label'
  return 'form'
}

function CopyField({ value, label }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-1 pl-4 pr-1">
      <span className="min-w-0 flex-1 truncate font-mono text-base" aria-label={label}>{display(value)}</span>
      <CopyIcon text={value} label={`Copy ${label.toLowerCase()}`} />
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
      <div className="enter mb-8 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300"><Icon name="check" className="h-7 w-7" /></div>
        <div>
          <h1 className="display text-3xl sm:text-4xl">Link created</h1>
          <p className="text-base text-white/70">Your short link is ready to use.</p>
        </div>
      </div>
      <div className="glass-raised enter grid gap-8 p-6 sm:grid-cols-[1fr_auto] sm:p-8" style={{ '--d': '80ms' }}>
        <div className="min-w-0 space-y-6">
          <div>
            <p className="mb-2 text-base font-medium">Short link</p>
            <CopyField value={link.short_url} label="Short link" />
          </div>
          <div>
            <p className="mb-2 flex items-center gap-2 text-base font-medium">Private stats link <Icon name="info" className="h-4 w-4 text-white/60" /></p>
            <CopyField value={statsUrl} label="Stats link" />
            <p className="mt-2 inline-flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0" />
              {authed ? 'Anyone with this link can view stats and delete the link.' : 'Save this link. Anyone with it can view stats and delete the link.'}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4 sm:border-l sm:border-white/10 sm:pl-8">
          <p className="self-start text-base font-medium">QR code</p>
          <div className="rounded-xl bg-white p-2"><QRCodeCanvas ref={qr} value={link.short_url} size={144} marginSize={1} /></div>
          <button className="btn-ghost w-full" onClick={download}><Icon name="download" />Download PNG</button>
        </div>
      </div>
      <div className="enter mt-8 flex flex-col justify-center gap-4 sm:flex-row" style={{ '--d': '160ms' }}>
        <button className="btn-ghost !h-12 !px-6 !text-base" onClick={() => navigate(`/stats/${link.stats_token}`)}><Icon name="bars" />View stats</button>
        <button className="btn" onClick={onReset}><Icon name="plus" />Create another</button>
      </div>
    </section>
  )
}

// Shows up to 5 links from this browser or account, or a short hint when there are none.
function Recent({ authed }) {
  const [recent, setRecent] = useState(undefined)
  useEffect(() => {
    let live = true
    setRecent(undefined)
    const load = authed ? api('/links') : getGuestLinks().length ? loadGuest() : Promise.resolve([])
    load.then((l) => live && setRecent(l.slice(0, 5))).catch(() => live && setRecent(null))
    return () => { live = false }
  }, [authed])

  return (
    <div className="glass enter flex flex-1 flex-col p-6" style={{ '--d': '120ms' }}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium">Recent links</h2>
        {recent?.length > 0 && <Link to="/links" className="text-sm text-accent-soft hover:underline">View all</Link>}
      </div>
      {recent === undefined && <div className="space-y-4"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>}
      {recent === null && <p className="helper">Could not load your links right now. Try again in a moment.</p>}
      {recent?.length === 0 && (
        <div className="flex flex-1 flex-col items-start justify-center gap-2 py-4">
          <p className="text-base text-white/80">{authed ? 'No links in your account yet.' : 'No links yet.'}</p>
          <p className="helper">{authed ? 'Shorten a URL above and it will be listed here.' : 'Links you create show up here and stay in this browser until you sign up.'}</p>
        </div>
      )}
      {recent?.length > 0 && (
        <ul className="divide-y divide-white/10">
          {recent.map((l) => (
            <li key={l.stats_token} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <Link to={`/stats/${l.stats_token}`} className="block truncate font-mono text-base text-accent-soft hover:underline">{display(l.short_url)}</Link>
                <p className="truncate text-sm text-white/60">{l.target_url}</p>
              </div>
              <span className="shrink-0 font-mono text-base tabular-nums text-white/80">{l.clicks} <span className="text-sm text-white/60">clicks</span></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const STEPS = [
  ['link', 'Shorten', 'Paste a long URL and get a short link, with an optional custom slug.'],
  ['arrowRight', 'Share', 'Send the short link or its QR code anywhere. Visitors are redirected instantly.'],
  ['bars', 'Track', 'See total clicks, clicks per day and top referrers on the private stats page.'],
]
const PERKS = [['bolt', 'Shorten instantly'], ['bars', 'Track clicks'], ['layers', 'No signup required']]

export default function Landing({ authed }) {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})
  const [open, setOpen] = useState(() => matchMedia('(min-width: 1024px)').matches)
  const [link, setLink] = useState(null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setErrors({})
    setBusy(true)
    try {
      const l = await api('/links', { method: 'POST', body: form })
      if (!authed) addGuestLink(l)
      setLink(l)
      setForm(EMPTY)
      toast('Link created successfully')
      if (!authed) toast('This is a guest link. Sign up to keep it.', 'warning')
    } catch (err) {
      const f = fieldFor(err.message)
      if (f === 'slug' || f === 'label') setOpen(true)
      setErrors({ [f]: err.message })
    } finally {
      setBusy(false)
    }
  }

  if (link) return <Result link={link} authed={authed} onReset={() => setLink(null)} />

  // The server builds short_url from BASE_URL; before a link exists the page host is the best guess.
  const prefix = location.host + '/'
  const err = (k) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `err-${k}` : undefined })
  return (
    <section className="space-y-16">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-2 lg:items-stretch lg:gap-16">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:justify-between lg:gap-8 lg:pt-8">
          <div className="enter min-w-0 pt-2 lg:pt-0">
            <h1 className="display" style={{ fontSize: 'clamp(2.5rem, 1.2rem + 3.4vw, 5rem)' }}>Shorten URLs and <em>track</em> their performance.</h1>
            <p className="mt-6 max-w-lg text-lg text-white/70 lg:text-xl">Create short links, share them instantly, and see how they perform.</p>
          </div>
          <div className="min-w-0 space-y-6 max-lg:order-3">
            <ul className="enter flex flex-wrap gap-x-8 gap-y-2 text-base text-white/80" style={{ '--d': '100ms' }}>
              {PERKS.map(([i, t]) => <li key={t} className="flex items-center gap-2"><Icon name={i} className="h-5 w-5 text-accent-soft" />{t}</li>)}
            </ul>
            {!authed && <GuestBanner className="enter" />}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-8 max-lg:order-2">
          <form onSubmit={submit} noValidate className="glass-raised enter space-y-4 p-6 sm:p-8" style={{ '--d': '60ms' }}>
            <h2 className="flex items-center gap-2 text-xl font-medium"><Icon name="link" className="h-5 w-5 text-accent-soft" />Shorten a URL</h2>
            <div>
              <div className="flex flex-col gap-4 sm:flex-row">
                <label className="flex-1">
                  <span className="sr-only">URL to shorten</span>
                  <input className="field" type="url" required placeholder="Paste a long URL (e.g. https://example.com/...)" autoComplete="off"
                    value={form.target_url} onChange={set('target_url')} {...err('url')} />
                </label>
                <button className="btn sm:w-40" disabled={busy}>{busy ? 'Shortening…' : 'Shorten'}</button>
              </div>
              <ErrorText id="err-url">{errors.url}</ErrorText>
            </div>
            <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="group">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg py-1 text-base text-white/80 transition hover:text-white">
                Advanced <Icon name="chevron" className="h-4 w-4 transition group-open:rotate-180" />
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="slug" className="mb-2 block text-sm text-white/70">Custom slug (optional)</label>
                  <div className="flex h-12 items-center rounded-xl border border-white/10 bg-white/[0.04] pl-4 transition focus-within:border-accent-soft/70 focus-within:ring-2 focus-within:ring-accent-soft/30 has-[[aria-invalid=true]]:border-red-400/60">
                    <span className="shrink-0 font-mono text-sm text-white/60">{prefix}</span>
                    <input id="slug" className="h-full w-full min-w-0 bg-transparent px-1 pr-4 font-mono text-base text-white outline-none placeholder-white/40" placeholder="my-link" autoComplete="off"
                      value={form.slug} onChange={set('slug')} {...err('slug')} />
                  </div>
                  <ErrorText id="err-slug">{errors.slug}</ErrorText>
                </div>
                <div>
                  <label htmlFor="label" className="mb-2 block text-sm text-white/70">Label (optional)</label>
                  <input id="label" className="field" placeholder="e.g. portfolio, campaign" value={form.label} onChange={set('label')} {...err('label')} />
                  <ErrorText id="err-label">{errors.label}</ErrorText>
                </div>
              </div>
            </details>
            <ErrorText id="err-form">{errors.form}</ErrorText>
          </form>
          <Recent authed={authed} />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-medium text-white/80">How it works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map(([i, title, text], n) => (
            <div key={title} className="glass enter p-6" style={{ '--d': `${n * 80}ms` }}>
              <div className="mb-4 flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 text-accent-soft"><Icon name={i} className="h-6 w-6" /></span>
                <h3 className="text-xl font-medium">{n + 1}. {title}</h3>
              </div>
              <p className="text-base text-white/70">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
