import { useEffect, useState } from 'react'
import { api, removeGuestLink } from './api.js'
import { Link, navigate } from './router.jsx'
import { ConfirmModal, CopyButton, display, Icon, Skeleton, useToast } from './ui.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtDay = (d) => `${MONTHS[+d.slice(5, 7) - 1]} ${+d.slice(8)}`

function BarChart({ data }) {
  const W = 640, H = 180, L = 28, B = 24, T = 8, gap = 4
  const max = Math.max(1, ...data.map((d) => d.clicks))
  const top = max <= 4 ? max : Math.ceil(max / 4) * 4 // round the axis so ticks are whole numbers
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, 1, 2, 3, 4].map((i) => (top / 4) * i)
  const bw = (W - L) / data.length - gap
  const y = (v) => T + H - (v / top) * H
  return (
    <svg viewBox={`0 0 ${W} ${T + H + B}`} className="w-full" role="img" aria-label={`Clicks per day for the last 30 days, ${data.reduce((n, d) => n + d.clicks, 0)} in total`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="white" strokeOpacity="0.08" />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" className="fill-white/60 font-mono text-[11px] max-sm:text-[18px]">{t}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = L + i * (bw + gap)
        return (
          <g key={d.day} className="group">
            <rect x={x} y={T} width={bw + gap} height={H} fill="transparent" />
            {d.clicks > 0 && <rect x={x} y={y(d.clicks)} width={bw} height={T + H - y(d.clicks)} rx="2" className="bar fill-blue-500 transition-colors group-hover:fill-blue-300" style={{ '--i': i }} />}
            {i % 4 === 0 && <text x={x + bw / 2} y={T + H + 18} textAnchor="middle" className="fill-white/60 font-mono text-[11px] max-sm:text-[18px]">{fmtDay(d.day)}</text>}
            <title>{`${fmtDay(d.day)}: ${d.clicks} click${d.clicks === 1 ? '' : 's'}`}</title>
          </g>
        )
      })}
    </svg>
  )
}

const Card = ({ label, children, delay }) => (
  <div className="glass enter p-6" style={{ '--d': delay }}>
    <p className="text-sm text-white/60">{label}</p>
    <p className="mt-2 font-mono text-4xl tabular-nums">{children}</p>
  </div>
)

function StatsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading stats">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
    </div>
  )
}

export default function Stats({ token, authed }) {
  const toast = useToast()
  const [s, setS] = useState(null)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    setS(null)
    setError(null)
    api('/stats/' + token).then(setS).catch((e) => setError({ missing: e.message === 'not found', text: e.message }))
  }, [token])

  async function remove() {
    setConfirm(false)
    try {
      await api('/stats/' + token, { method: 'DELETE' })
      removeGuestLink(token)
      toast('Link deleted', 'error')
      navigate('/links')
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  if (error) {
    return (
      <div className="glass mx-auto flex max-w-xl flex-col items-center gap-4 p-8 text-center sm:p-16" role="alert">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/15 text-red-300"><Icon name="alert" className="h-6 w-6" /></div>
        <h1 className="text-xl font-medium">{error.missing ? 'This link does not exist' : 'We could not load these stats'}</h1>
        <p className="helper max-w-md">{error.missing ? 'It may have been deleted, or the stats address has a typo. Check the link you saved and try again.' : error.text}</p>
        <Link to="/links" className="btn-ghost">Back to my links</Link>
      </div>
    )
  }
  if (!s) return <StatsSkeleton />
  const { link } = s
  const total30 = s.clicks_per_day.reduce((n, d) => n + d.clicks, 0)
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/links" className="icon-btn" aria-label="Back to my links"><Icon name="arrowLeft" className="h-5 w-5" /></Link>
          <h1 className="truncate font-mono text-xl text-accent-soft"><a href={link.short_url} target="_blank" rel="noreferrer" className="hover:underline">{display(link.short_url)}</a></h1>
        </div>
        <div className="flex gap-2">
          <CopyButton text={link.short_url} />
          <button className="btn-danger" onClick={() => setConfirm(true)}><Icon name="trash" />Delete</button>
        </div>
      </div>
      <p className="-mt-2 truncate text-base text-white/60">{link.label ? `${link.label} · ` : ''}{link.target_url}</p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card label="Total clicks" delay="0ms">{s.total_clicks}</Card>
        <Card label="Last 30 days" delay="60ms">{total30}</Card>
        <Card label="Created" delay="120ms"><span className="text-2xl">{new Date(link.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="glass enter p-6" style={{ '--d': '180ms' }}>
          <h2 className="mb-4 text-lg font-medium">Clicks (last 30 days)</h2>
          <BarChart data={s.clicks_per_day} />
        </div>
        <div className="glass enter p-6" style={{ '--d': '240ms' }}>
          <h2 className="mb-4 text-lg font-medium">Top referrers</h2>
          {s.top_referrers.length === 0 ? (
            <p className="text-base text-white/70">No clicks yet. Share your short link and referrers will show up here.</p>
          ) : (
            <ul className="space-y-4">
              {s.top_referrers.map((r) => {
                const pct = (r.clicks / s.total_clicks) * 100
                return (
                  <li key={r.referrer} className="text-base">
                    <div className="flex justify-between gap-4">
                      <span className="truncate">{r.referrer}</span>
                      <span className="font-mono tabular-nums text-white/70">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-blue-500 transition-all duration-700" style={{ width: pct + '%' }} /></div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {!authed && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-6 py-4 text-base text-amber-100">
          <span className="flex items-center gap-2"><Icon name="info" className="h-5 w-5 shrink-0" />This is an unsaved guest link. Sign up to keep it and access its stats anytime.</span>
          <Link to="/register" className="btn !h-10 !px-4 !text-sm">Sign up</Link>
        </div>
      )}

      {confirm && <ConfirmModal title="Delete link?" body={`This will permanently remove ${display(link.short_url)} and its analytics.`} onConfirm={remove} onCancel={() => setConfirm(false)} />}
    </section>
  )
}
