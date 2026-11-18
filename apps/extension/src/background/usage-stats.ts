const USAGE_STATS_KEY = "daily-usage-stats"
let updateQueue = Promise.resolve()

export type DailyUsageStats = {
  date: string
  translatedMessages: number
  llmRequests: number
}

function today(): string {
  return new Date().toLocaleDateString("en-CA")
}

export async function getDailyUsageStats(): Promise<DailyUsageStats> {
  const stored = await chrome.storage.local.get(USAGE_STATS_KEY)
  const stats = stored[USAGE_STATS_KEY] as DailyUsageStats | undefined
  if (stats?.date === today()) return stats
  return { date: today(), translatedMessages: 0, llmRequests: 0 }
}

async function increment(field: "translatedMessages" | "llmRequests", amount = 1): Promise<void> {
  updateQueue = updateQueue.then(async () => {
    const stats = await getDailyUsageStats()
    stats[field] += amount
    await chrome.storage.local.set({ [USAGE_STATS_KEY]: stats })
  })
  await updateQueue
}

export function countTranslatedMessages(amount: number): Promise<void> {
  return increment("translatedMessages", amount)
}

export function countLlmRequest(): Promise<void> {
  return increment("llmRequests")
}
