// Seeds demo data into a running instance (docker compose up) for screenshots.
// Creates a demo account with a few links and click history. Safe to run more than once.
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

export const BASE = process.env.BASE_URL || 'http://localhost:8080'
export const DEMO = { email: 'demo@example.com', password: 'demo-password-123' }

const DEMO_LINKS = [
  { slug: 'portfolio', target_url: 'https://example.com/portfolio/2026', label: 'portfolio', clicks: 46 },
  { slug: 'launch', target_url: 'https://example.com/blog/launch-announcement', label: 'campaign', clicks: 28 },
  { slug: 'docs', target_url: 'https://example.com/docs/getting-started', label: 'docs', clicks: 17 },
  { slug: 'talk', target_url: 'https://example.com/events/summit-2026/talk-slides', label: 'event', clicks: 9 },
  { slug: 'repo', target_url: 'https://github.com/example/project', label: 'dev', clicks: 4 },
]
const REFERRERS = ['https://www.google.com/', 'https://news.ycombinator.com/', 'https://twitter.com/', 'https://www.linkedin.com/', '']

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    redirect: 'manual',
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: 'Bearer ' + token }) },
    body: body && JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, data: text ? safeJSON(text) : null }
}
const safeJSON = (t) => { try { return JSON.parse(t) } catch { return null } }

export async function seed() {
  let r = await call('/api/auth/register', { method: 'POST', body: DEMO })
  if (r.status === 409) r = await call('/api/auth/login', { method: 'POST', body: DEMO })
  if (!r.data?.token) throw new Error(`could not sign in the demo user: ${r.status}`)
  const token = r.data.token

  const existing = (await call('/api/links', { token })).data || []
  const links = []
  for (const d of DEMO_LINKS) {
    let link = existing.find((l) => l.slug === d.slug)
    if (!link) {
      link = (await call('/api/links', { method: 'POST', token, body: { target_url: d.target_url, slug: d.slug, label: d.label } })).data
      for (let i = 0; i < d.clicks; i++) {
        await fetch(`${BASE}/${d.slug}`, { redirect: 'manual', headers: { Referer: REFERRERS[Math.floor(Math.pow(Math.random(), 2) * REFERRERS.length)] } })
      }
    }
    links.push(link)
  }

  // Spread the clicks over the last 30 days so charts have a shape. Needs docker compose; skipped otherwise.
  try {
    execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'linktrack', '-d', 'linktrack', '-c',
      `UPDATE clicks SET clicked_at = now() - (power(random(), 1.6) * interval '29 days') WHERE clicked_at > now() - interval '5 minutes'`],
    { cwd: resolve('..'), env: { ...process.env, POSTGRES_PASSWORD: 'x', JWT_SECRET: 'x' }, stdio: 'pipe' })
  } catch {
    console.warn('could not backdate clicks (docker compose not available); charts will show only today')
  }
  return { token, links }
}
