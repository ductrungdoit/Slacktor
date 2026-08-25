import {
  extractMessage,
  findMessageNodes,
  getTranslationAnchor,
  isMessageCandidate,
} from "./slack-adapter"
import { renderPlaceholder } from "./translation-renderer"
import type { TranslationController } from "./translation-renderer"
import type { PublicSettings } from "../shared/messages"
import type { ContentRequest } from "../shared/messages"
import type { RawSlackMessage, ThreadContextPlan } from "../shared/types"

let settings: PublicSettings = {
  targetLanguage: "Vietnamese",
  configured: false,
  autoTranslate: false,
  privacyConsent: false,
}
let activeTranslations = 0
const MAX_CONCURRENT_TRANSLATIONS = 10
const MAX_BACKGROUND_TRANSLATIONS = 6
let activeBackgroundTranslations = 0
let completedTranslations = 0
let totalTranslations = 0
type QueuedTranslation = {
  messageId: string
  targets: Map<TranslationController, () => Promise<string | undefined>>
  started: boolean
  result?: Promise<string | undefined>
  usesBackgroundSlot: boolean
  manualPriority: boolean
  threadPanelPriority: boolean
  recentPriority: boolean
  timestamp: number
  sequence: number
}

const autoTranslationQueue: QueuedTranslation[] = []
const queuedTranslations = new Map<string, QueuedTranslation>()
const controllers = new Map<string, Set<TranslationController>>()
const completedTranslationsByMessage = new Map<string, string>()
const stoppedMessageKeys = new Set<string>()
const recentMessageAliases = new Map<string, {
  messageKey: string
  timestamp: number
  lastSeenAt: number
}>()
const MESSAGE_ALIAS_WINDOW_MS = 15_000
const NEW_MESSAGE_WINDOW_SECONDS = 30
let queueSequence = 0
let queueRunTimer: number | undefined
const THREAD_PANEL_SELECTOR = [
  "[data-qa='thread_view']",
  "[data-qa='threads_flexpane']",
  "[data-qa='thread_flexpane']",
  "[aria-label*='thread' i]",
  ".p-threads_flexpane",
  ".p-flexpane",
].join(", ")

async function inspect(node: HTMLElement): Promise<void> {
  try {
    if (!settings.privacyConsent) return
    const message = extractMessage(node)
    const anchor = getTranslationAnchor(node)
    if (message && anchor) {
      // Messages sent by the current user are first rendered with a temporary
      // client ID. Wait for Slack's stable timestamp so the optimistic and
      // confirmed DOM versions cannot produce separate translation requests.
      if (!message.timestamp) return
      const messageKey = resolveMessageKey(message)
      const existingJob = queuedTranslations.get(messageKey)
      if (existingJob && !existingJob.started && isInThreadPanel(node)) {
        existingJob.threadPanelPriority = true
        sortAutoTranslationQueue()
      }
      // Persist in the background. Rendering and queueing must not wait for an
      // IndexedDB write when Slack initially loads a large channel.
      const persisted = sendMessageSafely({ type: "observe-message", message })
      const controller = renderPlaceholder(node, anchor, message, async () => {
        await persisted
        return await sendMessageSafely<ThreadContextPlan>({ type: "get-thread-context", message }) ?? { recentMessages: [] }
      })
      if (controller) {
        const messageControllers = controllers.get(messageKey) ?? new Set<TranslationController>()
        messageControllers.add(controller)
        controllers.set(messageKey, messageControllers)
        const completedTranslation = completedTranslationsByMessage.get(messageKey)
        if (completedTranslation) controller.applyTranslation(completedTranslation)
        else if (stoppedMessageKeys.has(messageKey)) controller.markStopped()
      }
      if (
        controller &&
        !completedTranslationsByMessage.has(messageKey) &&
        !stoppedMessageKeys.has(messageKey) &&
        settings.configured &&
        settings.autoTranslate
      ) {
        enqueueTranslation(messageKey, controller, controller.run, message, isInThreadPanel(node))
      }
    }
  } catch (error) {
    // Reloading an unpacked extension destroys its old content-script context.
    // The refreshed Slack tab receives a new script; the old one should stop
    // quietly instead of producing an uncaught console error.
    if (!isContextInvalidated(error)) throw error
  }
}

function isContextInvalidated(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Extension context invalidated")
}

function prioritize(job: QueuedTranslation): void {
  if (job.started) return
  job.manualPriority = true
  for (const controller of job.targets.keys()) controller.markPrioritized()
  sortAutoTranslationQueue()
  publishQueueStats()
  scheduleQueueRun()
}

