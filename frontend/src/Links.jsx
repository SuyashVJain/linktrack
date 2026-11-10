import { useEffect, useState } from 'react'
import { api, getGuestLinks, removeGuestLink } from './api.js'
import { Link } from './router.jsx'
import { ConfirmModal, CopyIcon, display, GuestBanner, Icon, Skeleton, useToast } from './ui.jsx'

const TREND_LIMIT = 50 // signed-in lists fetch one stats request per row; cap it

// Guests: look up each stored stats token (this also gives clicks per day).
export async function loadGuest() {
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
  if (!days) return <span className="text-white/40" aria-hidden="true">-</span>
  const W = 80, H = 24
  const max = Math.max(1, ...days.map((d) => d.clicks))
  const pts = days.map((d, i) => `${(i / (days.length - 1)) * W},${H - 2 - (d.clicks / max) * (H - 4)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-6 w-20" role="img" aria-label="Clicks per day, last 30 days">
      <polyline points={pts} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const COLS = 'md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_8rem_4.5rem_6rem_6.5rem]'

function ListSkeleton() {
  return (
    <div className="glass divide-y divide-white/10" aria-busy="true" aria-label="Loading links">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 p-6"><Skeleton className="h-6 flex-1" /><Skeleton className="hidden h-6 w-1/4 sm:block" /><Skeleton className="h-6 w-16" /></div>
      ))}
    </div>
  )
}

export default function Links({ authed }) {
  const toast = useToast()
  const [links, setLinks] = useState(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [del, setDel] = useState(null)

  async function load() {
    setError('')
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
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl sm:text-5xl">My Links</h1>
          <p className="mt-2 text-base text-white/70">All your shortened links in one place.</p>
        </div>
        <div className="flex w-full gap-4 sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Icon name="search" className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-white/60" />
            <input className="field pl-12" type="search" placeholder="Search a link..." aria-label="Search links" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Link to="/" className="btn whitespace-nowrap"><Icon name="plus" />New link</Link>
        </div>
      </div>

      {!authed && <GuestBanner className="mb-8" />}

      {error && (
        <div className="glass flex flex-col items-center gap-4 p-8 text-center sm:p-16" role="alert">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/15 text-red-300"><Icon name="alert" className="h-6 w-6" /></div>
          <p className="text-lg font-medium">We could not load your links</p>
          <p className="helper max-w-md">{error}</p>
          <button className="btn-ghost" onClick={() => { setLinks(null); load() }}><Icon name="refresh" />Try again</button>
        </div>
      )}
      {!links && !error && <ListSkeleton />}

      {links && links.length === 0 && (
        <div className="glass flex w-full flex-col items-center p-8 text-center sm:p-20">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent/20 text-accent-soft"><Icon name="link" className="h-7 w-7" /></div>
          <p className="text-xl font-medium">No links yet</p>
          <p className="mt-2 max-w-md text-base text-white/70">{authed ? 'Create your first short link and it will appear here with its click stats.' : 'Links you create as a guest are listed here, in this browser only. Create one to get started.'}</p>
          <Link to="/" className="btn mt-6"><Icon name="plus" />Create link</Link>
        </div>
      )}

      {links && links.length > 0 && (
        <div className="glass enter overflow-hidden">
          <div className={`hidden gap-4 border-b border-white/10 px-6 py-4 text-sm font-medium text-white/60 md:grid ${COLS}`}>
            <span>Short link</span><span>Destination</span><span>Label</span><span>Clicks</span><span>Trend</span><span className="text-right">Actions</span>
          </div>
          {shown.length === 0 && <p className="p-6 text-base text-white/70">No links match &ldquo;{query}&rdquo;.</p>}
          <ul className="divide-y divide-white/10">
            {shown.map((l, i) => (
              <li key={l.stats_token} className={`enter grid items-center gap-x-4 gap-y-2 px-6 py-4 transition hover:bg-white/[0.04] ${COLS}`} style={{ '--d': `${Math.min(i, 8) * 40}ms` }}>
                <div className="flex min-w-0 items-center gap-2 font-mono text-base">
                  <Link to={`/stats/${l.stats_token}`} className="truncate text-accent-soft hover:underline">{display(l.short_url)}</Link>
                  <a href={l.short_url} target="_blank" rel="noreferrer" aria-label={`Open ${display(l.short_url)} in a new tab`} className="shrink-0 text-white/60 transition hover:text-white"><Icon name="external" className="h-4 w-4" /></a>
                </div>
                <p className="truncate text-base text-white/70">{l.target_url}</p>
                <div className="flex items-center">{l.label && <span className="inline-block max-w-full truncate rounded-lg bg-accent/20 px-2 py-1 text-sm text-blue-200">{l.label}</span>}</div>
                <span className="font-mono text-base tabular-nums">{l.clicks}<span className="text-sm text-white/60 md:hidden"> clicks</span></span>
                <Sparkline days={l.days} />
                <div className="flex justify-start gap-1 md:justify-end">
                  <CopyIcon text={l.short_url} label={`Copy ${display(l.short_url)}`} />
                  <button onClick={() => setDel(l)} aria-label={`Delete ${display(l.short_url)}`} className="icon-btn hover:!bg-red-500/15 hover:!text-red-300"><Icon name="trash" className="h-5 w-5" /></button>
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-white/10 px-6 py-4 text-sm text-white/60">Showing {shown.length} link{shown.length === 1 ? '' : 's'}</p>
        </div>
      )}

      {del && <ConfirmModal title="Delete link?" body={`This will permanently remove ${display(del.short_url)} and its analytics.`} onConfirm={remove} onCancel={() => setDel(null)} />}
    </section>
  )
}
