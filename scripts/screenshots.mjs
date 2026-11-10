// Takes the README screenshots from a running instance and saves them to docs/screenshots.
// Usage: docker compose up -d --build, then `npm run screenshots` (needs `npx playwright install chromium`, or PW_CHANNEL=msedge).
import { resolve } from 'node:path'
import { launch } from './launch.mjs'
import { BASE, seed } from './seed.mjs'

const out = (name) => resolve('..', 'docs', 'screenshots', name + '.png')
const { token, links } = await seed()
const busiest = links[0]

const browser = await launch()
const ctx = (storage) => browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
}).then(async (c) => { if (storage) await c.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v) }, storage); return c })
const settle = (page) => page.waitForTimeout(1200) // let enter animations and the bar chart finish

// Landing, as a guest who already has a few links in this browser.
const guestLinks = JSON.stringify(links.slice(0, 3).map((l) => ({ slug: l.slug, stats_token: l.stats_token })))
let c = await ctx({ linktrack_guest_links: guestLinks })
let page = await c.newPage()
await page.goto(BASE + '/app/')
await page.getByText('clicks').first().waitFor()
await settle(page)
await page.screenshot({ path: out('landing') })
await c.close()

// Result state after shortening a URL.
c = await ctx()
page = await c.newPage()
await page.goto(BASE + '/app/')
await page.getByLabel('URL to shorten').fill('https://example.com/blog/how-we-cut-build-times-in-half')
await page.getByRole('button', { name: 'Shorten' }).click()
await page.getByRole('heading', { name: 'Link created' }).waitFor()
await settle(page)
await page.screenshot({ path: out('result') })
await c.close()

// My links, signed in.
c = await ctx({ linktrack_token: token })
page = await c.newPage()
await page.goto(BASE + '/app/links')
await page.locator('svg[aria-label^="Clicks per day"]').nth(links.length - 1).waitFor()
await settle(page)
await page.screenshot({ path: out('my-links') })

// Stats for the busiest link.
await page.goto(`${BASE}/app/stats/${busiest.stats_token}`)
await page.getByText('Top referrers').waitFor()
await settle(page)
await page.screenshot({ path: out('stats') })

await browser.close()
console.log('saved screenshots to docs/screenshots')
