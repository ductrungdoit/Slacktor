import type { RawSlackMessage } from "../shared/types"
import type { ProviderSettings } from "../shared/settings"
import type { ThreadContextPlan } from "../shared/types"

type TranslationCacheEntry = {
  id: string
  translation: string
  createdAt: number
}

const DATABASE_NAME = "slacktor"
const STORE_NAME = "translations"
const DATABASE_VERSION = 5
const TRANSLATION_CACHE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export async function getCachedTranslation(
  message: RawSlackMessage,
  settings: ProviderSettings,
  context: ThreadContextPlan = { recentMessages: [] },
): Promise<string | undefined> {
  const id = getTranslationCacheId(message, settings)
  let entry = await getEntry(id)
  if (!entry) {
    entry = await getEntry(getLegacyTranslationCacheId(message, settings, context))
    if (entry && entry.createdAt + TRANSLATION_CACHE_RETENTION_MS > Date.now()) {
      const database = await openDatabase()
      entry = { ...entry, id }
      await transaction(database, "readwrite", (store) => store.put(entry!))
    }
  }
  if (!entry) return undefined
  if (entry.createdAt + TRANSLATION_CACHE_RETENTION_MS > Date.now()) return entry.translation

  const database = await openDatabase()
  await transaction(database, "readwrite", (store) => store.delete(id))
  return undefined
}

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
}

export async function clearTranslationCache(): Promise<void> {
  const database = await openDatabase()
  await transaction(database, "readwrite", (store) => store.clear())
}

export function getTranslationCacheId(
  message: RawSlackMessage,
  settings: ProviderSettings,
): string {
  // Thread context is deliberately excluded. Slacktor rebuilds it while Slack
  // virtualizes the channel, so including it makes the same translation miss
  // cache after every extension or page reload. Retranslate uses forceRefresh
  // when the user explicitly wants a context-aware update.
  return stableHash([
    message.workspaceId ?? "",
    message.conversationId ?? "",
    normalizeSlackMessageId(message.timestamp ?? message.messageId),
    message.sourceText,
    settings.baseUrl,
    settings.model,
    settings.targetLanguage,
  ].join("\u0000"))
}

function normalizeSlackMessageId(value: string): string {
  const permalinkMatch = value.match(/^p(\d{10})(\d{6})$/)
  return permalinkMatch ? `${permalinkMatch[1]}.${permalinkMatch[2]}` : value
}

function getLegacyTranslationCacheId(
  message: RawSlackMessage,
  settings: ProviderSettings,
  context: ThreadContextPlan,
): string {
  return stableHash([
    message.workspaceId ?? "",
    message.conversationId ?? "",
    message.messageId,
    message.sourceText,
    settings.baseUrl,
    settings.model,
    settings.targetLanguage,
    context.summary ?? "",
    context.recentMessages.map((item) => `${item.messageId}\u0001${item.timestamp}\u0001${item.sourceText}`).join("\u0002"),
  ].join("\u0000"))
}

function stableHash(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `v1-${(hash >>> 0).toString(16)}`
}

async function getEntry(id: string): Promise<TranslationCacheEntry | undefined> {
  const database = await openDatabase()
  return transaction(database, "readonly", (store) => store.get(id)) as Promise<TranslationCacheEntry | undefined>
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
      if (!request.result.objectStoreNames.contains("context-messages")) {
        const contextStore = request.result.createObjectStore("context-messages", { keyPath: "id" })
        contextStore.createIndex("threadKey", "threadKey", { unique: false })
      }
      if (!request.result.objectStoreNames.contains("context-threads")) {
        request.result.createObjectStore("context-threads", { keyPath: "threadKey" })
      }
      if (!request.result.objectStoreNames.contains("thread-summaries")) {
        request.result.createObjectStore("thread-summaries", { keyPath: "threadKey" })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
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
