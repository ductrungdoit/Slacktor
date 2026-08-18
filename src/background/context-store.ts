import type { RawSlackMessage, ThreadContextMessage, ThreadContextPlan } from "../shared/types"

type StoredContextMessage = RawSlackMessage & {
  id: string
  threadKey?: string
  observedAt: number
}

type StoredContextThread = {
  threadKey: string
  lastActivityAt: number
}

export type StoredThreadSummary = {
  threadKey: string
  summary: string
  sourceFingerprint: string
  updatedAt: number
}

const DATABASE_NAME = "slacktor"
const STORE_NAME = "context-messages"
const THREAD_STORE_NAME = "context-threads"
const SUMMARY_STORE_NAME = "thread-summaries"
const DATABASE_VERSION = 5
const MAX_CONTEXT_MESSAGES = 20
const MAX_CONTEXT_CHARACTERS = 12000
const RECENT_CONTEXT_MESSAGES = 8
const SUMMARY_REFRESH_MS = 60 * 1000
const CONTEXT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000
const CLEANUP_WRITE_INTERVAL = 100
let writesSinceCleanup = 0
let lastCleanupAt = 0
const summaryRefreshes = new Map<string, Promise<void>>()

export async function saveContextMessage(message: RawSlackMessage): Promise<void> {
  const database = await openDatabase()
  const entry: StoredContextMessage = {
    ...message,
    id: messageKey(message),
    threadKey: getThreadKey(message),
    observedAt: Date.now(),
  }
  await transaction(database, "readwrite", (store) => store.put(entry))

  if (entry.threadKey) {
    const activity: StoredContextThread = {
      threadKey: entry.threadKey,
      lastActivityAt: Date.now(),
    }
    await transactionForStore(database, THREAD_STORE_NAME, "readwrite", (store) => store.put(activity))
    await refreshRootActivity(database, message, activity.lastActivityAt)
  }
  writesSinceCleanup += 1
  if (
    writesSinceCleanup >= CLEANUP_WRITE_INTERVAL ||
    Date.now() - lastCleanupAt >= CLEANUP_INTERVAL_MS
  ) {
    writesSinceCleanup = 0
    lastCleanupAt = Date.now()
    void cleanupInactiveContext(database)
  }
}

export async function getThreadContext(target: RawSlackMessage): Promise<ThreadContextMessage[]> {
  const messages = await getAllThreadMessages(target)
  return selectContextMessages(messages)
}

export async function buildThreadContextPlan(
  target: RawSlackMessage,
  summarize: (messages: ThreadContextMessage[]) => Promise<string>,
): Promise<ThreadContextPlan> {
  const messages = await getAllThreadMessages(target)
  const fullContext = messages.map(toThreadContextMessage)
  if (fullContext.length <= MAX_CONTEXT_MESSAGES && countCharacters(fullContext) <= MAX_CONTEXT_CHARACTERS) {
    return { recentMessages: fullContext }
  }

  const threadKey = getThreadKey(target)
  if (!threadKey) return { recentMessages: selectContextMessages(messages) }

  const recent = fullContext.slice(-RECENT_CONTEXT_MESSAGES)
  const older = fullContext.slice(0, -RECENT_CONTEXT_MESSAGES)
  const sourceFingerprint = fingerprint(older)
  const saved = await getThreadSummary(threadKey)
  const needsRefresh = !saved || saved.sourceFingerprint !== sourceFingerprint
  const canRefresh = !saved || Date.now() - saved.updatedAt >= SUMMARY_REFRESH_MS

  if (needsRefresh && canRefresh) {
    // Never put an extra AI summary request on the translation critical path.
    // One background refresh is shared by all jobs from the same long thread.
    scheduleSummaryRefresh(threadKey, sourceFingerprint, older, summarize)
  }

  return { summary: saved?.summary, recentMessages: recent }
}

function scheduleSummaryRefresh(
  threadKey: string,
  sourceFingerprint: string,
  older: ThreadContextMessage[],
  summarize: (messages: ThreadContextMessage[]) => Promise<string>,
): void {
  if (summaryRefreshes.has(threadKey)) return

  const refresh = summarize(older)
    .then((summary) => saveThreadSummary({ threadKey, summary, sourceFingerprint, updatedAt: Date.now() }))
    .catch(() => {
      // Recent raw context remains available when a summary request fails.
    })
    .finally(() => summaryRefreshes.delete(threadKey))
  summaryRefreshes.set(threadKey, refresh)
}

export async function getAllThreadMessages(target: RawSlackMessage): Promise<StoredContextMessage[]> {
  const threadKey = getThreadKey(target)
  if (!threadKey || !target.timestamp) return []

  const database = await openDatabase()
  const [replies, root] = await Promise.all([
    getByIndex<StoredContextMessage>(database, "threadKey", threadKey),
    getEntry<StoredContextMessage>(database, messageKey({
      ...target,
      messageId: target.threadRootTs!,
    })),
  ])
  return [...(root ? [root] : []), ...replies]
    .filter((message) => {
      if (message.messageId === target.messageId || !message.timestamp) return false
      return true
    })
    .sort((left, right) => compareSlackTimestamp(left.timestamp!, right.timestamp!))
}

