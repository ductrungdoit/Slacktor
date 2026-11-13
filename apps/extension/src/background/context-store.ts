import {
  normalizeSlackMessageId,
  type RawSlackMessage,
  type ThreadContextMessage,
  type ThreadContextPlan,
} from "../shared/types"
import { SLACKTOR_DB_VERSION } from "../shared/version"
import type { SummarizeContextOptions } from "./summary-service"

type StoredContextMessage = RawSlackMessage & {
  id: string
  channelKey?: string
  threadKey?: string
  timestampValue?: number
  translatedText?: string
  translatedLanguage?: string
  observedAt: number
}

type StoredContextThread = {
  threadKey: string
  lastActivityAt: number
}

export type StoredThreadSummary = {
  threadKey: string
  scopeType?: "thread" | "channel"
  summary: string
  sourceFingerprint: string
  summarizedUpToTs?: number
  summarizedCount?: number
  updatedAt: number
}

const DATABASE_NAME = "slacktor"
const STORE_NAME = "context-messages"
const THREAD_STORE_NAME = "context-threads"
const SUMMARY_STORE_NAME = "thread-summaries"
const MAX_CONTEXT_MESSAGES = 20
const MAX_CONTEXT_CHARACTERS = 12000
const RECENT_CONTEXT_MESSAGES = 8
const RECENT_CHANNEL_CONTEXT_MESSAGES = 6
const CHANNEL_SUMMARY_MIN_MESSAGES = 12
const CHANNEL_SESSION_WINDOW_SECONDS = 6 * 60 * 60
const CHANNEL_SESSION_GAP_SECONDS = 3 * 60 * 60
const CHANNEL_BRIDGE_WINDOW_SECONDS = 30 * 60
const MAX_CHANNEL_BRIDGE_MESSAGES = 3
const MAX_CHANNEL_STORED_MESSAGES = 150
const SUMMARY_WATERMARK_STEP = 6
const MAX_SUMMARY_INPUT_MESSAGES = 24
const MAX_BILINGUAL_CONTEXT_MESSAGES = 3
const MAX_TRANSLATED_CONTEXT_CHARS = 600
const SUMMARY_REFRESH_MS = 60 * 1000
const CONTEXT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000
const CLEANUP_WRITE_INTERVAL = 100
let writesSinceCleanup = 0
let lastCleanupAt = 0
const summaryRefreshes = new Map<string, Promise<void>>()

export async function saveContextMessage(
  message: RawSlackMessage,
  cachedTranslation?: { translation: string; targetLanguage: string },
): Promise<void> {
  const database = await openDatabase()
  const id = messageKey(message)
  const existing = await getEntry<StoredContextMessage>(database, id)
  const preserveExistingTranslation =
    existing && existing.sourceText === message.sourceText && !cachedTranslation
  const validCachedTranslation =
    cachedTranslation &&
    cachedTranslation.translation &&
    cachedTranslation.translation !== "__SLKT_SAME_LANG__"
      ? cachedTranslation
      : undefined

  const entry: StoredContextMessage = {
    ...message,
    id,
    channelKey: getChannelKey(message) ?? existing?.channelKey,
    threadKey: getThreadKey(message) ?? existing?.threadKey,
    timestampValue:
      parseSlackTimestampValue(message.timestamp ?? message.messageId) ?? existing?.timestampValue,
    translatedText: validCachedTranslation
      ? validCachedTranslation.translation.slice(0, MAX_TRANSLATED_CONTEXT_CHARS)
      : preserveExistingTranslation
        ? existing.translatedText
        : undefined,
    translatedLanguage: validCachedTranslation
      ? validCachedTranslation.targetLanguage.trim()
      : preserveExistingTranslation
        ? existing.translatedLanguage
        : undefined,
    observedAt: Date.now(),
  }
  await transaction(database, "readwrite", (store) => store.put(entry))

  const activityScopeKey = entry.threadKey ?? entry.channelKey
  if (activityScopeKey) {
    const activity: StoredContextThread = {
      threadKey: activityScopeKey,
      lastActivityAt: Date.now(),
    }
    await transactionForStore(database, THREAD_STORE_NAME, "readwrite", (store) =>
      store.put(activity),
    )
    if (entry.threadKey) {
      await refreshRootActivity(database, message, activity.lastActivityAt)
    }
  }
  writesSinceCleanup += 1
  if (
    writesSinceCleanup >= CLEANUP_WRITE_INTERVAL ||
    Date.now() - lastCleanupAt >= CLEANUP_INTERVAL_MS
  ) {
    writesSinceCleanup = 0
    lastCleanupAt = Date.now()
    void cleanupInactiveContext(database, entry.channelKey)
  }
}

