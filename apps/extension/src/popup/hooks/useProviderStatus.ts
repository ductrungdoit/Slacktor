import { useEffect, useState } from "react"

import { sendExtensionMessage } from "../lib/messaging"

export type ProviderStatusState = "unconfigured" | "ready" | "error"
export type ProviderStatus = { state: ProviderStatusState; message: string }

const POLL_INTERVAL_MS = 500

/**
 * Polls the background's provider runtime status every 500ms.
 * `configured` (a quick local check on the endpoint/model/API key fields)
 * forces an immediate "unconfigured" status without waiting for the next poll.
 */
export function useProviderStatus(configured: boolean): ProviderStatus {
  const [status, setStatus] = useState<ProviderStatus>({
    state: "unconfigured",
    message: "Checking provider status",
  })

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      sendExtensionMessage<ProviderStatus>({ type: "get-provider-runtime-status" })
        .then((result) => {
          if (!cancelled && result) setStatus(result)
        })
        .catch(() => {
          if (!cancelled) setStatus({ state: "error", message: "Could not read provider status" })
        })
    }
    refresh()
    const interval = window.setInterval(refresh, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  if (!configured) return { state: "unconfigured", message: "Provider is not configured" }
  return status
}
