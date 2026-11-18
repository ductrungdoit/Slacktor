import {
  type NewQuickHistoryEntry,
  QUICK_HISTORY_LIMIT,
  QUICK_UI_KEY,
  type QuickHistoryEntry,
  retainRecentHistory,
} from "../shared/quick-history"

let writeQueue: Promise<unknown> = Promise.resolve()

/** Prepends an entry to the Quick Translator history. Writes are serialised and
 * only touch the history field, so popup state such as the draft is preserved. */
export function appendQuickHistory(entry: NewQuickHistoryEntry): Promise<void> {
  const write = writeQueue.then(async () => {
    const stored = await chrome.storage.local.get(QUICK_UI_KEY)
    const state = (stored[QUICK_UI_KEY] ?? {}) as { history?: QuickHistoryEntry[] }
    const next: QuickHistoryEntry = { id: crypto.randomUUID(), ...entry, createdAt: Date.now() }
    await chrome.storage.local.set({
      [QUICK_UI_KEY]: {
        ...state,
        history: [next, ...retainRecentHistory(state.history)].slice(0, QUICK_HISTORY_LIMIT),
      },
    })
  })
  writeQueue = write.catch(() => undefined)
  return write
}