export async function saveContextMessageTranslation(
  message: RawSlackMessage,
  translation: string,
  targetLanguage: string,
): Promise<void> {
  if (!translation || translation === "__SLKT_SAME_LANG__") return
  try {
    const database = await openDatabase()
    const id = messageKey(message)
    const existing = await getEntry<StoredContextMessage>(database, id)
    const truncated = translation.slice(0, MAX_TRANSLATED_CONTEXT_CHARS)
    const normalizedLang = targetLanguage.trim()
    if (existing) {
      if (existing.translatedText === truncated && existing.translatedLanguage === normalizedLang) {
        return
      }
      await transaction(database, "readwrite", (store) =>
        store.put({
          ...existing,
          translatedText: truncated,
          translatedLanguage: normalizedLang,
        }),
      )
      return
    }
    const entry: StoredContextMessage = {
      ...message,
      id,
      channelKey: getChannelKey(message),
      threadKey: getThreadKey(message),
      timestampValue: parseSlackTimestampValue(message.timestamp ?? message.messageId),
      translatedText: truncated,
      translatedLanguage: normalizedLang,
      observedAt: Date.now(),
    }
    await transaction(database, "readwrite", (store) => store.put(entry))
  } catch {
    // Best-effort bilingual context update must never fail translation flow.
  }
}

export async function getThreadContext(
  target: RawSlackMessage,
  targetLanguage?: string,
): Promise<ThreadContextMessage[]> {
  const threadKey = getThreadKey(target)
  if (threadKey) {
    const messages = await getAllThreadMessages(target)
    const rootId = target.threadRootTs
      ? messageKey({ ...target, messageId: target.threadRootTs })
      : undefined
    return selectContextMessages(messages, rootId, targetLanguage)
  }
  const channelMessages = await getCausalChannelMessages(target)
  return selectContextMessages(channelMessages, undefined, targetLanguage)
}

export async function buildThreadContextPlan(
  target: RawSlackMessage,
  summarize: (
    messages: ThreadContextMessage[],
    options?: SummarizeContextOptions,
  ) => Promise<string>,
  targetLanguage?: string,
): Promise<ThreadContextPlan> {
  const threadKey = getThreadKey(target)
  if (threadKey) {
    return buildScopedThreadPlan(target, threadKey, summarize, targetLanguage)
  }
  const channelKey = getChannelKey(target)
  if (channelKey) {
    return buildScopedChannelPlan(target, channelKey, summarize, targetLanguage)
  }
  return { recentMessages: [] }
}

async function buildScopedThreadPlan(
  target: RawSlackMessage,
  threadKey: string,
  summarize: (
    messages: ThreadContextMessage[],
    options?: SummarizeContextOptions,
  ) => Promise<string>,
  targetLanguage?: string,
): Promise<ThreadContextPlan> {
  const database = await openDatabase()
  const allThreadMessages = await getAllThreadMessages(target, database)
  const rootNormalizedId = target.threadRootTs
    ? normalizeSlackMessageId(target.threadRootTs)
    : undefined
  const rootStored = rootNormalizedId
    ? allThreadMessages.find(
        (message) => normalizeSlackMessageId(message.messageId) === rootNormalizedId,
      )
    : undefined
  const targetTs = parseSlackTimestampValue(target.timestamp ?? target.messageId)

  // Filter to causal ancestors (messages at or before targetTs, plus thread root).
  const causalStored =
    targetTs !== undefined
      ? allThreadMessages.filter((message) => {
          if (rootStored && message.id === rootStored.id) return true
          const msgTs =
            message.timestampValue ??
            parseSlackTimestampValue(message.timestamp ?? message.messageId)
          return msgTs === undefined || msgTs <= targetTs
        })
      : allThreadMessages

  const effectiveStored = causalStored.length > 0 ? causalStored : allThreadMessages
  const rootMessage = rootStored
    ? toThreadContextMessage(rootStored, targetLanguage, true, true)
    : undefined

  // When a thread is newly started (< 3 prior messages in the thread), bridge
  // up to 3 messages from the main channel immediately preceding the thread root.
  const channelBridgeMessages =
    effectiveStored.length < 3
      ? await getChannelBridgeMessages(database, target, rootStored, targetLanguage)
      : undefined

  const fullContext = toBilingualContextMessages(effectiveStored, rootStored?.id, targetLanguage)

  if (
    fullContext.length <= RECENT_CONTEXT_MESSAGES &&
    countCharacters(fullContext) <= MAX_CONTEXT_CHARACTERS
  ) {
    return {
      scopeType: "thread",
      rootMessage,
      channelBridgeMessages:
        channelBridgeMessages && channelBridgeMessages.length > 0
          ? channelBridgeMessages
          : undefined,
      recentMessages: selectContextMessages(effectiveStored, rootStored?.id, targetLanguage),
    }
  }

  const nonRootStored = rootStored
    ? effectiveStored.filter((message) => message.id !== rootStored.id)
    : effectiveStored
  const recentLimit = rootStored ? RECENT_CONTEXT_MESSAGES - 1 : RECENT_CONTEXT_MESSAGES
  const recentStored = [...(rootStored ? [rootStored] : []), ...nonRootStored.slice(-recentLimit)]
  const olderStored = nonRootStored.slice(0, -recentLimit)
  const recent = selectContextMessages(recentStored, rootStored?.id, targetLanguage)

  if (olderStored.length === 0) {
    return {
      scopeType: "thread",
      rootMessage,
      channelBridgeMessages:
        channelBridgeMessages && channelBridgeMessages.length > 0
          ? channelBridgeMessages
          : undefined,
      recentMessages: recent,
    }
  }

  const olderWithRoot = [
    ...(rootStored ? [toThreadContextMessage(rootStored, targetLanguage, true, false)] : []),
    ...olderStored.map((item) => toThreadContextMessage(item, targetLanguage, false, false)),
  ]
  const lastOlderTs =
    olderStored[olderStored.length - 1]?.timestampValue ??
    parseSlackTimestampValue(olderStored[olderStored.length - 1]?.timestamp ?? "")
  const saved = await getThreadSummary(threadKey, database)

  maybeScheduleIncrementalSummary({
    scopeKey: threadKey,
    scopeType: "thread",
    olderMessages: olderWithRoot,
    olderStored,
    lastOlderTs,
    saved,
    summarize,
  })

  return {
    scopeType: "thread",
    summary: saved?.summary,
    rootMessage,
    channelBridgeMessages:
      channelBridgeMessages && channelBridgeMessages.length > 0 ? channelBridgeMessages : undefined,
    recentMessages: recent,
  }
}

