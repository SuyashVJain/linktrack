import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Link } from './router.jsx'

// Stroke icons (24x24 grid). Paths are separated by "|".
const PATHS = {
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7|M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  bolt: 'M13 2 3 14h9l-1 8 10-12h-9z',
  bars: 'M6 20V10|M12 20V4|M18 20v-6',
  layers: 'm12 2 10 5-10 5L2 7z|M2 17l10 5 10-5|M2 12l10 5 10-5',
  userPlus: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M19 8v6|M22 11h-6|M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  arrowRight: 'M5 12h14|M12 5l7 7-7 7',
  arrowLeft: 'M19 12H5|M12 19l-7-7 7-7',
  copy: 'M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z|M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  trash: 'M3 6h18|M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6|M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2|M10 11v6|M14 11v6',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M7 10l5 5 5-5|M12 15V3',
  plus: 'M12 5v14|M5 12h14',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18|M6 6l12 12',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|M12 16v-4|M12 8h.01',
  alert: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|M12 8v4|M12 16h.01',
  checkCircle: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|m8.5 12.5 2.5 2.5 4.5-5',
  lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z|M7 11V7a5 5 0 0 1 10 0v4',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z|m21 21-4.3-4.3',
  external: 'M15 3h6v6|M10 14 21 3|M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  chevron: 'm6 9 6 6 6-6',
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M17.9 17.9A10 10 0 0 1 12 19C5 19 2 12 2 12a18 18 0 0 1 5-5.9|M1 1l22 22|M9.9 4.2A9 9 0 0 1 12 5c7 0 10 7 10 7a18 18 0 0 1-2.2 3.2',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z|m22 7-10 6L2 7',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z|M7 7h.01',
  menu: 'M4 6h16|M4 12h16|M4 18h16',
}

export function Icon({ name, className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name].split('|').map((d) => <path key={d} d={d} />)}
    </svg>
  )
}

// "https://host/slug" -> "host/slug"
export const display = (url) => url.replace(/^https?:\/\//, '')

const KINDS = {
  success: { icon: 'checkCircle', cls: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100' },
  info: { icon: 'info', cls: 'border-blue-400/40 bg-blue-500/15 text-blue-100' },
  warning: { icon: 'alert', cls: 'border-amber-400/40 bg-amber-500/15 text-amber-100' },
  error: { icon: 'x', cls: 'border-red-400/40 bg-red-500/15 text-red-100' },
}

const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id))
  const push = useCallback((text, kind = 'success') => {
    const id = Math.random()
    setToasts((t) => [...t, { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`pop pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm backdrop-blur-xl ${KINDS[t.kind].cls}`}>
            <Icon name={KINDS[t.kind].icon} className="h-5 w-5 shrink-0" />
            <span className="flex-1">{t.text}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-70 hover:opacity-100"><Icon name="x" /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function copyText(toast, text) {
  return navigator.clipboard.writeText(text).then(
    () => toast('Link copied to clipboard'),
    () => toast('Copy failed, select the text manually', 'error'),
  )
}

export function CopyButton({ text, label = 'Copy link' }) {
  const toast = useToast()
  return (
    <button className="btn-ghost" onClick={() => copyText(toast, text)}>
      <Icon name="copy" />{label}
    </button>
  )
}

export const Spinner = () => (
  <div className="flex justify-center py-16" role="status" aria-label="Loading">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-accent" />
  </div>
)

export const ErrorText = ({ children }) =>
  children ? <p role="alert" className="text-sm text-red-300">{children}</p> : null

export function ConfirmModal({ title, body, confirmLabel = 'Delete', onConfirm, onCancel }) {
  useEffect(() => {
    const on = (e) => e.key === 'Escape' && onCancel()
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, [onCancel])
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="glass pop relative w-full max-w-sm bg-[#0c1428]/90 p-6" onClick={(e) => e.stopPropagation()}>
        <button className="absolute right-4 top-4 text-white/50 hover:text-white" onClick={onCancel} aria-label="Close"><Icon name="x" /></button>
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/15 text-red-300"><Icon name="trash" className="h-5 w-5" /></div>
        <h2 id="modal-title" className="display text-2xl">{title}</h2>
        <p className="mt-2 text-sm text-white/60">{body}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-400" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

export function GuestBanner({ className = '' }) {
  return (
    <Link to="/register" className={`glass glass-hover flex items-center gap-4 p-4 ${className}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent"><Icon name="userPlus" className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">You are not signed in. Sign up to keep your links and stats on any device.</p>
        <p className="text-xs text-white/50">Guest links are only listed in this browser.</p>
      </div>
      <Icon name="arrowRight" className="h-5 w-5 shrink-0 text-white/60" />
    </Link>
  )
}
