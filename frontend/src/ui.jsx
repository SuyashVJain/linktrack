import { createContext, useCallback, useContext, useState } from 'react'

const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((text) => {
    const id = Math.random()
    setToasts((t) => [...t, { id, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast glass px-5 py-3 text-sm">{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function CopyButton({ text, label = 'Copy' }) {
  const toast = useToast()
  return (
    <button
      className="btn-ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          toast('Copied to clipboard')
        } catch {
          toast('Copy failed, select the text manually')
        }
      }}
    >
      {label}
    </button>
  )
}

export const Spinner = () => (
  <div className="flex justify-center py-12" role="status" aria-label="Loading">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-violet-400" />
  </div>
)

export const ErrorText = ({ children }) =>
  children ? <p role="alert" className="text-sm text-rose-300">{children}</p> : null