async function buildScopedChannelPlan(
  target: RawSlackMessage,
  channelKey: string,
  summarize: (
    messages: ThreadContextMessage[],
    options?: SummarizeContextOptions,
  ) => Promise<string>,
  targetLanguage?: string,
): Promise<ThreadContextPlan> {
  const database = await openDatabase()
  const sessionStored = await getCausalChannelMessages(target, database)
  if (sessionStored.length === 0) {
    return { scopeType: "channel", recentMessages: [] }
  }

  if (sessionStored.length <= RECENT_CHANNEL_CONTEXT_MESSAGES) {
    return {
      scopeType: "channel",
      recentMessages: selectContextMessages(
        sessionStored,
        undefined,
        targetLanguage,
        RECENT_CHANNEL_CONTEXT_MESSAGES,
      ),
    }
  }

  const recentStored = sessionStored.slice(-RECENT_CHANNEL_CONTEXT_MESSAGES)
  const olderStored = sessionStored.slice(0, -RECENT_CHANNEL_CONTEXT_MESSAGES)
  const recent = selectContextMessages(
    recentStored,
    undefined,
    targetLanguage,
    RECENT_CHANNEL_CONTEXT_MESSAGES,
  )
  const saved = await getThreadSummary(channelKey, database)

  if (sessionStored.length >= CHANNEL_SUMMARY_MIN_MESSAGES && olderStored.length > 0) {
    const olderContext = olderStored.map((item) =>
      toThreadContextMessage(item, targetLanguage, false, false),
    )
    const lastOlderTs =
      olderStored[olderStored.length - 1]?.timestampValue ??
      parseSlackTimestampValue(olderStored[olderStored.length - 1]?.timestamp ?? "")
    maybeScheduleIncrementalSummary({
      scopeKey: channelKey,
      scopeType: "channel",
      olderMessages: olderContext,
      olderStored,
      lastOlderTs,
      saved,
      summarize,
    })
  }

  return {
    scopeType: "channel",
    summary: saved?.summary,
    recentMessages: recent,
  }
}