function runAutoTranslationQueue(): void {
  sortAutoTranslationQueue()
  while (activeTranslations < MAX_CONCURRENT_TRANSLATIONS && autoTranslationQueue.length > 0) {
    const jobIndex = autoTranslationQueue.findIndex((candidate) => (
      isPriorityJob(candidate) || activeBackgroundTranslations < MAX_BACKGROUND_TRANSLATIONS
    ))
    if (jobIndex < 0) return
    const [job] = autoTranslationQueue.splice(jobIndex, 1)
    if (!job) return

    job.started = true
    job.usesBackgroundSlot = !isPriorityJob(job)
    activeTranslations += 1
    if (job.usesBackgroundSlot) activeBackgroundTranslations += 1
    publishQueueStats()
    const [primaryController, run] = job.targets.entries().next().value as [TranslationController, () => Promise<string | undefined>]
    job.result = run()
    void job.result.then((translation) => {
      if (!translation) return
      completedTranslationsByMessage.set(job.messageId, translation)
      for (const controller of job.targets.keys()) {
        if (controller !== primaryController) controller.applyTranslation(translation)
      }
    }).finally(() => {
      if (queuedTranslations.get(job.messageId) === job) queuedTranslations.delete(job.messageId)
      activeTranslations = Math.max(0, activeTranslations - 1)
      if (job.usesBackgroundSlot) activeBackgroundTranslations = Math.max(0, activeBackgroundTranslations - 1)
      completedTranslations = Math.min(totalTranslations, completedTranslations + 1)
      publishQueueStats()
      runAutoTranslationQueue()
    })
  }
}

export function startMessageObserver(): MutationObserver {
  publishQueueStats()
  void loadSettingsAndInspect()

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const addedNode of Array.from(record.addedNodes)) {
        if (!(addedNode instanceof HTMLElement)) continue
        if (isMessageCandidate(addedNode)) void inspect(addedNode)
        const container = addedNode.closest<HTMLElement>("[data-qa='message_container'], [data-message-id], .c-message_kit__message[data-ts]")
        if (container) void inspect(container)
        for (const node of findMessageNodes(addedNode)) void inspect(node)
      }
      if (record.type === "attributes" && record.target instanceof HTMLElement) {
        const container = isMessageCandidate(record.target)
          ? record.target
          : record.target.closest<HTMLElement>("[data-qa='message_container'], [data-message-id], .c-message_kit__message[data-ts]")
        if (container) void inspect(container)
      }
    }
  })

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-message-id", "data-msg-ts", "data-ts"],
    childList: true,
    subtree: true,
  })
  window.addEventListener("pagehide", () => {
    observer.disconnect()
    if (queueRunTimer !== undefined) window.clearTimeout(queueRunTimer)
    activeTranslations = 0
    activeBackgroundTranslations = 0
    autoTranslationQueue.length = 0
    queuedTranslations.clear()
    publishQueueStats()
  }, { once: true })

  chrome.runtime.onMessage.addListener((request: ContentRequest) => {
    if (request.type === "retranslate-visible") {
      for (const node of findMessageNodes()) {
        const message = extractMessage(node)
        if (!message || !node.getBoundingClientRect().height) continue
        const messageKey = resolveMessageKey(message)
        stoppedMessageKeys.delete(messageKey)
        const messageControllers = controllers.get(messageKey)
        if (!messageControllers) continue
        for (const controller of messageControllers) {
          enqueueTranslation(messageKey, controller, controller.retranslate, message, isInThreadPanel(node))
        }
      }
      publishQueueStats()
      runAutoTranslationQueue()
      return
    }

    if (request.type === "terminate-slack-translations") {
      const stoppedCount = autoTranslationQueue.length
      for (const job of autoTranslationQueue) {
        stoppedMessageKeys.add(job.messageId)
        queuedTranslations.delete(job.messageId)
        for (const controller of job.targets.keys()) controller.markStopped()
      }
      autoTranslationQueue.length = 0
      totalTranslations = Math.max(completedTranslations + activeTranslations, totalTranslations - stoppedCount)
      publishQueueStats()
    }
  })

  return observer
}

function getMessageKey(message: RawSlackMessage): string {
  // Slack can expose different container IDs and incomplete channel metadata
  // for the same message in the channel list and thread panel. Its timestamp
  // remains stable across those DOM copies, so use it as the queue identity.
  return normalizeSlackMessageId(message.timestamp ?? message.messageId)
}

function resolveMessageKey(message: RawSlackMessage): string {
  const messageKey = getMessageKey(message)
  // Slack's optimistic and confirmed DOM versions can disagree about author
  // metadata. For newly sent messages, source text is the stable bridge. The
  // recency guard prevents historical messages with identical text from being
  // merged when Slack virtualizes or initially scans a channel.
  const aliasKey = message.sourceText
  const timestamp = Number.parseFloat(message.timestamp ?? "")
  const now = Date.now()
  const existing = recentMessageAliases.get(aliasKey)
  const nowSeconds = now / 1000
  const isRecentTimestamp = (value: number) => Number.isFinite(value) && Math.abs(nowSeconds - value) <= NEW_MESSAGE_WINDOW_SECONDS

  if (
    existing &&
    now - existing.lastSeenAt <= MESSAGE_ALIAS_WINDOW_MS &&
    (isRecentTimestamp(timestamp) || isRecentTimestamp(existing.timestamp))
  ) {
    existing.lastSeenAt = now
    return existing.messageKey
  }

  if (!isRecentTimestamp(timestamp)) return messageKey

  recentMessageAliases.set(aliasKey, { messageKey, timestamp, lastSeenAt: now })
  if (recentMessageAliases.size > 500) {
    for (const [key, value] of recentMessageAliases) {
      if (now - value.lastSeenAt > MESSAGE_ALIAS_WINDOW_MS) recentMessageAliases.delete(key)
    }
  }
  return messageKey
}

