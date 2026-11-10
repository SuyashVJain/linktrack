import { Link } from './router.jsx'
import { Icon } from './ui.jsx'

export default function NotFound() {
  return (
    <section className="glass-raised mx-auto mt-8 flex max-w-xl flex-col items-center p-8 text-center sm:p-16">
      <p className="font-mono text-base text-accent-soft">404</p>
      <h1 className="display mt-2 text-4xl sm:text-5xl">This page <em>doesn't</em> exist.</h1>
      <p className="mt-4 text-base text-white/70">The address may be mistyped, or the page was moved. Short links live at the site root, for example <span className="font-mono">/abc123</span>, and are not part of this app.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link to="/" className="btn"><Icon name="link" />Shorten a link</Link>
        <Link to="/links" className="btn-ghost !h-12 !px-6 !text-base">My links</Link>
      </div>
    </section>
  )
}