function maybeScheduleIncrementalSummary(params: {
  scopeKey: string
  scopeType: "thread" | "channel"
  olderMessages: ThreadContextMessage[]
  olderStored: StoredContextMessage[]
  lastOlderTs: number | undefined
  saved: StoredThreadSummary | undefined
  summarize: (
    messages: ThreadContextMessage[],
    options?: SummarizeContextOptions,
  ) => Promise<string>
}): void {
  const { scopeKey, scopeType, olderMessages, olderStored, lastOlderTs, saved, summarize } = params
  const sourceFingerprint = fingerprint(olderMessages)
  if (saved && saved.sourceFingerprint === sourceFingerprint) return

  const canRefreshByCooldown = !saved || Date.now() - saved.updatedAt >= SUMMARY_REFRESH_MS
  if (!canRefreshByCooldown) return

  if (!saved) {
    const initialInput =
      olderMessages.length > MAX_SUMMARY_INPUT_MESSAGES
        ? [olderMessages[0]!, ...olderMessages.slice(-(MAX_SUMMARY_INPUT_MESSAGES - 1))]
        : olderMessages
    scheduleSummaryRefresh({
      scopeKey,
      scopeType,
      sourceFingerprint,
      summarizedUpToTs: lastOlderTs,
      summarizedCount: olderStored.length,
      messagesToSummarize: initialInput,
      previousSummary: undefined,
      summarize,
    })
    return
  }

  // Watermark check: only re-summarize when at least SUMMARY_WATERMARK_STEP new
  // messages have spilled out of the recent window since the last summary.
  const watermarkTs = saved.summarizedUpToTs
  if (watermarkTs !== undefined) {
    const deltaStored = olderStored.filter((item) => {
      const ts = item.timestampValue ?? parseSlackTimestampValue(item.timestamp ?? item.messageId)
      return ts !== undefined && ts > watermarkTs
    })
    if (deltaStored.length < SUMMARY_WATERMARK_STEP) {
      return
    }
    const deltaContext = deltaStored
      .slice(-MAX_SUMMARY_INPUT_MESSAGES)
      .map((item) => toThreadContextMessage(item))
    scheduleSummaryRefresh({
      scopeKey,
      scopeType,
      sourceFingerprint,
      summarizedUpToTs: lastOlderTs,
      summarizedCount: olderStored.length,
      messagesToSummarize: deltaContext,
      previousSummary: saved.summary,
      summarize,
    })
    return
  }

  const countDelta = olderStored.length - (saved.summarizedCount ?? 0)
  if (saved.summarizedCount !== undefined && countDelta < SUMMARY_WATERMARK_STEP) {
    return
  }
  const fallbackInput = olderMessages.slice(-MAX_SUMMARY_INPUT_MESSAGES)
  scheduleSummaryRefresh({
    scopeKey,
    scopeType,
    sourceFingerprint,
    summarizedUpToTs: lastOlderTs,
    summarizedCount: olderStored.length,
    messagesToSummarize: fallbackInput,
    previousSummary: saved.summary,
    summarize,
  })
}

function scheduleSummaryRefresh(params: {
  scopeKey: string
  scopeType: "thread" | "channel"
  sourceFingerprint: string
  summarizedUpToTs?: number
  summarizedCount: number
  messagesToSummarize: ThreadContextMessage[]
  previousSummary?: string
  summarize: (
    messages: ThreadContextMessage[],
    options?: SummarizeContextOptions,
  ) => Promise<string>
}): void {
  const {
    scopeKey,
    scopeType,
    sourceFingerprint,
    summarizedUpToTs,
    summarizedCount,
    messagesToSummarize,
    previousSummary,
    summarize,
  } = params
  if (summaryRefreshes.has(scopeKey)) return

  const refresh = summarize(messagesToSummarize, { previousSummary, scopeType })
    .then((summary) =>
      saveThreadSummary({
        threadKey: scopeKey,
        scopeType,
        summary,
        sourceFingerprint,
        summarizedUpToTs,
        summarizedCount,
        updatedAt: Date.now(),
      }),
    )
    .catch(() => {
      // Recent raw context remains available when a summary request fails.
    })
    .finally(() => summaryRefreshes.delete(scopeKey))
  summaryRefreshes.set(scopeKey, refresh)
}

export async function getAllThreadMessages(
  target: RawSlackMessage,
  existingDb?: IDBDatabase,
): Promise<StoredContextMessage[]> {
  const threadKey = getThreadKey(target)
  if (!threadKey || !target.timestamp) return []

  const database = existingDb ?? (await openDatabase())
  const [indexedByRange, root] = await Promise.all([
    getByIndexRange<StoredContextMessage>(
      database,
      "byThreadTs",
      IDBKeyRange.bound([threadKey, 0], [threadKey, Number.MAX_SAFE_INTEGER]),
    ).catch(() => [] as StoredContextMessage[]),
    getEntry<StoredContextMessage>(
      database,
      messageKey({
        ...target,
        messageId: target.threadRootTs!,
      }),
    ),
  ])
  const replies =
    indexedByRange.length > 0
      ? indexedByRange
      : await getByIndex<StoredContextMessage>(database, "threadKey", threadKey)

  const targetNormalizedId = normalizeSlackMessageId(target.messageId)
  const seenIds = new Set<string>()
  return [...(root ? [root] : []), ...replies]
    .filter((message) => {
      if (normalizeSlackMessageId(message.messageId) === targetNormalizedId || !message.timestamp)
        return false
      if (seenIds.has(message.id)) return false
      seenIds.add(message.id)
      return true
    })
    .sort((left, right) => compareSlackTimestamp(left.timestamp!, right.timestamp!))
}