function normalizeSlackMessageId(value: string): string {
  const permalinkMatch = value.match(/^p(\d{10})(\d{6})$/)
  if (permalinkMatch) return `${permalinkMatch[1]}.${permalinkMatch[2]}`
  return value
}

function enqueueTranslation(
  messageId: string,
  controller: TranslationController,
  run: () => Promise<string | undefined>,
  message: RawSlackMessage,
  threadPanelPriority: boolean,
): void {
  const existing = queuedTranslations.get(messageId)
  if (existing) {
    if (existing.targets.has(controller)) return
    existing.targets.set(controller, run)
    existing.threadPanelPriority ||= threadPanelPriority
    existing.recentPriority ||= isRecentMessage(message)
    existing.timestamp = Math.max(existing.timestamp, getMessageTimestamp(message))
    if (existing.started) {
      void existing.result?.then((translation) => {
        if (translation) controller.applyTranslation(translation)
      })
    }
    else controller.markQueued(() => prioritize(existing))
    sortAutoTranslationQueue()
    return
  }

  if (activeTranslations === 0 && autoTranslationQueue.length === 0) {
    completedTranslations = 0
    totalTranslations = 0
  }
  totalTranslations += 1
  const job: QueuedTranslation = {
    messageId,
    targets: new Map([[controller, run]]),
    started: false,
    usesBackgroundSlot: false,
    manualPriority: false,
    threadPanelPriority,
    recentPriority: isRecentMessage(message),
    timestamp: getMessageTimestamp(message),
    sequence: queueSequence++,
  }
  queuedTranslations.set(messageId, job)
  autoTranslationQueue.push(job)
  sortAutoTranslationQueue()
  controller.markQueued(() => prioritize(job))
  publishQueueStats()
  runAutoTranslationQueue()
}

function isInThreadPanel(node: HTMLElement): boolean {
  return Boolean(node.closest(THREAD_PANEL_SELECTOR))
}

function getMessageTimestamp(message: RawSlackMessage): number {
  const timestamp = Number.parseFloat(message.timestamp ?? "")
  return Number.isFinite(timestamp) ? timestamp : 0
}

function isRecentMessage(message: RawSlackMessage): boolean {
  const timestamp = getMessageTimestamp(message)
  return timestamp > 0 && Math.abs(Date.now() / 1000 - timestamp) <= NEW_MESSAGE_WINDOW_SECONDS
}

function isPriorityJob(job: QueuedTranslation): boolean {
  return job.manualPriority || job.threadPanelPriority || job.recentPriority
}

function sortAutoTranslationQueue(): void {
  autoTranslationQueue.sort((left, right) => {
    if (left.manualPriority !== right.manualPriority) return left.manualPriority ? -1 : 1
    if (left.threadPanelPriority !== right.threadPanelPriority) return left.threadPanelPriority ? -1 : 1
    if (left.recentPriority !== right.recentPriority) return left.recentPriority ? -1 : 1
    if (left.timestamp !== right.timestamp) return right.timestamp - left.timestamp
    return left.sequence - right.sequence
  })
}

function scheduleQueueRun(): void {
  if (queueRunTimer !== undefined) window.clearTimeout(queueRunTimer)
  // Slack appends a virtualized message list over several mutation batches.
  // Wait for a short quiet period so recent and thread messages can reach the
  // queue before older visible history consumes the background slots.
  queueRunTimer = window.setTimeout(() => {
    queueRunTimer = undefined
    runAutoTranslationQueue()
  }, 80)
}

function publishQueueStats(): void {
  void sendMessageSafely({
    type: "update-slack-translation-stats",
    waiting: autoTranslationQueue.length,
    active: activeTranslations,
    concurrency: MAX_CONCURRENT_TRANSLATIONS,
    completed: completedTranslations,
    total: totalTranslations,
  })
}

async function loadSettingsAndInspect(): Promise<void> {
  try {
    const response = await sendMessageSafely<PublicSettings>({ type: "get-public-settings" })
    if (response) settings = response
    if (!settings.privacyConsent) return
    for (const node of findMessageNodes()) void inspect(node)
  } catch (error) {
    if (!isContextInvalidated(error)) throw error
  }
}

async function sendMessageSafely<T>(message: unknown): Promise<T | undefined> {
  try {
    return await chrome.runtime.sendMessage(message) as T | undefined
  } catch (error) {
    if (isContextInvalidated(error)) return undefined
    throw error
  }
}
