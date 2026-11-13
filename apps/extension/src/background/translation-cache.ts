import type { ProviderSettings } from "../shared/settings"
import {
  normalizeSlackMessageId,
  type RawSlackMessage,
  type ThreadContextPlan,
} from "../shared/types"
import {
  APP_VERSION,
  CONTEXT_STORE_RESET_VERSION,
  THREAD_SUMMARY_RESET_VERSION,
  TRANSLATION_CACHE_RESET_VERSION,
} from "../shared/version"
import {
  clearContextStore,
  clearThreadSummaries,
  openDatabase,
  saveContextMessageTranslation,
} from "./context-store"

type TranslationCacheEntry = {
  id: string
  translation: string
  createdAt: number
}

const STORE_NAME = "translations"
const TRANSLATION_CACHE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export async function checkAndMigrateTranslationCache(): Promise<{
  cacheCleared: boolean
  contextCleared: boolean
  summariesCleared: boolean
  isVersionUpgrade: boolean
}> {
  const stored = await chrome.storage.local.get([
    "lastClearedCacheVersion",
    "lastClearedContextVersion",
    "lastClearedSummaryVersion",
    "lastKnownExtensionVersion",
  ])

  const isVersionUpgrade = Boolean(
    stored.lastKnownExtensionVersion && stored.lastKnownExtensionVersion !== APP_VERSION,
  )

  let cacheCleared = false
  if (stored.lastClearedCacheVersion !== TRANSLATION_CACHE_RESET_VERSION) {
    await clearTranslationCache()
    await chrome.storage.local.set({ lastClearedCacheVersion: TRANSLATION_CACHE_RESET_VERSION })
    cacheCleared = true
  }

  let contextCleared = false
  if (stored.lastClearedContextVersion !== CONTEXT_STORE_RESET_VERSION) {
    await clearContextStore()
    await chrome.storage.local.set({ lastClearedContextVersion: CONTEXT_STORE_RESET_VERSION })
    contextCleared = true
  }

  let summariesCleared = false
  if (stored.lastClearedSummaryVersion !== THREAD_SUMMARY_RESET_VERSION) {
    await clearThreadSummaries()
    await chrome.storage.local.set({ lastClearedSummaryVersion: THREAD_SUMMARY_RESET_VERSION })
    summariesCleared = true
  }

  if (stored.lastKnownExtensionVersion !== APP_VERSION) {
    await chrome.storage.local.set({ lastKnownExtensionVersion: APP_VERSION })
  }

  return { cacheCleared, contextCleared, summariesCleared, isVersionUpgrade }
}

export async function getCachedTranslation(
  message: RawSlackMessage,
  settings: ProviderSettings,
  _context: ThreadContextPlan = { recentMessages: [] },
): Promise<string | undefined> {
  const id = getTranslationCacheId(message, settings)
  const entry = await getEntry(id)
  if (!entry) return undefined
  if (entry.createdAt + TRANSLATION_CACHE_RETENTION_MS > Date.now()) return entry.translation

  const database = await openDatabase()
  await transaction(database, "readwrite", (store) => store.delete(id))
  return undefined
}

let writesSinceCacheCleanup = 0
let lastCacheCleanupAt = 0
const CLEANUP_CACHE_WRITE_INTERVAL = 50
const CLEANUP_CACHE_INTERVAL_MS = 15 * 60 * 1000

export async function cacheTranslation(
  message: RawSlackMessage,
  settings: ProviderSettings,
  translation: string,
  _context: ThreadContextPlan = { recentMessages: [] },
): Promise<void> {
  const database = await openDatabase()
  const entry: TranslationCacheEntry = {
    id: getTranslationCacheId(message, settings),
    translation,
    createdAt: Date.now(),
  }

  await transaction(database, "readwrite", (store) => store.put(entry))
  void saveContextMessageTranslation(message, translation, settings.targetLanguage)

  writesSinceCacheCleanup += 1
  if (
    writesSinceCacheCleanup >= CLEANUP_CACHE_WRITE_INTERVAL ||
    Date.now() - lastCacheCleanupAt >= CLEANUP_CACHE_INTERVAL_MS
  ) {
    writesSinceCacheCleanup = 0
    lastCacheCleanupAt = Date.now()
    void cleanupExpiredTranslations()
  }
}

export async function cleanupExpiredTranslations(): Promise<void> {
  try {
    const database = await openDatabase()
    const cutoff = Date.now() - TRANSLATION_CACHE_RETENTION_MS
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)
      const request = store.openCursor()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          const entry = cursor.value as TranslationCacheEntry
          if (entry.createdAt < cutoff) {
            cursor.delete()
          }
          cursor.continue()
        } else {
          resolve()
        }
      }
    })
  } catch {
    // Periodic background cleanup failure should not affect active user workflow
  }
}

export async function clearTranslationCache(): Promise<void> {
  const database = await openDatabase()
  await transaction(database, "readwrite", (store) => store.clear())
}

export function getTranslationCacheId(
  message: RawSlackMessage,
  settings: ProviderSettings,
): string {
  // Thread context and provider endpoint/model are deliberately excluded.
  // Slacktor rebuilds context while Slack virtualizes the channel, and users
  // may switch endpoints or models without invalidating existing translations.
  // Retranslate uses forceRefresh when the user explicitly wants an update.
  return stableHash(
    [
      message.workspaceId ?? "",
      message.conversationId ?? "",
      normalizeSlackMessageId(message.timestamp ?? message.messageId),
      message.sourceText,
      settings.targetLanguage,
      settings.customPrompt,
    ].join("\u0000"),
  )
}

const FNV64_OFFSET = 0xcbf29ce484222325n
const FNV64_PRIME = 0x100000001b3n

function stableHash(value: string): string {
  let hash = FNV64_OFFSET
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index))
    hash = (hash * FNV64_PRIME) & 0xffffffffffffffffn
  }
  return hash.toString(16).padStart(16, "0")
}

async function getEntry(id: string): Promise<TranslationCacheEntry | undefined> {
  const database = await openDatabase()
  return transaction(database, "readonly", (store) => store.get(id)) as Promise<
    TranslationCacheEntry | undefined
  >
}

function transaction<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = operation(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME))
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}
