import { normalizeQuickHistoryEntry, QUICK_UI_KEY } from "../shared/quick-history"
import { getProviderSettings } from "../shared/settings"
import {
  normalizeSlackMessageId,
  type RawSlackMessage,
  type ThreadContextPlan,
} from "../shared/types"
import { buildThreadContextPlan } from "./context-store"
import { safeEndpoint, writeLog } from "./log-store"
import { providerRequest } from "./provider-request"
import { summarizeThread } from "./summary-service"
import { cacheTranslation, getCachedTranslation } from "./translation-cache"
import { countTranslatedMessages } from "./usage-stats"

type InFlightTranslationEntry = {
  promise: Promise<string>
  apiStarted: boolean
  onApiStartListeners: Set<() => void>
}

const inFlightTranslations = new Map<string, InFlightTranslationEntry>()
const recentTranslations = new Map<
  string,
  { translation: string; completedAt: number; timestamp: number }
>()
const RECENT_TRANSLATION_DEDUPE_MS = 8_000
const BATCH_WINDOW_MS = 2_000
const MAX_BATCH_INPUT_TOKENS = 25_000
const APPROXIMATE_BYTES_PER_TOKEN = 4
const MAX_CONCURRENT_NORMAL_REQUESTS = 9
const MAX_SHARED_THREAD_CONTEXT_MESSAGES = 20
const MAX_SHARED_THREAD_CONTEXT_CHARACTERS = 12_000
const MAX_STANDALONE_CONTEXT_MESSAGES = 5
const textEncoder = new TextEncoder()
type TranslationBatchItem = {
  id: string
  message: RawSlackMessage
  context?: ThreadContextPlan
  settings: Awaited<ReturnType<typeof getProviderSettings>>
  signal?: AbortSignal
  onRetryStateChange?: (retrying: boolean) => void
  onApiStart?: () => void
  cleanupAbort?: () => void
  priority: boolean
  resolve: (translation: string) => void
  reject: (error: unknown) => void
}
type ResolvedTranslationBatchItem = TranslationBatchItem & {
  context: ThreadContextPlan
}
type TranslationRequestItem = Pick<
  ResolvedTranslationBatchItem,
  "id" | "message" | "context" | "settings"
>
let pendingBatch: TranslationBatchItem[] = []
let batchTimer: ReturnType<typeof setTimeout> | undefined
let batchSequence = 0
let activeBatchRequests = 0
const batchRequestQueue: TranslationBatchItem[][] = []
let activePriorityRequest = false
const priorityRequestQueue: TranslationBatchItem[][] = []

export async function translateMessage(
  message: RawSlackMessage,
  context?: ThreadContextPlan,
  forceRefresh = false,
  signal?: AbortSignal,
  onRetryStateChange?: (retrying: boolean) => void,
  urgent = false,
  priority = false,
  onApiStart?: () => void,
): Promise<string> {
  const settings = await getProviderSettings()

  if (!forceRefresh) {
    const quickHistoryTranslation = await getQuickHistoryCounterpart(message.sourceText)
    if (quickHistoryTranslation !== undefined) {
      await cacheTranslation(message, settings, quickHistoryTranslation, context)
      return quickHistoryTranslation
    }
    const cached = await getCachedTranslation(message, settings, context)
    if (cached !== undefined) return cached
  }

  if (!settings.baseUrl || !settings.apiKey || !settings.model) {
    throw new Error("Configure the AI provider in Slacktor options first.")
  }

  const inFlightId = getRequestDedupeId(message, settings)
  if (!forceRefresh) {
    const recent = recentTranslations.get(inFlightId)
    const timestamp = Number.parseFloat(message.timestamp ?? "")
    if (
      recent &&
      Date.now() - recent.completedAt <= RECENT_TRANSLATION_DEDUPE_MS &&
      (!Number.isFinite(timestamp) ||
        !Number.isFinite(recent.timestamp) ||
        Math.abs(timestamp - recent.timestamp) <= 1)
    ) {
      return recent.translation
    }
    if (recent) recentTranslations.delete(inFlightId)
    if (!urgent) {
      const pending = inFlightTranslations.get(inFlightId)
      if (pending) {
        if (onApiStart) {
          if (pending.apiStarted) onApiStart()
          else pending.onApiStartListeners.add(onApiStart)
        }
        return pending.promise
      }
    }
  }

  const onApiStartListeners = new Set<() => void>()
  if (onApiStart) onApiStartListeners.add(onApiStart)
  let inFlightEntry: InFlightTranslationEntry | undefined
  const notifyApiStart = () => {
    if (inFlightEntry) inFlightEntry.apiStarted = true
    for (const listener of onApiStartListeners) {
      listener()
    }
    onApiStartListeners.clear()
  }

  const request = urgent
    ? requestUrgentTranslation(
        message,
        context,
        settings,
        signal,
        onRetryStateChange,
        notifyApiStart,
      )
    : enqueueTranslationRequest(
        message,
        context,
        settings,
        signal,
        onRetryStateChange,
        priority,
        notifyApiStart,
      )
  if (!forceRefresh && !urgent) {
    inFlightEntry = {
      promise: request,
      apiStarted: false,
      onApiStartListeners,
    }
    inFlightTranslations.set(inFlightId, inFlightEntry)
  }
  try {
    const translation = await request
    if (!forceRefresh) {
      recentTranslations.set(inFlightId, {
        translation,
        completedAt: Date.now(),
        timestamp: Number.parseFloat(message.timestamp ?? ""),
      })
      pruneRecentTranslations()
    }
    return translation
  } finally {
    if (inFlightEntry && inFlightTranslations.get(inFlightId) === inFlightEntry) {
      inFlightTranslations.delete(inFlightId)
    }
  }
}

