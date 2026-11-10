import { useEffect, useState } from 'react'
import { api, removeGuestLink } from './api.js'
import { Link, navigate } from './router.jsx'
import { CopyButton, ErrorText, Spinner, useToast } from './ui.jsx'

function BarChart({ data }) {
  const W = 600, H = 160, gap = 3
  const max = Math.max(1, ...data.map((d) => d.clicks))
  const bw = W / data.length - gap
  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" role="img" aria-label="Clicks per day, last 30 days">
      {data.map((d, i) => {
        const h = d.clicks ? Math.max((d.clicks / max) * H, 2) : 0
        return (
          <g key={d.day} className="group">
            <rect x={i * (bw + gap)} y={0} width={bw} height={H} fill="transparent" />
            <rect x={i * (bw + gap)} y={H - h} width={bw} height={h} rx="2" className="fill-violet-400 transition group-hover:fill-violet-200" />
            <rect x={i * (bw + gap)} y={H - 1} width={bw} height={1} className="fill-white/15" />
            <title>{`${d.day}: ${d.clicks}`}</title>
          </g>
        )
      })}
      <text x="0" y={H + 15} className="fill-white/40 text-[10px]">{data[0].day}</text>
      <text x={W} y={H + 15} textAnchor="end" className="fill-white/40 text-[10px]">{data[data.length - 1].day}</text>
    </svg>
  )
}

export default function Stats({ token }) {
  const toast = useToast()
  const [s, setS] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setS(null)
    setError('')
    api('/stats/' + token).then(setS).catch((e) => setError(e.message === 'not found' ? 'This link does not exist or was deleted.' : e.message))
  }, [token])

  async function remove() {
    if (!confirm('Delete this link and all its stats? This cannot be undone.')) return
    try {
      await api('/stats/' + token, { method: 'DELETE' })
      removeGuestLink(token)
      toast('Link deleted')
      navigate('/links')
    } catch (e) {
      setError(e.message)
    }
  }

  if (error) return <div className="glass p-8 text-center"><ErrorText>{error}</ErrorText><Link to="/links" className="btn-ghost mt-4">Back to my links</Link></div>
  if (!s) return <Spinner />
  const { link } = s
  return (
    <div className="space-y-6">
      <div className="glass p-6">
        <p className="truncate text-sm text-white/50">{link.label || link.target_url}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <a href={link.short_url} target="_blank" rel="noreferrer" className="truncate text-xl font-semibold text-violet-300 hover:underline">{link.short_url}</a>
          <CopyButton text={link.short_url} />
        </div>
        <p className="mt-5 text-5xl font-bold tabular-nums">{s.total_clicks}</p>
        <p className="text-sm text-white/50">total clicks</p>
      </div>

      <div className="glass p-6">
        <h2 className="mb-3 text-sm font-medium text-white/60">Last 30 days</h2>
        <BarChart data={s.clicks_per_day} />
      </div>

      <div className="glass p-6">
        <h2 className="mb-3 text-sm font-medium text-white/60">Top referrers</h2>
        {s.top_referrers.length === 0 ? (
          <p className="text-white/50">No clicks yet.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {s.top_referrers.map((r) => (
              <li key={r.referrer} className="flex justify-between gap-4 py-2">
                <span className="truncate">{r.referrer}</span>
                <span className="tabular-nums text-white/70">{r.clicks}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-between">
        <Link to="/links" className="btn-ghost">&larr; My links</Link>
        <button className="btn-ghost hover:!border-rose-400/50 hover:!text-rose-300" onClick={remove}>Delete link</button>
      </div>
    </div>
  )
}