export async function getCausalChannelMessages(
  target: RawSlackMessage,
  existingDb?: IDBDatabase,
): Promise<StoredContextMessage[]> {
  const channelKey = getChannelKey(target)
  const targetTs = parseSlackTimestampValue(target.timestamp ?? target.messageId)
  if (!channelKey || targetTs === undefined) return []

  const database = existingDb ?? (await openDatabase())
  const minTs = Math.max(0, targetTs - CHANNEL_SESSION_WINDOW_SECONDS)
  const candidates = await getByIndexRange<StoredContextMessage>(
    database,
    "byChannelTs",
    IDBKeyRange.bound([channelKey, minTs], [channelKey, targetTs]),
  ).catch(() => [] as StoredContextMessage[])

  const targetNormalizedId = normalizeSlackMessageId(target.messageId)
  const mainStreamMessages = candidates
    .filter((message) => {
      if (!message.timestamp) return false
      if (normalizeSlackMessageId(message.messageId) === targetNormalizedId) return false
      // Exclude internal thread-only replies from main channel linear context;
      // keep standalone channel messages and thread root messages.
      if (message.threadRootTs) {
        const isRoot =
          normalizeSlackMessageId(message.messageId) ===
          normalizeSlackMessageId(message.threadRootTs)
        if (!isRoot) return false
      }
      return true
    })
    .sort((left, right) => compareSlackTimestamp(left.timestamp!, right.timestamp!))

  if (mainStreamMessages.length === 0) return []

  // Enforce session continuity: stop walking backwards if there is a gap > 3 hours.
  const sessionMessages: StoredContextMessage[] = []
  let nextTimestamp = targetTs
  for (let index = mainStreamMessages.length - 1; index >= 0; index -= 1) {
    const current = mainStreamMessages[index]!
    const currentTs =
      current.timestampValue ?? parseSlackTimestampValue(current.timestamp ?? current.messageId)
    if (currentTs === undefined) continue
    if (nextTimestamp - currentTs > CHANNEL_SESSION_GAP_SECONDS) {
      break
    }
    sessionMessages.push(current)
    nextTimestamp = currentTs
  }
  return sessionMessages.reverse()
}

async function getChannelBridgeMessages(
  database: IDBDatabase,
  target: RawSlackMessage,
  rootStored: StoredContextMessage | undefined,
  targetLanguage?: string,
): Promise<ThreadContextMessage[]> {
  const channelKey = getChannelKey(target)
  const rootTsStr = rootStored?.timestamp ?? target.threadRootTs
  const rootTs = parseSlackTimestampValue(rootTsStr)
  if (!channelKey || rootTs === undefined) return []

  const minTs = Math.max(0, rootTs - CHANNEL_BRIDGE_WINDOW_SECONDS)
  const candidates = await getByIndexRange<StoredContextMessage>(
    database,
    "byChannelTs",
    IDBKeyRange.bound([channelKey, minTs], [channelKey, rootTs], false, true),
  ).catch(() => [] as StoredContextMessage[])

  const targetNormalizedId = normalizeSlackMessageId(target.messageId)
  const rootNormalizedId = target.threadRootTs
    ? normalizeSlackMessageId(target.threadRootTs)
    : undefined

  const filtered = candidates
    .filter((message) => {
      if (!message.timestamp) return false
      const normId = normalizeSlackMessageId(message.messageId)
      if (normId === targetNormalizedId || normId === rootNormalizedId) return false
      if (message.threadRootTs) {
        const isOtherRoot = normId === normalizeSlackMessageId(message.threadRootTs)
        if (!isOtherRoot) return false
      }
      return true
    })
    .sort((left, right) => compareSlackTimestamp(left.timestamp!, right.timestamp!))
    .slice(-MAX_CHANNEL_BRIDGE_MESSAGES)

  return filtered.map((item) => toThreadContextMessage(item, targetLanguage, false, true))
}

export async function getThreadSummary(
  scopeKey: string,
  existingDb?: IDBDatabase,
): Promise<StoredThreadSummary | undefined> {
  const database = existingDb ?? (await openDatabase())
  return getEntryFromStore<StoredThreadSummary>(database, SUMMARY_STORE_NAME, scopeKey)
}

export async function saveThreadSummary(summary: StoredThreadSummary): Promise<void> {
  const database = await openDatabase()
  await transactionForStore(database, SUMMARY_STORE_NAME, "readwrite", (store) =>
    store.put(summary),
  )
}

