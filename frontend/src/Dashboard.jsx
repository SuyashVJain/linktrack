import { useEffect, useState } from 'react'
import { api } from './api.js'

const shortUrl = (slug) => `${location.origin}/${slug}`

function CopyButton({ text }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
    >
      {done ? 'Copied' : 'Copy link'}
    </button>
  )
}

export default function Dashboard() {
  const [links, setLinks] = useState(null)
  const [form, setForm] = useState({ target_url: '', slug: '', label: '' })
  const [error, setError] = useState('')

  const load = () => api('/links').then(setLinks).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  async function create(e) {
    e.preventDefault()
    setError('')
    try {
      await api('/links', { method: 'POST', body: form })
      setForm({ target_url: '', slug: '', label: '' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this link and its click history?')) return
    await api('/links/' + id, { method: 'DELETE' })
    load()
  }

  const input = 'rounded border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none'
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  return (
    <>
      <form onSubmit={create} className="mb-8 grid gap-3 sm:grid-cols-6">
        <input className={`${input} sm:col-span-6`} type="url" required placeholder="https://example.com/long/url"
          value={form.target_url} onChange={set('target_url')} />
        <input className={`${input} sm:col-span-2`} placeholder="Custom slug (optional)" value={form.slug} onChange={set('slug')} />
        <input className={`${input} sm:col-span-3`} placeholder="Label (optional)" value={form.label} onChange={set('label')} />
        <button className="rounded bg-slate-900 px-3 py-2 text-white hover:bg-slate-700">Shorten</button>
        {error && <p role="alert" className="text-sm text-red-600 sm:col-span-6">{error}</p>}
      </form>

      {links === null ? null : links.length === 0 ? (
        <p className="text-slate-500">No links yet. Create your first one above.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.label || shortUrl(l.slug)}</p>
                {l.label && <p className="truncate text-sm text-slate-500">{shortUrl(l.slug)}</p>}
                <p className="truncate text-sm text-slate-400">{l.target_url}</p>
              </div>
              <a href={`#/links/${l.id}`} className="text-sm tabular-nums hover:underline">{l.clicks} clicks</a>
              <CopyButton text={shortUrl(l.slug)} />
              <button className="text-xs text-red-600 hover:underline" onClick={() => remove(l.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
