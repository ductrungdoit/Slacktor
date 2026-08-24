export type SlacktorLogEntry = {
  id: string
  createdAt: number
  level: "info" | "error"
  scope: "translation" | "summary" | "quick-translation" | "background"
  message: string
  details?: Record<string, string | number | boolean | undefined>
}

const LOG_KEY = "slacktor-logs"
const MAX_LOG_ENTRIES = 200

export async function writeLog(entry: Omit<SlacktorLogEntry, "id" | "createdAt">): Promise<void> {
  const stored = await chrome.storage.local.get(LOG_KEY)
  const logs = Array.isArray(stored[LOG_KEY]) ? stored[LOG_KEY] as SlacktorLogEntry[] : []
  logs.unshift({ ...entry, id: crypto.randomUUID(), createdAt: Date.now() })
  await chrome.storage.local.set({ [LOG_KEY]: logs.slice(0, MAX_LOG_ENTRIES) })
}

export async function getLogs(): Promise<SlacktorLogEntry[]> {
  const stored = await chrome.storage.local.get(LOG_KEY)
  return Array.isArray(stored[LOG_KEY]) ? stored[LOG_KEY] as SlacktorLogEntry[] : []
}

export async function clearLogs(): Promise<void> {
  await chrome.storage.local.set({ [LOG_KEY]: [] })
}

export function safeEndpoint(value: string): string {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return "invalid-endpoint"
  }
}