export function getContextThreadKey(message: RawSlackMessage): string | undefined {
  return getThreadKey(message)
}

export function getContextChannelKey(message: RawSlackMessage): string | undefined {
  return getChannelKey(message)
}

export function toContextMessages(
  messages: StoredContextMessage[],
  targetLanguage?: string,
): ThreadContextMessage[] {
  return toBilingualContextMessages(messages, undefined, targetLanguage)
}

function toBilingualContextMessages(
  messages: StoredContextMessage[],
  rootId?: string,
  targetLanguage?: string,
): ThreadContextMessage[] {
  const bilingualStartIndex = Math.max(0, messages.length - MAX_BILINGUAL_CONTEXT_MESSAGES)
  return messages.map((message, index) => {
    const isRoot = Boolean(rootId && message.id === rootId)
    const includeTranslation = isRoot || index >= bilingualStartIndex
    return toThreadContextMessage(message, targetLanguage, isRoot, includeTranslation)
  })
}

function selectContextMessages(
  messages: StoredContextMessage[],
  rootId?: string,
  targetLanguage?: string,
  maxMessages = MAX_CONTEXT_MESSAGES,
): ThreadContextMessage[] {
  const root = rootId ? messages.find((message) => message.id === rootId) : undefined
  const remaining = messages.filter((message) => message.id !== root?.id)
  const selected = root
    ? [root, ...remaining.slice(-(maxMessages - 1))]
    : remaining.slice(-maxMessages)

  const bilingualStartIndex = Math.max(0, selected.length - MAX_BILINGUAL_CONTEXT_MESSAGES)
  let usedCharacters = 0
  const context: ThreadContextMessage[] = []
  for (let index = 0; index < selected.length; index += 1) {
    const message = selected[index]!
    if (usedCharacters + message.sourceText.length > MAX_CONTEXT_CHARACTERS) continue
    const isRoot = Boolean(root && message.id === root.id)
    const includeTranslation = isRoot || index >= bilingualStartIndex
    context.push(toThreadContextMessage(message, targetLanguage, isRoot, includeTranslation))
    usedCharacters += message.sourceText.length
  }
  return context
}

function countCharacters(messages: ThreadContextMessage[]): number {
  return messages.reduce((total, message) => total + message.sourceText.length, 0)
}

function fingerprint(messages: ThreadContextMessage[]): string {
  let hash = 2166136261
  for (const value of messages
    .map((message) => `${message.messageId}\u0001${message.sourceText}`)
    .join("\u0002")) {
    hash ^= value.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
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
  const directMatches = await getByIndex<StoredContextMessage>(database, "byConversationMessage", [
    parsed.conversationId,
    parsed.messageId,
  ]).catch(() => [] as StoredContextMessage[])
  let target: StoredContextMessage | undefined = directMatches[0]
  if (!target) {
    const allMessages = await getAll<StoredContextMessage>(database, STORE_NAME)
    target = allMessages.find(
      (message) =>
        message.conversationId === parsed.conversationId &&
        normalizeSlackMessageId(message.messageId) === parsed.messageId,
    )
  }
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
    channelKey: target.channelKey ?? getChannelKey(target),
    timestampValue:
      target.timestampValue ?? parseSlackTimestampValue(target.timestamp ?? target.messageId),
  }
  const repairedThreadKey = getThreadKey(targetWithPermalinkThread)
  if (repairedThreadKey && target.threadKey !== repairedThreadKey) {
    targetWithPermalinkThread.threadKey = repairedThreadKey
    await transaction(database, "readwrite", (store) => store.put(targetWithPermalinkThread))
  }
  const threadKey = getThreadKey(targetWithPermalinkThread)
  if (!targetWithPermalinkThread.threadRootTs || !threadKey) {
    const channelMessages = await getCausalChannelMessages(targetWithPermalinkThread, database)
    return {
      target: targetWithPermalinkThread,
      context: selectContextMessages(
        channelMessages,
        undefined,
        undefined,
        RECENT_CHANNEL_CONTEXT_MESSAGES,
      ),
      storedThreadMessages: channelMessages.map((item) => toThreadContextMessage(item)),
      threadKey: targetWithPermalinkThread.channelKey,
      reason:
        channelMessages.length > 0
          ? undefined
          : "Channel message has no preceding messages in the active session window.",
    }
  }

  const storedThreadMessages = await getAllThreadMessages(targetWithPermalinkThread, database)
  const storedRoot = await getEntry<StoredContextMessage>(
    database,
    messageKey({
      ...targetWithPermalinkThread,
      messageId: targetWithPermalinkThread.threadRootTs,
    }),
  )
  const targetTs = targetWithPermalinkThread.timestampValue
  const causalMessages =
    targetTs !== undefined
      ? storedThreadMessages.filter((message) => {
          if (storedRoot && message.id === storedRoot.id) return true
          const msgTs =
            message.timestampValue ??
            parseSlackTimestampValue(message.timestamp ?? message.messageId)
          return msgTs === undefined || msgTs <= targetTs
        })
      : storedThreadMessages

  return {
    target: targetWithPermalinkThread,
    context: selectContextMessages(causalMessages, storedRoot?.id),
    storedThreadMessages: [...(storedRoot ? [storedRoot] : []), ...storedThreadMessages]
      .filter((message, index, list) => list.findIndex((item) => item.id === message.id) === index)
      .sort((left, right) => compareSlackTimestamp(left.timestamp ?? "0", right.timestamp ?? "0"))
      .map((item) => toThreadContextMessage(item)),
    threadRootTs: targetWithPermalinkThread.threadRootTs,
    threadKey,
  }
}

