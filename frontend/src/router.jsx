import { useEffect, useState } from 'react'

// Tiny History API router; the app is served under /app/.
const BASE = '/app'
const strip = () => location.pathname.slice(BASE.length).replace(/\/+$/, '') || '/'

export function navigate(to) {
  history.pushState(null, '', BASE + (to === '/' ? '/' : to))
  window.dispatchEvent(new Event('navigate'))
  window.scrollTo(0, 0)
}

export function usePath() {
  const [path, setPath] = useState(strip)
  useEffect(() => {
    const on = () => setPath(strip())
    addEventListener('popstate', on)
    addEventListener('navigate', on)
    return () => { removeEventListener('popstate', on); removeEventListener('navigate', on) }
  }, [])
  return path
}

export function Link({ to, className, children }) {
  return (
    <a
      href={BASE + (to === '/' ? '/' : to)}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}