export async function getThreadSummary(threadKey: string): Promise<StoredThreadSummary | undefined> {
  const database = await openDatabase()
  return getEntryFromStore<StoredThreadSummary>(database, SUMMARY_STORE_NAME, threadKey)
}

export async function saveThreadSummary(summary: StoredThreadSummary): Promise<void> {
  const database = await openDatabase()
  await transactionForStore(database, SUMMARY_STORE_NAME, "readwrite", (store) => store.put(summary))
}

export function getContextThreadKey(message: RawSlackMessage): string | undefined {
  return getThreadKey(message)
}

export function toContextMessages(messages: StoredContextMessage[]): ThreadContextMessage[] {
  return messages.map(toThreadContextMessage)
}

function selectContextMessages(
  messages: StoredContextMessage[],
  rootId?: string,
): ThreadContextMessage[] {
  const root = rootId ? messages.find((message) => message.id === rootId) : undefined
  const remaining = messages.filter((message) => message.id !== root?.id)
  const selected = root ? [root, ...remaining.slice(-(MAX_CONTEXT_MESSAGES - 1))] : remaining.slice(-MAX_CONTEXT_MESSAGES)

  let usedCharacters = 0
  const context: ThreadContextMessage[] = []
  for (const message of selected) {
    if (usedCharacters + message.sourceText.length > MAX_CONTEXT_CHARACTERS) continue
    context.push(toThreadContextMessage(message))
    usedCharacters += message.sourceText.length
  }
  return context
}

function countCharacters(messages: ThreadContextMessage[]): number {
  return messages.reduce((total, message) => total + message.sourceText.length, 0)
}

function fingerprint(messages: ThreadContextMessage[]): string {
  let hash = 2166136261
  for (const value of messages.map((message) => `${message.messageId}\u0001${message.sourceText}`).join("\u0002")) {
    hash ^= value.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `v1-${(hash >>> 0).toString(16)}`
}

export async function inspectThreadContextByUrl(url: string): Promise<{
  target?: StoredContextMessage
  context: ThreadContextMessage[]
  storedThreadMessages?: ThreadContextMessage[]
  threadRootTs?: string
  threadKey?: string
  reason?: string
}> {
  const parsed = parseSlackPermalink(url)
  if (!parsed) return { context: [], reason: "Invalid Slack message URL." }

  const database = await openDatabase()
  const messages = await getAll<StoredContextMessage>(database, STORE_NAME)
  const target = messages.find(
    (message) => message.conversationId === parsed.conversationId && message.messageId === parsed.messageId,
  )
  if (!target) {
    return {
      context: [],
      reason: "Message is not in Slacktor context storage yet. Open its channel or thread first.",
    }
  }
  // A copied Slack reply permalink includes thread_ts even if an older content
  // script observed the reply before the DOM adapter extracted that field.
  const targetWithPermalinkThread: StoredContextMessage = {
    ...target,
    threadRootTs: target.threadRootTs ?? parsed.threadRootTs,
  }
  const repairedThreadKey = getThreadKey(targetWithPermalinkThread)
  if (repairedThreadKey && target.threadKey !== repairedThreadKey) {
    // Records written during earlier adapter revisions can have threadRootTs
    // without the derived index key. Repair both forms lazily from a permalink
    // rather than requiring users to clear IndexedDB and re-open every thread.
    targetWithPermalinkThread.threadKey = repairedThreadKey
    await transaction(database, "readwrite", (store) => store.put(targetWithPermalinkThread))
  }
  if (repairedThreadKey) {
    // Messages from older content-script revisions may have been persisted
    // without threadRootTs. A reply permalink proves the active thread, so
    // repair same-channel records that are already known to be replies in this
    // thread without asking the user to clear IndexedDB.
    const repairCandidates = messages.filter(
      (message) =>
        message.conversationId === targetWithPermalinkThread.conversationId &&
        message.threadRootTs === targetWithPermalinkThread.threadRootTs &&
        message.threadKey !== repairedThreadKey,
    )
    await Promise.all(repairCandidates.map((message) => transaction(database, "readwrite", (store) => store.put({
      ...message,
      threadKey: repairedThreadKey,
    }))))
  }
  const threadKey = getThreadKey(targetWithPermalinkThread)
  const storedThreadMessages = targetWithPermalinkThread.threadRootTs && threadKey
    ? await getByIndex<StoredContextMessage>(database, "threadKey", threadKey)
    : []
  const storedRoot = targetWithPermalinkThread.threadRootTs
    ? await getEntry<StoredContextMessage>(database, messageKey({
      ...targetWithPermalinkThread,
      messageId: targetWithPermalinkThread.threadRootTs,
    }))
    : undefined

  return {
    target: targetWithPermalinkThread,
    // Build from every persisted message in this thread, including replies
    // after the target. Thread-wide context lets the model resolve references
    // using the whole discussion rather than only the opening message.
    context: selectContextMessages(
      [...(storedRoot ? [storedRoot] : []), ...storedThreadMessages]
        .filter((message) => {
          if (message.messageId === targetWithPermalinkThread.messageId || !message.timestamp) return false
          return true
        })
        .filter((message, index, messages) => messages.findIndex((item) => item.id === message.id) === index)
        .sort((left, right) => compareSlackTimestamp(left.timestamp!, right.timestamp!)),
      storedRoot?.id,
    ),
    storedThreadMessages: [...(storedRoot ? [storedRoot] : []), ...storedThreadMessages]
      .filter((message, index, messages) => messages.findIndex((item) => item.id === message.id) === index)
      .sort((left, right) => compareSlackTimestamp(left.timestamp ?? "0", right.timestamp ?? "0"))
      .map(toThreadContextMessage),
    threadRootTs: targetWithPermalinkThread.threadRootTs,
    threadKey,
    reason: targetWithPermalinkThread.threadRootTs
      ? undefined
      : "This is the thread root, or Slacktor could not identify this message as a reply. A root has no prior thread context.",
  }
}

function getThreadKey(message: RawSlackMessage): string | undefined {
  const rootTimestamp = message.threadRootTs
  if (!rootTimestamp || !message.conversationId) return undefined
  return [message.workspaceId, message.conversationId, rootTimestamp]
    .filter((part): part is string => Boolean(part))
    .join(":")
}

function messageKey(message: RawSlackMessage): string {
  return [message.workspaceId ?? "", message.conversationId ?? "", message.messageId].join(":")
}

function compareSlackTimestamp(left: string, right: string): number {
  return Number.parseFloat(left) - Number.parseFloat(right)
}

function toThreadContextMessage(message: StoredContextMessage): ThreadContextMessage {
  return {
    messageId: message.messageId,
    timestamp: message.timestamp!,
    authorName: message.author.status === "resolved" ? message.author.displayName : undefined,
    sourceText: message.sourceText,
  }
}

function parseSlackPermalink(url: string): {
  conversationId: string
  messageId: string
  threadRootTs?: string
} | undefined {
  try {
    const parsed = new URL(url)
    const match = parsed.pathname.match(/\/archives\/([^/]+)\/p(\d{10})(\d{6})/)
    if (!match) return undefined
    return {
      conversationId: match[1],
      messageId: `${match[2]}.${match[3]}`,
      threadRootTs: parsed.searchParams.get("thread_ts") ?? undefined,
    }
  } catch {
    return undefined
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("translations")) {
        request.result.createObjectStore("translations", { keyPath: "id" })
      }
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        const store = request.result.createObjectStore(STORE_NAME, { keyPath: "id" })
        store.createIndex("threadKey", "threadKey", { unique: false })
      }
      if (!request.result.objectStoreNames.contains(THREAD_STORE_NAME)) {
        request.result.createObjectStore(THREAD_STORE_NAME, { keyPath: "threadKey" })
      }
      if (!request.result.objectStoreNames.contains(SUMMARY_STORE_NAME)) {
        request.result.createObjectStore(SUMMARY_STORE_NAME, { keyPath: "threadKey" })
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

function transactionForStore<T>(
  database: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = operation(database.transaction(storeName, mode).objectStore(storeName))
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

function getEntry<T>(database: IDBDatabase, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result as T | undefined)
  })
}

