// Renders the 1200x630 social preview image to frontend/public/og.png.
// Usage: npm run og   (run `npx playwright install chromium` first, or set PW_CHANNEL=msedge)
import { pathToFileURL } from 'node:url'
import { resolve, join } from 'node:path'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { launch } from './launch.mjs'

const fonts = resolve('..', 'frontend', 'node_modules', '@fontsource-variable')
const url = (p) => pathToFileURL(resolve(fonts, p)).href

const html = `<!doctype html><html><head><style>
@font-face{font-family:F;src:url(${url('fraunces/files/fraunces-latin-wght-normal.woff2')});font-weight:100 900}
@font-face{font-family:F;font-style:italic;src:url(${url('fraunces/files/fraunces-latin-wght-italic.woff2')});font-weight:100 900}
@font-face{font-family:I;src:url(${url('inter/files/inter-latin-wght-normal.woff2')});font-weight:100 900}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#060b1a;color:#e6ebf5;font-family:I,sans-serif;position:relative;overflow:hidden;padding:72px}
.b1{position:absolute;left:-160px;bottom:-200px;width:640px;height:640px;border-radius:50%;background:rgba(37,99,235,.35);filter:blur(120px)}
.b2{position:absolute;right:-120px;top:-160px;width:560px;height:560px;border-radius:50%;background:rgba(79,70,229,.3);filter:blur(120px)}
.brand{position:relative;display:flex;align-items:center;gap:16px;font-size:32px;font-weight:600}
h1{position:relative;font-family:F;font-weight:500;font-size:96px;line-height:1.05;letter-spacing:-0.02em;margin-top:72px;max-width:980px}
h1 em{color:#60a5fa}
p{position:relative;margin-top:32px;font-size:32px;color:rgba(230,235,245,.7)}
</style></head><body><div class="b1"></div><div class="b2"></div>
<div class="brand"><svg width="48" height="48" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#g)"/><path d="M13 19l6-6M12 15l-2 2a3.5 3.5 0 005 5l2-2M20 17l2-2a3.5 3.5 0 00-5-5l-2 2" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>LinkTrack</div>
<h1>Shorten URLs and <em>track</em> their performance.</h1>
<p>Short links with click stats. No account needed.</p></body></html>`

const browser = await launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
// file:// fonts only load from a file page, not from setContent.
const file = join(mkdtempSync(join(tmpdir(), 'og-')), 'og.html')
writeFileSync(file, html)
await page.goto(pathToFileURL(file).href)
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: resolve('..', 'frontend', 'public', 'og.png') })
await browser.close()
console.log('wrote frontend/public/og.png')
