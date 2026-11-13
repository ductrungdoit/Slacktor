import { useCallback, useState } from "react"

import type { SlacktorLogEntry } from "../../background/log-store"
import { sendExtensionMessage } from "../lib/messaging"

export function useLogs() {
  const [logs, setLogs] = useState<SlacktorLogEntry[]>([])

  const refresh = useCallback(async (): Promise<void> => {
    const result = await sendExtensionMessage<SlacktorLogEntry[]>({ type: "get-logs" })
    setLogs(Array.isArray(result) ? result : [])
  }, [])

  const clear = useCallback(async (): Promise<void> => {
    await sendExtensionMessage({ type: "clear-logs" })
    await refresh()
  }, [refresh])

  return { logs, refresh, clear }
}