async function getQuickHistoryCounterpart(sourceText: string): Promise<string | undefined> {
  const stored = await chrome.storage.local.get(QUICK_UI_KEY)
  const history = stored[QUICK_UI_KEY]?.history
  if (!Array.isArray(history)) return undefined
  const normalizedSource = normalizeQuickHistoryText(sourceText)
  for (const raw of history) {
    const entry = normalizeQuickHistoryEntry(raw)
    if (!entry) continue
    if (normalizeQuickHistoryText(entry.translation) === normalizedSource) {
      return entry.backTranslation
    }
    if (normalizeQuickHistoryText(entry.backTranslation) === normalizedSource) {
      return entry.translation
    }
  }
  return undefined
}

function normalizeQuickHistoryText(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

async function requestUrgentTranslation(
  message: RawSlackMessage,
  context: ThreadContextPlan | undefined,
  settings: Awaited<ReturnType<typeof getProviderSettings>>,
  signal?: AbortSignal,
  onRetryStateChange?: (retrying: boolean) => void,
  onApiStart?: () => void,
): Promise<string> {
  onApiStart?.()
  const resolvedContext =
    context ??
    (await buildThreadContextPlan(message, summarizeThread, settings.targetLanguage).catch(() => ({
      recentMessages: [],
    })))
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Translation terminated.", "AbortError")
  }
  const item: TranslationRequestItem = {
    id: `urgent-${batchSequence++}`,
    message,
    context: resolvedContext,
    settings,
  }
  if (getEstimatedBatchInputTokens([item]) > MAX_BATCH_INPUT_TOKENS) {
    throw new Error("Message and thread context exceed the 25k input-token safety limit.")
  }
  const translations = await performTranslationRequest([item], signal, onRetryStateChange, true)
  const translation = translations.get(item.id)
  if (translation === undefined) throw new Error("AI provider omitted the urgent translation.")
  await cacheTranslation(message, settings, translation, resolvedContext)
  if (translation) await countTranslatedMessages(1)
  return translation
}

export const SAME_LANGUAGE_SENTINEL = "__SLKT_SAME_LANG__"