function getChannelKey(message: RawSlackMessage): string | undefined {
  if (!message.conversationId) return undefined
  return ["channel", message.workspaceId, message.conversationId]
    .filter((part): part is string => Boolean(part))
    .join(":")
}

function getThreadKey(message: RawSlackMessage): string | undefined {
  const rootTimestamp = message.threadRootTs
    ? normalizeSlackMessageId(message.threadRootTs)
    : undefined
  if (!rootTimestamp || !message.conversationId) return undefined
  return [message.workspaceId, message.conversationId, rootTimestamp]
    .filter((part): part is string => Boolean(part))
    .join(":")
}

function messageKey(message: RawSlackMessage): string {
  return [
    message.workspaceId ?? "",
    message.conversationId ?? "",
    normalizeSlackMessageId(message.messageId),
  ].join(":")
}

function parseSlackTimestampValue(value: string | undefined): number | undefined {
  if (!value) return undefined
  const normalized = normalizeSlackMessageId(value)
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

function compareSlackTimestamp(left: string, right: string): number {
  return Number.parseFloat(left) - Number.parseFloat(right)
}

function toThreadContextMessage(
  message: StoredContextMessage,
  targetLanguage?: string,
  isThreadRoot = false,
  includeTranslation = true,
): ThreadContextMessage {
  const hasMatchingTranslation =
    includeTranslation &&
    Boolean(message.translatedText) &&
    (!targetLanguage ||
      !message.translatedLanguage ||
      message.translatedLanguage.toLowerCase() === targetLanguage.trim().toLowerCase())

  return {
    messageId: message.messageId,
    timestamp: message.timestamp ?? normalizeSlackMessageId(message.messageId),
    authorName: message.author.status === "resolved" ? message.author.displayName : undefined,
    sourceText: message.sourceText,
    ...(hasMatchingTranslation ? { translatedText: message.translatedText } : {}),
    ...(isThreadRoot ? { isThreadRoot: true } : {}),
  }
}

function parseSlackPermalink(url: string):
  | {
      conversationId: string
      messageId: string
      threadRootTs?: string
    }
  | undefined {
  try {
    const parsed = new URL(url)
    const match = parsed.pathname.match(/\/archives\/([^/]+)\/p(\d{10})(\d{6})/)
    if (!match) return undefined
    return {
      conversationId: match[1]!,
      messageId: `${match[2]}.${match[3]}`,
      threadRootTs: parsed.searchParams.get("thread_ts") ?? undefined,
    }
  } catch {
    return undefined
  }
}

export function upgradeSlacktorDatabase(request: IDBOpenDBRequest): void {
  const db = request.result
  const tx = request.transaction
  if (!db.objectStoreNames.contains("translations")) {
    db.createObjectStore("translations", { keyPath: "id" })
  }

  let contextStore: IDBObjectStore
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    contextStore = db.createObjectStore(STORE_NAME, { keyPath: "id" })
  } else {
    contextStore = tx!.objectStore(STORE_NAME)
  }
  if (!contextStore.indexNames.contains("threadKey")) {
    contextStore.createIndex("threadKey", "threadKey", { unique: false })
  }
  if (!contextStore.indexNames.contains("byThreadTs")) {
    contextStore.createIndex("byThreadTs", ["threadKey", "timestampValue"], { unique: false })
  }
  if (!contextStore.indexNames.contains("byChannelTs")) {
    contextStore.createIndex("byChannelTs", ["channelKey", "timestampValue"], { unique: false })
  }
  if (!contextStore.indexNames.contains("byConversationMessage")) {
    contextStore.createIndex("byConversationMessage", ["conversationId", "messageId"], {
      unique: false,
    })
  }
  if (!contextStore.indexNames.contains("byObservedAt")) {
    contextStore.createIndex("byObservedAt", "observedAt", { unique: false })
  }

  let threadStore: IDBObjectStore
  if (!db.objectStoreNames.contains(THREAD_STORE_NAME)) {
    threadStore = db.createObjectStore(THREAD_STORE_NAME, { keyPath: "threadKey" })
  } else {
    threadStore = tx!.objectStore(THREAD_STORE_NAME)
  }
  if (!threadStore.indexNames.contains("byLastActivityAt")) {
    threadStore.createIndex("byLastActivityAt", "lastActivityAt", { unique: false })
  }

  if (!db.objectStoreNames.contains(SUMMARY_STORE_NAME)) {
    db.createObjectStore(SUMMARY_STORE_NAME, { keyPath: "threadKey" })
  }
}

