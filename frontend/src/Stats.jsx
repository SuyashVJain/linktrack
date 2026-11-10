import { useEffect, useState } from 'react'
import { api, removeGuestLink } from './api.js'
import { Link, navigate } from './router.jsx'
import { ConfirmModal, CopyButton, display, ErrorText, Icon, Spinner, useToast } from './ui.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtDay = (d) => `${MONTHS[+d.slice(5, 7) - 1]} ${+d.slice(8)}`

function BarChart({ data }) {
  const W = 640, H = 180, L = 28, B = 22, T = 8, gap = 4
  const max = Math.max(1, ...data.map((d) => d.clicks))
  const top = max <= 4 ? max : Math.ceil(max / 4) * 4 // round the axis so ticks are whole numbers
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, 1, 2, 3, 4].map((i) => (top / 4) * i)
  const bw = (W - L) / data.length - gap
  const y = (v) => T + H - (v / top) * H
  return (
    <svg viewBox={`0 0 ${W} ${T + H + B}`} className="w-full" role="img" aria-label="Clicks per day, last 30 days">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="white" strokeOpacity="0.08" />
          <text x={L - 8} y={y(t) + 3} textAnchor="end" className="fill-white/50 font-mono text-[10px]">{t}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = L + i * (bw + gap)
        return (
          <g key={d.day} className="group">
            <rect x={x} y={T} width={bw + gap} height={H} fill="transparent" />
            {d.clicks > 0 && <rect x={x} y={y(d.clicks)} width={bw} height={T + H - y(d.clicks)} rx="2" className="fill-accent transition group-hover:fill-blue-300" />}
            {i % 4 === 0 && <text x={x + bw / 2} y={T + H + 16} textAnchor="middle" className="fill-white/50 font-mono text-[10px]">{fmtDay(d.day)}</text>}
            <title>{`${fmtDay(d.day)}: ${d.clicks}`}</title>
          </g>
        )
      })}
    </svg>
  )
}

const Card = ({ label, children }) => (
  <div className="glass p-5">
    <p className="text-xs text-white/50">{label}</p>
    <p className="mt-1 font-mono text-3xl tabular-nums">{children}</p>
  </div>
)

export default function Stats({ token, authed }) {
  const toast = useToast()
  const [s, setS] = useState(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    setS(null)
    setError('')
    api('/stats/' + token).then(setS).catch((e) => setError(e.message === 'not found' ? 'This link does not exist or was deleted.' : e.message))
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

  if (error) return <div className="glass mx-auto max-w-md p-8 text-center"><ErrorText>{error}</ErrorText><Link to="/links" className="btn-ghost mt-4">Back to my links</Link></div>
  if (!s) return <Spinner />
  const { link } = s
  const total30 = s.clicks_per_day.reduce((n, d) => n + d.clicks, 0)
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/links" className="text-white/60 transition hover:text-white" aria-label="Back to my links"><Icon name="arrowLeft" className="h-5 w-5" /></Link>
          <a href={link.short_url} target="_blank" rel="noreferrer" className="truncate font-mono text-lg text-blue-300 hover:underline">{display(link.short_url)}</a>
        </div>
        <div className="flex gap-2">
          <CopyButton text={link.short_url} />
          <button className="btn-danger" onClick={() => setConfirm(true)}><Icon name="trash" />Delete</button>
        </div>
      </div>
      <p className="-mt-2 truncate text-sm text-white/50">{link.label ? `${link.label} · ` : ''}{link.target_url}</p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card label="Total clicks">{s.total_clicks}</Card>
        <Card label="Last 30 days">{total30}</Card>
        <Card label="Created"><span className="text-xl">{new Date(link.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span></Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="glass p-5">
          <h2 className="mb-4 text-sm font-medium">Clicks (last 30 days)</h2>
          <BarChart data={s.clicks_per_day} />
        </div>
        <div className="glass p-5">
          <h2 className="mb-4 text-sm font-medium">Top referrers</h2>
          {s.top_referrers.length === 0 ? (
            <p className="text-sm text-white/50">No clicks yet.</p>
          ) : (
            <ul className="space-y-3">
              {s.top_referrers.map((r) => {
                const pct = (r.clicks / s.total_clicks) * 100
                return (
                  <li key={r.referrer} className="text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="truncate">{r.referrer}</span>
                      <span className="font-mono tabular-nums text-white/60">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-accent" style={{ width: pct + '%' }} /></div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {!authed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <span className="flex items-center gap-2"><Icon name="info" className="h-4 w-4 shrink-0" />This is an unsaved guest link. Sign up to keep it and access its stats anytime.</span>
          <Link to="/register" className="btn py-1.5">Sign up</Link>
        </div>
      )}

      {confirm && <ConfirmModal title="Delete link?" body={`This will permanently remove ${display(link.short_url)} and its analytics.`} onConfirm={remove} onCancel={() => setConfirm(false)} />}
    </section>
  )
}