const CORE_TRANSLATION_RULES = [
  "Preserve the original vibe, intent, emotional tone, urgency, directness, and intensity exactly.",
  "For content inside ```code blocks``` and `inline code`: if it represents natural human language, plain conversational text, notes, questions, headings, or status tags formatted with backticks (such as message quotes or topic badges), translate the text into the requested target language while strictly preserving the enclosing ```code block``` or `inline code` markdown syntax. Only keep actual programming source code, shell/terminal commands, SQL queries, syntax tokens, technical identifiers (e.g. camelCase, snake_case, PascalCase variable/function names), file paths, and config/data structures untranslated.",
  "Strictly do not translate URLs, email addresses, @mentions (e.g. @username, @here, @channel, including parenthetical or bilingual display names like @Name (note)), #channels, or emoji codes (:emoji_name:).",
  "Follow the target language's natural spacing conventions around emoji codes (:emoji_name:): when translating into languages that use spaces between words (such as English, Vietnamese, etc.), ensure words are separated from emoji codes with a space (e.g. 'text :emoji:' rather than 'text:emoji:'); when translating into scripts without inter-word spaces (such as Japanese or Chinese), preserve natural tight placement without inserting unnatural spaces.",
  "Strictly preserve all placeholder tokens such as __SLKT_0__, __SLKT_1__, etc. exactly as written. Do not translate, change, reorder, or remove any placeholder token.",
  "Strictly preserve forwarded headers starting with ↳ (such as ↳ Name:) exactly as written. Do not translate the name or alter the ↳ symbol.",
  "Strictly preserve quote and blockquote markdown prefixes (> and >>) at the start of lines. Do not remove, add, or alter > or >> quote markers.",
  "Strictly do not include '(edited)' or edited timestamp labels in the translation.",
  "Never soften, sanitize, de-escalate, add politeness, or make an angry, tense, blunt, critical, or confrontational message sound friendlier than the source.",
  "Preserve the exact line breaks, list indentation, and nested list hierarchy (e.g. '  - subitem' with leading spaces) faithfully. For multi-level or nested lists, you MUST preserve the exact leading space indentation and hierarchical nesting. Never flatten nested sub-items into top-level items, and do not insert empty lines between list items.",
  "When prior context messages include a reference translation, maintain consistent domain terminology, project names, and interpersonal pronouns/register with those established translations.",
]

function removeQueuedBatchItem(target: TranslationBatchItem): void {
  const pendingIdx = pendingBatch.indexOf(target)
  if (pendingIdx >= 0) {
    pendingBatch.splice(pendingIdx, 1)
    if (pendingBatch.length === 0 && batchTimer !== undefined) {
      clearTimeout(batchTimer)
      batchTimer = undefined
    }
  }
  for (const queue of [priorityRequestQueue, batchRequestQueue]) {
    for (let i = queue.length - 1; i >= 0; i -= 1) {
      const group = queue[i]
      const idx = group.indexOf(target)
      if (idx >= 0) {
        group.splice(idx, 1)
        if (group.length === 0) queue.splice(i, 1)
      }
    }
  }
}

function enqueueTranslationRequest(
  message: RawSlackMessage,
  context: ThreadContextPlan | undefined,
  settings: Awaited<ReturnType<typeof getProviderSettings>>,
  signal?: AbortSignal,
  onRetryStateChange?: (retrying: boolean) => void,
  priority = false,
  onApiStart?: () => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Translation terminated.", "AbortError"))
      return
    }
    const item: TranslationBatchItem = {
      id: `translation-${batchSequence++}`,
      message,
      context,
      settings,
      signal,
      onRetryStateChange,
      onApiStart,
      priority,
      resolve,
      reject,
    }
    if (signal) {
      const onAbort = () => {
        removeQueuedBatchItem(item)
        reject(signal.reason ?? new DOMException("Translation terminated.", "AbortError"))
      }
      signal.addEventListener("abort", onAbort, { once: true })
      item.cleanupAbort = () => signal.removeEventListener("abort", onAbort)
    }
    pendingBatch.push(item)
    if (batchTimer === undefined) {
      batchTimer = setTimeout(flushPendingBatch, BATCH_WINDOW_MS)
    }
  })
}

function flushPendingBatch(): void {
  batchTimer = undefined
  const items = pendingBatch
  pendingBatch = []

  const priorityItems = items.filter((item) => item.priority)
  const normalItems = items.filter((item) => !item.priority)
  priorityRequestQueue.push(...partitionQueuedItems(priorityItems))
  batchRequestQueue.push(...partitionQueuedItems(normalItems))
  runBatchRequestQueue()
}

function runBatchRequestQueue(): void {
  if (!activePriorityRequest && priorityRequestQueue.length > 0) {
    const items = priorityRequestQueue.shift()
    if (items) {
      activePriorityRequest = true
      void requestTranslationBatch(items).finally(() => {
        activePriorityRequest = false
        runBatchRequestQueue()
      })
    }
  }
  while (activeBatchRequests < MAX_CONCURRENT_NORMAL_REQUESTS && batchRequestQueue.length > 0) {
    const items = batchRequestQueue.shift()
    if (!items) return
    activeBatchRequests += 1
    void requestTranslationBatch(items).finally(() => {
      activeBatchRequests -= 1
      runBatchRequestQueue()
    })
  }
}

