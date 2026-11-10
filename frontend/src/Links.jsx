import { useEffect, useState } from 'react'
import { api, getGuestLinks, removeGuestLink } from './api.js'
import { Link } from './router.jsx'
import { ConfirmModal, copyText, display, ErrorText, GuestBanner, Icon, Spinner, useToast } from './ui.jsx'

const TREND_LIMIT = 50 // signed-in lists fetch one stats request per row; cap it

// Guests: look up each stored stats token (this also gives clicks per day).
async function loadGuest() {
  const results = await Promise.all(
    getGuestLinks().map((g) =>
      api('/stats/' + g.stats_token)
        .then((s) => ({ ...s.link, days: s.clicks_per_day }))
        .catch(() => { removeGuestLink(g.stats_token); return null }), // deleted elsewhere
    ),
  )
  return results.filter(Boolean)
}

function Sparkline({ days }) {
  if (!days) return <span className="text-white/20">-</span>
  const W = 80, H = 24
  const max = Math.max(1, ...days.map((d) => d.clicks))
  const pts = days.map((d, i) => `${(i / (days.length - 1)) * W},${H - 2 - (d.clicks / max) * (H - 4)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-6 w-20" role="img" aria-label="Clicks, last 30 days">
      <polyline points={pts} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const COLS = 'md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_7rem_4rem_5.5rem_5rem]'

export default function Links({ authed }) {
  const toast = useToast()
  const [links, setLinks] = useState(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [del, setDel] = useState(null)

  async function load() {
    try {
      const list = authed ? await api('/links') : await loadGuest()
      setLinks(list)
      if (authed) {
        // Trend data comes from the per-link stats endpoint; rows render first, sparklines fill in.
        const days = await Promise.all(list.slice(0, TREND_LIMIT).map((l) =>
          api('/stats/' + l.stats_token).then((s) => s.clicks_per_day).catch(() => null)))
        setLinks(list.map((l, i) => ({ ...l, days: days[i] })))
      }
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => { setLinks(null); load() }, [authed])

  async function remove() {
    const l = del
    setDel(null)
    try {
      await api(authed ? `/links/${l.id}` : `/stats/${l.stats_token}`, { method: 'DELETE' })
      removeGuestLink(l.stats_token)
      setLinks((ls) => ls.filter((x) => x.stats_token !== l.stats_token))
      toast('Link deleted', 'error')
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const q = query.trim().toLowerCase()
  const shown = (links || []).filter((l) => !q || [l.slug, l.short_url, l.target_url, l.label].some((v) => v.toLowerCase().includes(q)))

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl">My Links</h1>
          <p className="mt-1 text-sm text-white/60">All your shortened links in one place.</p>
        </div>
        <div className="flex w-full gap-3 sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Icon name="search" className="absolute left-3 top-3 h-4 w-4 text-white/40" />
            <input className="field pl-9" placeholder="Search a link..." aria-label="Search links" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Link to="/" className="btn whitespace-nowrap"><Icon name="plus" />New link</Link>
        </div>
      </div>

      {!authed && <GuestBanner className="mb-6" />}
      <ErrorText>{error}</ErrorText>
      {!links && !error && <Spinner />}

      {links && links.length === 0 && (
        <div className="glass mx-auto flex max-w-sm flex-col items-center p-10 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent"><Icon name="link" className="h-6 w-6" /></div>
          <p className="font-medium">No links yet</p>
          <p className="mt-1 text-sm text-white/60">Create your first short link to see it here.</p>
          <Link to="/" className="btn mt-5"><Icon name="plus" />Create link</Link>
        </div>
      )}

      {links && links.length > 0 && (
        <div className="glass overflow-hidden">
          <div className={`hidden gap-4 border-b border-white/10 px-5 py-3 text-xs font-medium text-white/50 md:grid ${COLS}`}>
            <span>Short link</span><span>Destination</span><span>Label</span><span>Clicks</span><span>Trend</span><span className="text-right">Actions</span>
          </div>
          {shown.length === 0 && <p className="p-6 text-sm text-white/60">No links match your search.</p>}
          <ul className="divide-y divide-white/10">
            {shown.map((l) => (
              <li key={l.stats_token} className={`grid items-center gap-x-4 gap-y-2 px-5 py-4 transition hover:bg-white/[0.04] ${COLS}`}>
                <div className="flex min-w-0 items-center gap-2 font-mono text-sm">
                  <Link to={`/stats/${l.stats_token}`} className="truncate text-blue-300 hover:underline">{display(l.short_url)}</Link>
                  <a href={l.short_url} target="_blank" rel="noreferrer" aria-label="Open short link" className="shrink-0 text-white/40 hover:text-white"><Icon name="external" className="h-3.5 w-3.5" /></a>
                </div>
                <p className="truncate text-sm text-white/70">{l.target_url}</p>
                <div>{l.label && <span className="inline-block max-w-full truncate rounded-md bg-accent/15 px-2 py-0.5 text-xs text-blue-200">{l.label}</span>}</div>
                <span className="font-mono text-sm tabular-nums">{l.clicks}<span className="text-white/40 md:hidden"> clicks</span></span>
                <Sparkline days={l.days} />
                <div className="flex justify-start gap-3 text-white/60 md:justify-end">
                  <button onClick={() => copyText(toast, l.short_url)} aria-label="Copy link" className="transition hover:text-white"><Icon name="copy" className="h-[18px] w-[18px]" /></button>
                  <button onClick={() => setDel(l)} aria-label="Delete link" className="transition hover:text-red-300"><Icon name="trash" className="h-[18px] w-[18px]" /></button>
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-white/10 px-5 py-3 text-xs text-white/50">Showing {shown.length} link{shown.length === 1 ? '' : 's'}</p>
        </div>
      )}

      {del && <ConfirmModal title="Delete link?" body={`This will permanently remove ${display(del.short_url)} and its analytics.`} onConfirm={remove} onCancel={() => setDel(null)} />}
    </section>
  )
}