function getEntryFromStore<T>(database: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).get(key)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result as T | undefined)
  })
}

function getByIndex<T>(database: IDBDatabase, indexName: string, key: IDBValidKey): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).index(indexName).getAll(key)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result as T[])
  })
}

async function refreshRootActivity(
  database: IDBDatabase,
  message: RawSlackMessage,
  observedAt: number,
): Promise<void> {
  if (!message.threadRootTs) return
  const rootKey = messageKey({ ...message, messageId: message.threadRootTs })
  const root = await getEntry<StoredContextMessage>(database, rootKey)
  if (!root) return
  await transaction(database, "readwrite", (store) => store.put({ ...root, observedAt }))
}

async function cleanupInactiveContext(database: IDBDatabase): Promise<void> {
  const cutoff = Date.now() - CONTEXT_RETENTION_MS
  const threads = await getAll<StoredContextThread>(database, THREAD_STORE_NAME)
  const expiredThreadKeys = threads
    .filter((thread) => thread.lastActivityAt < cutoff)
    .map((thread) => thread.threadKey)

  for (const threadKey of expiredThreadKeys) {
    const entries = await getByIndex<StoredContextMessage>(database, "threadKey", threadKey)
    for (const entry of entries) {
      await transaction(database, "readwrite", (store) => store.delete(entry.id))
    }
    await transactionForStore(database, THREAD_STORE_NAME, "readwrite", (store) => store.delete(threadKey))
  }

  // Standalone messages and roots never associated with a known active thread
  // use their own last-observed time as the retention fallback.
  const messages = await getAll<StoredContextMessage>(database, STORE_NAME)
  for (const message of messages) {
    if (!message.threadKey && message.observedAt < cutoff) {
      await transaction(database, "readwrite", (store) => store.delete(message.id))
    }
  }
}

function getAll<T>(database: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result as T[])
  })
}