function toPreliminaryRequestItem(item: TranslationBatchItem): TranslationRequestItem {
  return {
    id: item.id,
    message: item.message,
    context: item.context ?? { recentMessages: [] },
    settings: item.settings,
  }
}

function partitionQueuedItems(items: TranslationBatchItem[]): TranslationBatchItem[][] {
  const groups: TranslationBatchItem[][] = []
  let current: TranslationBatchItem[] = []
  for (const item of items) {
    if (item.signal?.aborted) {
      item.cleanupAbort?.()
      item.reject(item.signal.reason ?? new DOMException("Translation terminated.", "AbortError"))
      continue
    }
    if (getEstimatedBatchInputTokens([toPreliminaryRequestItem(item)]) > MAX_BATCH_INPUT_TOKENS) {
      item.cleanupAbort?.()
      item.reject(new Error("Message and thread context exceed the 25k input-token safety limit."))
      continue
    }
    if (current.length > 0 && !hasCompatibleProvider(current[0], item)) {
      groups.push(current)
      current = []
    }
    const candidate = [...current, item]
    if (
      current.length > 0 &&
      getEstimatedBatchInputTokens(candidate.map(toPreliminaryRequestItem)) > MAX_BATCH_INPUT_TOKENS
    ) {
      groups.push(current)
      current = [item]
    } else {
      current = candidate
    }
  }
  if (current.length > 0) groups.push(current)
  return groups
}

function partitionResolvedBatch(
  items: ResolvedTranslationBatchItem[],
): ResolvedTranslationBatchItem[][] {
  const groups: ResolvedTranslationBatchItem[][] = []
  let current: ResolvedTranslationBatchItem[] = []
  for (const item of items) {
    if (item.signal?.aborted) {
      item.reject(item.signal.reason ?? new DOMException("Translation terminated.", "AbortError"))
      continue
    }
    if (getEstimatedBatchInputTokens([item]) > MAX_BATCH_INPUT_TOKENS) {
      item.reject(new Error("Message and thread context exceed the 25k input-token safety limit."))
      continue
    }
    if (current.length > 0 && !hasCompatibleProvider(current[0], item)) {
      groups.push(current)
      current = []
    }
    const candidate = [...current, item]
    if (current.length > 0 && getEstimatedBatchInputTokens(candidate) > MAX_BATCH_INPUT_TOKENS) {
      groups.push(current)
      current = [item]
    } else {
      current = candidate
    }
  }
  if (current.length > 0) groups.push(current)
  return groups
}

function hasCompatibleProvider(left: TranslationBatchItem, right: TranslationBatchItem): boolean {
  return (
    left.settings.baseUrl === right.settings.baseUrl &&
    left.settings.apiKey === right.settings.apiKey &&
    left.settings.model === right.settings.model &&
    left.settings.customPrompt === right.settings.customPrompt
  )
}

function getEstimatedBatchInputTokens(items: TranslationRequestItem[]): number {
  const inputBytes =
    textEncoder.encode(buildBatchSystemPrompt(items[0]?.settings.customPrompt ?? "")).byteLength +
    textEncoder.encode(buildBatchPrompt(items)).byteLength
  return Math.ceil(inputBytes / APPROXIMATE_BYTES_PER_TOKEN)
}

function getRequestDedupeId(
  message: RawSlackMessage,
  settings: Awaited<ReturnType<typeof getProviderSettings>>,
): string {
  return [
    message.workspaceId ?? "",
    message.conversationId ?? "",
    message.author.status === "resolved" ? message.author.memberId : "unknown",
    message.sourceText,
    settings.baseUrl,
    settings.model,
    settings.targetLanguage,
    settings.customPrompt,
  ].join("\u0000")
}

function pruneRecentTranslations(): void {
  if (recentTranslations.size <= 500) return
  const cutoff = Date.now() - RECENT_TRANSLATION_DEDUPE_MS
  for (const [key, value] of recentTranslations) {
    if (value.completedAt < cutoff) recentTranslations.delete(key)
  }
}

