import { useCallback, useEffect, useState } from "react"

export type ToastVariant = "default" | "success" | "destructive" | "warning"

// Default durations per variant (ms). Callers can override per-toast.
// Radix treats duration=Infinity as "never auto-dismiss".
const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 4000,
  default: 4000,
  warning: 6000,
  destructive: Infinity, // errors stay until the user dismisses them
}

export type ToastItem = {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  /** ms before auto-dismiss. Pass Infinity to never auto-dismiss. */
  duration?: number
}

export type ToastOptions = {
  title?: string
  description?: string
  variant?: ToastVariant
  /** Override the default duration for this variant. */
  duration?: number
}

type Dispatcher = (action: ToastItem | { dismiss: string }) => void

let _dispatch: Dispatcher | null = null

/** Call this anywhere (including outside React) to show a toast. */
export function toast(options: ToastOptions) {
  const id = Math.random().toString(36).slice(2)
  const variant = options.variant ?? "default"
  const duration = options.duration ?? DEFAULT_DURATION[variant]
  _dispatch?.({ id, variant, duration, ...options })
}

/** Show a success toast (auto-closes after 4 s by default). */
toast.success = (title: string, description?: string, duration?: number) =>
  toast({ title, description, variant: "success", duration })

/** Show an error toast (stays open until dismissed by default). */
toast.error = (title: string, description?: string, duration?: number) =>
  toast({ title, description, variant: "destructive", duration })

/** Show a warning toast (auto-closes after 6 s by default). */
toast.warning = (title: string, description?: string, duration?: number) =>
  toast({ title, description, variant: "warning", duration })

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((options: ToastOptions) => {
    const id = Math.random().toString(36).slice(2)
    const variant = options.variant ?? "default"
    const duration = options.duration ?? DEFAULT_DURATION[variant]
    setToasts((prev) => [...prev, { id, variant, duration, ...options }])
    return id
  }, [])

  useEffect(() => {
    _dispatch = (action) => {
      if ("dismiss" in action) {
        setToasts((prev) => prev.filter((t) => t.id !== action.dismiss))
      } else {
        setToasts((prev) => [...prev, action])
      }
    }
    return () => {
      _dispatch = null
    }
  }, [])

  return { toasts, dismiss, toast: addToast }
}
