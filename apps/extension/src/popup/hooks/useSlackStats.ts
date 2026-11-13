import { useEffect, useState } from "react"

import { sendExtensionMessage } from "../lib/messaging"

export type SlackStats = {
  waiting: number
  active: number
  retrying: number
  translatedToday: number
  requestsToday: number
}

const POLL_INTERVAL_MS = 500

/** Polls Slack translation queue/progress stats for the active tab every 500ms. */
export function useSlackStats(): { stats?: SlackStats; unavailable: boolean } {
  const [stats, setStats] = useState<SlackStats | undefined>(undefined)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        const result = await sendExtensionMessage<SlackStats>({
          type: "get-slack-translation-stats",
          tabId: tab?.id,
        })
        if (!cancelled && result) {
          setStats(result)
          setUnavailable(false)
        }
      } catch {
        if (!cancelled) setUnavailable(true)
      }
    }
    void refresh()
    const interval = window.setInterval(refresh, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  return { stats, unavailable }
}