/**
 * Clickable element masking pattern:
 * 1. Markdown links: [label](protocol://url)
 *    Matches [label](slack://mention), [label](slack://channel), [label](slack://link), [label](slack://email), [label](https://...)
 * 2. Raw URLs: https?://...
 * 3. Raw emails: user@domain.com
 * 4. Broadcast mentions: @channel, @here, @everyone
 * 5. Escaped quote prefixes at line start: \> or \>>
 */
const CLICKABLE_MASK_REGEX =
  /(?<=^|\n)[ \t\u00A0]*\\>+[ \t\u00A0]?|\[((?:\[[^\]\n]*\]|[^\]\n])+)\]\(((?:https?:\/\/|mailto:|slack:\/\/)[^\s)<>"]+)\)|https?:\/\/[^\s)<>"'`]+|(?:mailto:)?[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|@(?:channel|here|everyone)\b/g

export function maskClickableElements(text: string, maskMap: Map<string, string>): string {
  if (!text) return text
  return text.replace(CLICKABLE_MASK_REGEX, (match) => {
    const placeholder = `__SLKT_${maskMap.size}__`
    maskMap.set(placeholder, match)
    return placeholder
  })
}

export function unmaskClickableElements(text: string, maskMap: Map<string, string>): string {
  if (!text || maskMap.size === 0) return text
  return text.replace(/__\s*SLKT_(\d+)\s*__/gi, (_match, id: string) => {
    const key = `__SLKT_${id}__`
    return maskMap.get(key) ?? _match
  })
}

export function sanitizeContextText(text: string): string {
  return text.replace(/\[((?:\[[^\]\n]*\]|[^\]\n])+)\]\(slack:\/\/[^)]+\)/g, "$1")
}

const BATCH_SYSTEM_PROMPT = [
  "Translate each Slack message accurately into its requested target language.",
  ...CORE_TRANSLATION_RULES,
  `If currentMessage is already written in the requested target language, immediately return the exact string "${SAME_LANGUAGE_SENTINEL}" as the translation for that item — do not translate, paraphrase, or repeat the message. Perform this check first, before any translation work.`,
  "For threadGroups, use sharedContext only to resolve meaning for every item in that group. Translate only each item's currentMessage.",
  "For standaloneItems, use previousMessages only to resolve meaning. Translate only currentMessage.",
  "Return only valid JSON with a translations array. Each entry must contain the unchanged id and its translation. Escape quotation marks and control characters inside every JSON string. Do not add markdown or commentary.",
].join(" ")

function buildBatchSystemPrompt(customPrompt: string): string {
  return customPrompt
    ? `${BATCH_SYSTEM_PROMPT}\n\nAdditional user instructions:\n${customPrompt}`
    : BATCH_SYSTEM_PROMPT
}

function decodeLineBreaks(text: string): string {
  let normalized = text
    .replace(/\\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/(?:^|\s*)\((?:edited|đã chỉnh sửa|編集済み)\)\s*$/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  let prev = ""
  while (prev !== normalized) {
    prev = normalized
    normalized = normalized.replace(
      /((?:^|\r?\n)[ \t]*(?:[-*+•]|\d+[.)])[^\r\n]*)\r?\n\r?\n+(?=[ \t]*(?:[-*+•]|\d+[.)])[ \t]+)/g,
      "$1\n",
    )
  }
  return normalized
}

async function requestTranslationBatch(items: TranslationBatchItem[]): Promise<void> {
  for (const item of items) item.cleanupAbort?.()
  const initialLiveItems = items.filter((item) => !item.signal?.aborted)
  for (const item of items) {
    if (!initialLiveItems.includes(item))
      item.reject(item.signal?.reason ?? new DOMException("Translation terminated.", "AbortError"))
  }
  if (initialLiveItems.length === 0) return

  for (const item of initialLiveItems) {
    item.onApiStart?.()
  }

  const resolvedItems: ResolvedTranslationBatchItem[] = await Promise.all(
    initialLiveItems.map(async (item) => ({
      ...item,
      context:
        item.context ??
        (await buildThreadContextPlan(
          item.message,
          summarizeThread,
          item.settings.targetLanguage,
        ).catch(() => ({ recentMessages: [] }))),
    })),
  )

  const subBatches = partitionResolvedBatch(resolvedItems)
  await Promise.all(subBatches.map((subBatch) => executeResolvedBatch(subBatch)))
}