export async function clearContextStore(): Promise<void> {
  const database = await openDatabase()
  await Promise.all([
    transactionForStore(database, STORE_NAME, "readwrite", (store) => store.clear()),
    transactionForStore(database, THREAD_STORE_NAME, "readwrite", (store) => store.clear()),
  ])
}

export async function clearThreadSummaries(): Promise<void> {
  const database = await openDatabase()
  await transactionForStore(database, SUMMARY_STORE_NAME, "readwrite", (store) => store.clear())
}

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, SLACKTOR_DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => upgradeSlacktorDatabase(request)
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

function getEntryFromStore<T>(
  database: IDBDatabase,
  storeName: string,
  key: IDBValidKey,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).get(key)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result as T | undefined)
  })
}

function getByIndex<T>(database: IDBDatabase, indexName: string, key: IDBValidKey): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .index(indexName)
      .getAll(key)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result as T[])
  })
}

function getByIndexRange<T>(
  database: IDBDatabase,
  indexName: string,
  range: IDBKeyRange,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .index(indexName)
      .getAll(range)
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

async function cleanupInactiveContext(
  database: IDBDatabase,
  activeChannelKey?: string,
): Promise<void> {
  try {
    const cutoff = Date.now() - CONTEXT_RETENTION_MS
    const expiredScopeKeys = new Set<string>()

    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(THREAD_STORE_NAME, "readwrite")
      const store = tx.objectStore(THREAD_STORE_NAME)
      const hasIndex = store.indexNames.contains("byLastActivityAt")
      const request = hasIndex
        ? store.index("byLastActivityAt").openCursor(IDBKeyRange.upperBound(cutoff))
        : store.openCursor()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          const thread = cursor.value as StoredContextThread
          if (thread.lastActivityAt < cutoff) {
            expiredScopeKeys.add(thread.threadKey)
            cursor.delete()
          }
          cursor.continue()
        } else {
          resolve()
        }
      }
    })

    if (expiredScopeKeys.size > 0) {
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(SUMMARY_STORE_NAME, "readwrite")
        const store = tx.objectStore(SUMMARY_STORE_NAME)
        for (const scopeKey of expiredScopeKeys) {
          store.delete(scopeKey)
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    }

    // Delete messages older than retention cutoff using byObservedAt index
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)
      const hasIndex = store.indexNames.contains("byObservedAt")
      const request = hasIndex
        ? store.index("byObservedAt").openCursor(IDBKeyRange.upperBound(cutoff))
        : store.openCursor()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          const message = cursor.value as StoredContextMessage
          if (
            message.observedAt < cutoff ||
            (message.threadKey && expiredScopeKeys.has(message.threadKey))
          ) {
            cursor.delete()
          }
          cursor.continue()
        } else {
          resolve()
        }
      }
    })

    // Enforce per-channel ring-buffer cap on activeChannelKey
    if (activeChannelKey) {
      const channelMessages = await getByIndexRange<StoredContextMessage>(
        database,
        "byChannelTs",
        IDBKeyRange.bound([activeChannelKey, 0], [activeChannelKey, Number.MAX_SAFE_INTEGER]),
      ).catch(() => [] as StoredContextMessage[])
      const standaloneChannelMessages = channelMessages.filter((item) => !item.threadKey)
      if (standaloneChannelMessages.length > MAX_CHANNEL_STORED_MESSAGES) {
        const excess = standaloneChannelMessages.slice(
          0,
          standaloneChannelMessages.length - MAX_CHANNEL_STORED_MESSAGES,
        )
        await new Promise<void>((resolve, reject) => {
          const tx = database.transaction(STORE_NAME, "readwrite")
          const store = tx.objectStore(STORE_NAME)
          for (const item of excess) {
            store.delete(item.id)
          }
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
      }
    }
  } catch {
    // Periodic background cleanup failure should not affect active context operations
  }
}

function getAll<T>(database: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result as T[])
  })
}
