import { useEffect, useState } from 'react'
import { api } from './api.js'

function BarChart({ data }) {
  const W = 600, H = 160, gap = 3
  const max = Math.max(1, ...data.map((d) => d.clicks))
  const bw = W / data.length - gap
  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" role="img" aria-label="Clicks per day, last 30 days">
      {data.map((d, i) => {
        const h = (d.clicks / max) * H
        return (
          <rect key={d.day} x={i * (bw + gap)} y={H - h} width={bw} height={Math.max(h, d.clicks ? 1 : 0)} rx="1" className="fill-slate-800">
            <title>{`${d.day}: ${d.clicks}`}</title>
          </rect>
        )
      })}
      <text x="0" y={H + 15} className="fill-slate-400 text-[10px]">{data[0].day}</text>
      <text x={W} y={H + 15} textAnchor="end" className="fill-slate-400 text-[10px]">{data[data.length - 1].day}</text>
    </svg>
  )
}

export default function Stats({ id }) {
  const [s, setS] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api(`/links/${id}/stats`).then(setS).catch((e) => setError(e.message)) }, [id])

  if (error) return <p role="alert" className="text-red-600">{error}</p>
  if (!s) return null
  return (
    <>
      <a href="#/" className="text-sm text-slate-500 hover:text-slate-900">&larr; Back</a>
      <p className="mt-4 text-4xl font-semibold tabular-nums">{s.total_clicks}</p>
      <p className="mb-6 text-sm text-slate-500">total clicks</p>

      <h2 className="mb-2 text-sm font-medium text-slate-500">Last 30 days</h2>
      <div className="mb-8 rounded border border-slate-200 bg-white p-4"><BarChart data={s.clicks_per_day} /></div>

      <h2 className="mb-2 text-sm font-medium text-slate-500">Top referrers</h2>
      {s.top_referrers.length === 0 ? (
        <p className="text-slate-500">No clicks yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
          {s.top_referrers.map((r) => (
            <li key={r.referrer} className="flex justify-between gap-4 p-3">
              <span className="truncate">{r.referrer}</span>
              <span className="tabular-nums">{r.clicks}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