async function executeResolvedBatch(liveItems: ResolvedTranslationBatchItem[]): Promise<void> {
  const [first] = liveItems
  if (!first) return
  const controller = new AbortController()
  const abortIfEmpty = () => {
    if (liveItems.every((item) => item.signal?.aborted))
      controller.abort(new DOMException("Translation terminated.", "AbortError"))
  }
  for (const item of liveItems) item.signal?.addEventListener("abort", abortIfEmpty, { once: true })
  const notifyRetryState = (retrying: boolean) => {
    for (const item of liveItems) {
      if (!item.signal?.aborted) item.onRetryStateChange?.(retrying)
    }
  }
  try {
    const translations = await performTranslationRequest(
      liveItems,
      controller.signal,
      notifyRetryState,
    )
    const completed = await Promise.all(
      liveItems
        .filter((item) => !item.signal?.aborted)
        .map(async (item) => {
          const translation = translations.get(item.id)
          if (translation === undefined)
            throw new Error("AI provider omitted a translation from the batch response.")
          await cacheTranslation(item.message, item.settings, translation, item.context)
          return { item, translation }
        }),
    )
    await countTranslatedMessages(completed.filter((result) => result.translation).length)
    for (const result of completed) result.item.resolve(result.translation)
  } catch (error) {
    for (const item of liveItems) item.reject(error)
  }
}

