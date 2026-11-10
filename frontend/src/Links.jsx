import { useEffect, useState } from 'react'
import { api, getGuestLinks, removeGuestLink } from './api.js'
import { Link } from './router.jsx'
import { CopyButton, ErrorText, Spinner } from './ui.jsx'

// Signed in: links come from the API. Guest: look up each stored stats token.
async function loadLinks(authed) {
  if (authed) return api('/links')
  const results = await Promise.all(
    getGuestLinks().map((g) =>
      api('/stats/' + g.stats_token)
        .then((s) => s.link)
        .catch(() => { removeGuestLink(g.stats_token); return null }), // deleted elsewhere
    ),
  )
  return results.filter(Boolean)
}

export default function Links({ authed }) {
  const [links, setLinks] = useState(null)
  const [error, setError] = useState('')

  const load = () => loadLinks(authed).then(setLinks).catch((e) => setError(e.message))
  useEffect(() => { setLinks(null); load() }, [authed])

  async function remove(l) {
    if (!confirm('Delete this link and its click history?')) return
    try {
      await api(authed ? `/links/${l.id}` : `/stats/${l.stats_token}`, { method: 'DELETE' })
      removeGuestLink(l.stats_token)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  if (error) return <ErrorText>{error}</ErrorText>
  if (!links) return <Spinner />
  if (links.length === 0) {
    return (
      <div className="glass p-10 text-center">
        <p className="text-white/70">No links yet.</p>
        <Link to="/" className="btn mt-4">Shorten your first link</Link>
      </div>
    )
  }
  return (
    <ul className="space-y-3">
      {links.map((l) => (
        <li key={l.stats_token} className="glass glass-hover flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
          <div className="min-w-0 flex-1 basis-60">
            <p className="truncate font-medium">{l.label || l.short_url}</p>
            {l.label && <p className="truncate text-sm text-violet-300">{l.short_url}</p>}
            <p className="truncate text-sm text-white/40">{l.target_url}</p>
          </div>
          <Link to={`/stats/${l.stats_token}`} className="text-sm tabular-nums text-white/80 hover:underline">{l.clicks} clicks</Link>
          <div className="flex gap-2">
            <CopyButton text={l.short_url} label="Copy link" />
            <button className="btn-ghost hover:!border-rose-400/50 hover:!text-rose-300" onClick={() => remove(l)}>Delete</button>
          </div>
        </li>
      ))}
    </ul>
  )
}