async function performTranslationRequest(
  items: TranslationRequestItem[],
  signal?: AbortSignal,
  onRetryStateChange?: (retrying: boolean) => void,
  bypassRateLimit = false,
): Promise<Map<string, string>> {
  const first = items[0]
  if (!first) return new Map()
  const settings = first.settings
  const baseUrl = settings.baseUrl.replace(/\/+$/, "")
  const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`
  const itemMasks = new Map<string, Map<string, string>>()
  for (const item of items) {
    itemMasks.set(item.id, new Map<string, string>())
  }
  const payload = {
    model: settings.model,
    messages: [
      {
        role: "system",
        content: buildBatchSystemPrompt(settings.customPrompt),
      },
      {
        role: "user",
        content: buildBatchPrompt(items, itemMasks),
      },
    ],
    temperature: 0.2,
  }
  await writeLog({
    level: "info",
    scope: "translation",
    message: "Translation request started",
    details: {
      endpoint: safeEndpoint(endpoint),
      model: settings.model,
      batchSize: items.length,
      urgent: bypassRateLimit,
    },
  })
  let response: Response
  try {
    response = await providerRequest(endpoint, settings.apiKey, payload, {
      signal,
      onRetryStateChange,
      bypassRateLimit,
    })
  } catch (error) {
    await writeLog({
      level: "error",
      scope: "translation",
      message: error instanceof Error ? error.message : "Translation network request failed",
      details: { endpoint: safeEndpoint(endpoint), model: settings.model },
    })
    throw error
  }

  if (!response.ok) {
    const body = (await response.text()).replace(/\s+/g, " ").trim()
    const detail = body ? `: ${body.slice(0, 240)}` : ""
    const error = `AI request failed (${response.status})${detail}`
    await writeLog({
      level: "error",
      scope: "translation",
      message: error,
      details: { endpoint: safeEndpoint(endpoint), model: settings.model, status: response.status },
    })
    throw new Error(error)
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content?.trim()
  const rawTranslations = parseBatchTranslations(content)
  const translations = new Map<string, string>()
  for (const [id, translation] of rawTranslations) {
    const maskMap = itemMasks.get(id)
    const unmasked = maskMap ? unmaskClickableElements(translation, maskMap) : translation
    translations.set(id, unmasked)
  }
  await writeLog({
    level: "info",
    scope: "translation",
    message: "Translation request completed",
    details: {
      endpoint: safeEndpoint(endpoint),
      model: settings.model,
      status: response.status,
      batchSize: items.length,
      urgent: bypassRateLimit,
    },
  })
  return translations
}

function buildBatchPrompt(
  items: TranslationRequestItem[],
  itemMasks?: Map<string, Map<string, string>>,
): string {
  const threadGroups = new Map<string, TranslationRequestItem[]>()
  const standaloneItems: TranslationRequestItem[] = []
  for (const item of items) {
    const threadKey = getBatchThreadKey(item.message)
    if (!threadKey) {
      standaloneItems.push(item)
      continue
    }
    const group = threadGroups.get(threadKey) ?? []
    group.push(item)
    threadGroups.set(threadKey, group)
  }

  const getMaskedMessage = (item: TranslationRequestItem): string => {
    let maskMap = itemMasks?.get(item.id)
    if (!maskMap) {
      maskMap = new Map<string, string>()
      itemMasks?.set(item.id, maskMap)
    }
    return maskClickableElements(item.message.sourceText, maskMap)
  }

  return JSON.stringify({
    threadGroups: [...threadGroups.entries()].map(([threadKey, group]) => ({
      threadKey,
      olderThreadSummary: group.find((item) => item.context.summary)?.context.summary ?? "",
      sharedContext: buildSharedThreadContext(group),
      items: group.map((item) => ({
        id: item.id,
        targetLanguage: item.settings.targetLanguage,
        currentMessage: getMaskedMessage(item),
      })),
    })),
    standaloneItems: standaloneItems.map((item) => ({
      id: item.id,
      targetLanguage: item.settings.targetLanguage,
      ...(item.context.summary ? { olderChannelSummary: item.context.summary } : {}),
      previousMessages: getPreviousStandaloneMessages(item, standaloneItems),
      currentMessage: getMaskedMessage(item),
    })),
  })
}

function getBatchThreadKey(message: RawSlackMessage): string | undefined {
  if (!message.threadRootTs || !message.conversationId) return undefined
  return [message.workspaceId ?? "", message.conversationId, message.threadRootTs].join(":")
}

type PromptContextEntry = {
  author: string
  text: string
  translation?: string
  isThreadRoot?: boolean
}

function buildSharedThreadContext(group: TranslationRequestItem[]): PromptContextEntry[] {
  const translatedMessageIds = new Set(group.map((item) => item.message.messageId))
  const contextById = new Map<
    string,
    {
      timestamp: string
      author: string
      text: string
      translation?: string
      isThreadRoot?: boolean
    }
  >()

  for (const item of group) {
    for (const bridgeMsg of item.context.channelBridgeMessages ?? []) {
      if (translatedMessageIds.has(bridgeMsg.messageId)) continue
      contextById.set(bridgeMsg.messageId, {
        timestamp: bridgeMsg.timestamp,
        author: bridgeMsg.authorName ?? "Slack member",
        text: sanitizeContextText(bridgeMsg.sourceText),
        ...(bridgeMsg.translatedText
          ? { translation: sanitizeContextText(bridgeMsg.translatedText) }
          : {}),
      })
    }
    if (item.context.rootMessage && !translatedMessageIds.has(item.context.rootMessage.messageId)) {
      const rootMsg = item.context.rootMessage
      contextById.set(rootMsg.messageId, {
        timestamp: rootMsg.timestamp,
        author: rootMsg.authorName ?? "Slack member",
        text: sanitizeContextText(rootMsg.sourceText),
        ...(rootMsg.translatedText
          ? { translation: sanitizeContextText(rootMsg.translatedText) }
          : {}),
        isThreadRoot: true,
      })
    }
    for (const message of item.context.recentMessages) {
      if (translatedMessageIds.has(message.messageId)) continue
      contextById.set(message.messageId, {
        timestamp: message.timestamp,
        author: message.authorName ?? "Slack member",
        text: sanitizeContextText(message.sourceText),
        ...(message.translatedText
          ? { translation: sanitizeContextText(message.translatedText) }
          : {}),
        ...(message.isThreadRoot ? { isThreadRoot: true } : {}),
      })
    }
  }

  const sorted = [...contextById.values()].sort(
    (left, right) => Number.parseFloat(left.timestamp) - Number.parseFloat(right.timestamp),
  )
  const rootEntry = sorted.find((entry) => entry.isThreadRoot)
  const nonRootEntries = sorted.filter((entry) => entry !== rootEntry)
  const candidates = rootEntry
    ? [rootEntry, ...nonRootEntries.slice(-(MAX_SHARED_THREAD_CONTEXT_MESSAGES - 1))]
    : nonRootEntries.slice(-MAX_SHARED_THREAD_CONTEXT_MESSAGES)

  const selected: PromptContextEntry[] = []
  let characters = 0
  for (const message of candidates) {
    if (characters + message.text.length > MAX_SHARED_THREAD_CONTEXT_CHARACTERS) continue
    selected.push({
      author: message.author,
      text: message.text,
      ...(message.translation ? { translation: message.translation } : {}),
      ...(message.isThreadRoot ? { isThreadRoot: true } : {}),
    })
    characters += message.text.length
  }
  return selected
}

function getPreviousStandaloneMessages(
  target: TranslationRequestItem,
  standaloneItems: TranslationRequestItem[],
): PromptContextEntry[] {
  const targetTimestamp = Number.parseFloat(
    normalizeSlackMessageId(target.message.timestamp ?? target.message.messageId),
  )
  const mergedById = new Map<
    string,
    { timestamp: number; author: string; text: string; translation?: string }
  >()

  // 1. Persisted channel messages from IndexedDB (via target.context.recentMessages)
  for (const stored of target.context.recentMessages) {
    if (stored.messageId === target.message.messageId) continue
    const ts = Number.parseFloat(normalizeSlackMessageId(stored.timestamp || stored.messageId))
    if (Number.isFinite(targetTimestamp) && Number.isFinite(ts) && ts > targetTimestamp) continue
    mergedById.set(normalizeSlackMessageId(stored.messageId), {
      timestamp: Number.isFinite(ts) ? ts : 0,
      author: stored.authorName ?? "Slack member",
      text: sanitizeContextText(stored.sourceText),
      ...(stored.translatedText ? { translation: sanitizeContextText(stored.translatedText) } : {}),
    })
  }

  // 2. In-flight channel messages from the current batch
  if (Number.isFinite(targetTimestamp)) {
    for (const item of standaloneItems) {
      if (item === target) continue
      if (item.message.workspaceId !== target.message.workspaceId) continue
      if (item.message.conversationId !== target.message.conversationId) continue
      const itemTs = Number.parseFloat(
        normalizeSlackMessageId(item.message.timestamp ?? item.message.messageId),
      )
      if (!Number.isFinite(itemTs) || itemTs >= targetTimestamp) continue
      const key = normalizeSlackMessageId(item.message.messageId)
      if (!mergedById.has(key)) {
        mergedById.set(key, {
          timestamp: itemTs,
          author:
            item.message.author.status === "resolved"
              ? (item.message.author.displayName ?? "Slack member")
              : "Slack member",
          text: sanitizeContextText(item.message.sourceText),
        })
      }
    }
  }

  return [...mergedById.values()]
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-MAX_STANDALONE_CONTEXT_MESSAGES)
    .map((entry) => ({
      author: entry.author,
      text: entry.text,
      ...(entry.translation ? { translation: entry.translation } : {}),
    }))
}

function parseBatchTranslations(content: string | undefined): Map<string, string> {
  if (!content) throw new Error("AI provider returned no translation.")
  const normalized = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  let data: { translations?: Array<{ id?: unknown; translation?: unknown }> }
  try {
    data = JSON.parse(normalized) as typeof data
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    data = JSON.parse(sanitizeJsonStrings(normalized)) as typeof data
  }
  if (!Array.isArray(data.translations))
    throw new Error("AI provider returned an invalid batch response.")
  return new Map(
    data.translations.flatMap((item) =>
      typeof item.id === "string" && typeof item.translation === "string"
        ? [[item.id, decodeLineBreaks(item.translation)] as const]
        : [],
    ),
  )
}

function sanitizeJsonStrings(json: string): string {
  let result = ""
  let inString = false
  let escaped = false

  for (let index = 0; index < json.length; index += 1) {
    const character = json[index]
    if (!inString) {
      result += character
      if (character === '"') inString = true
      continue
    }

    if (escaped) {
      result += character
      escaped = false
      continue
    }
    if (character === "\\") {
      result += character
      escaped = true
      continue
    }
    if (character === '"') {
      const remainder = json.slice(index + 1)
      const nextToken = remainder.match(/\S/)?.[0]
      const commaEndsString = nextToken === "," && /^\s*,\s*(?:["{]|$)/.test(remainder)
      if (nextToken === undefined || commaEndsString || ["}", "]", ":"].includes(nextToken)) {
        result += character
        inString = false
      } else {
        result += '\\"'
      }
      continue
    }

    const codePoint = character.charCodeAt(0)
    result += codePoint <= 0x1f ? `\\u${codePoint.toString(16).padStart(4, "0")}` : character
  }
  return result
}
