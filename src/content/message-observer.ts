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
  showTranslations: true,
  privacyConsent: false,
}
let activeTranslations = 0
// Message jobs are drained into the background batch collector. Provider
// request concurrency and rate limiting belong to the background service.
type QueuedTranslation = {
  messageId: string
  targets: Map<TranslationController, (priority?: boolean) => Promise<string | undefined>>
  started: boolean
  result?: Promise<string | undefined>
  usesBackgroundSlot: boolean
  manualPriority: boolean
  threadPanelPriority: boolean
  recentPriority: boolean
  automaticPriority: boolean
  timestamp: number
  sequence: number
  requestGeneration: number
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
        if (completedTranslation !== undefined) controller.applyTranslation(completedTranslation)
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
  const generation = ++job.requestGeneration
  job.manualPriority = true
  for (const controller of job.targets.keys()) controller.markPrioritized()
  const [primaryController] = job.targets.keys() as MapIterator<TranslationController>
  if (!primaryController) return

  if (!job.started) {
    const queueIndex = autoTranslationQueue.indexOf(job)
    if (queueIndex >= 0) autoTranslationQueue.splice(queueIndex, 1)
    job.started = true
    job.usesBackgroundSlot = false
    activeTranslations += 1
    publishQueueStats()
  }

  void primaryController.runUrgent().then((translation) => {
    if (translation === undefined || generation !== job.requestGeneration) return
    completedTranslationsByMessage.set(job.messageId, translation)
    for (const controller of job.targets.keys()) {
      if (controller !== primaryController) controller.applyTranslation(translation)
    }
  }).finally(() => {
    if (job.result || generation !== job.requestGeneration) return
    finishTranslationJob(job)
  })
}

function runAutoTranslationQueue(): void {
  sortAutoTranslationQueue()
  markAutomaticPriorityJobs()
  while (autoTranslationQueue.length > 0) {
    const [job] = autoTranslationQueue.splice(0, 1)
    if (!job) return

    job.started = true
    job.usesBackgroundSlot = false
    activeTranslations += 1
    publishQueueStats()
    const generation = job.requestGeneration
    const [primaryController, run] = job.targets.entries().next().value as [TranslationController, (priority?: boolean) => Promise<string | undefined>]
    job.result = run(job.automaticPriority)
    void job.result.then((translation) => {
      if (translation === undefined || generation !== job.requestGeneration) return
      completedTranslationsByMessage.set(job.messageId, translation)
      for (const controller of job.targets.keys()) {
        if (controller !== primaryController) controller.applyTranslation(translation)
      }
    }).finally(() => finishTranslationJob(job))
  }
}

export function startMessageObserver(): MutationObserver {
  publishQueueStats()
  void loadSettingsAndInspect()

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "childList" && record.target instanceof HTMLElement) {
        const container = isMessageCandidate(record.target)
          ? record.target
          : record.target.closest<HTMLElement>("[data-qa='message_container'], [data-message-id], .c-message_kit__message[data-ts]")
        if (container) void inspect(container)
      }
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
    scheduleReconcile()
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
    cancelAllTranslationJobs()
    autoTranslationQueue.length = 0
    queuedTranslations.clear()
    publishQueueStats()
  }, { once: true })

  chrome.runtime.onMessage.addListener((request: ContentRequest, _sender, sendResponse) => {
    if (request.type === "retranslate-visible") {
      let queued = 0
      for (const node of findMessageNodes()) {
        const message = extractMessage(node)
        if (!message || !node.getBoundingClientRect().height) continue
        const messageKey = resolveMessageKey(message)
        stoppedMessageKeys.delete(messageKey)
        const messageControllers = controllers.get(messageKey)
        if (!messageControllers) continue
        for (const controller of messageControllers) {
          if (!controller.isConnected()) {
            messageControllers.delete(controller)
            continue
          }
          enqueueTranslation(messageKey, controller, controller.retranslate, message, isInThreadPanel(node))
          queued += 1
        }
        if (messageControllers.size === 0) controllers.delete(messageKey)
      }
      publishQueueStats()
      runAutoTranslationQueue()
      sendResponse({ ok: queued > 0, queued })
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
      publishQueueStats()
    }

    if (request.type === "set-translation-visibility") {
      settings.showTranslations = request.visible
      applyTranslationVisibility(request.visible)
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
  run: (priority?: boolean) => Promise<string | undefined>,
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
        if (translation !== undefined) controller.applyTranslation(translation)
      })
    }
    else controller.markQueued(() => prioritize(existing))
    sortAutoTranslationQueue()
    return
  }

  const job: QueuedTranslation = {
    messageId,
    targets: new Map([[controller, run]]),
    started: false,
    usesBackgroundSlot: false,
    manualPriority: false,
    threadPanelPriority,
    recentPriority: isRecentMessage(message),
    automaticPriority: false,
    timestamp: getMessageTimestamp(message),
    sequence: queueSequence++,
    requestGeneration: 0,
  }
  queuedTranslations.set(messageId, job)
  autoTranslationQueue.push(job)
  sortAutoTranslationQueue()
  controller.markQueued(() => prioritize(job))
  publishQueueStats()
  scheduleQueueRun()
}

function finishTranslationJob(job: QueuedTranslation): void {
  if (queuedTranslations.get(job.messageId) !== job) return
  queuedTranslations.delete(job.messageId)
  activeTranslations = Math.max(0, activeTranslations - 1)
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

function markAutomaticPriorityJobs(): void {
  for (const job of autoTranslationQueue) job.automaticPriority = false
  const newest = [...autoTranslationQueue]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 3)
  for (const job of newest) job.automaticPriority = true
}

let reconcileTimer: number | undefined

function scheduleReconcile(): void {
  if (reconcileTimer !== undefined) window.clearTimeout(reconcileTimer)
  reconcileTimer = window.setTimeout(() => {
    reconcileTimer = undefined
    reconcileDisconnectedJobs()
  }, 100)
}

function reconcileDisconnectedJobs(): void {
  for (const job of [...queuedTranslations.values()]) {
    for (const controller of job.targets.keys()) {
      if (!controller.isConnected()) {
        controller.cancel()
        job.targets.delete(controller)
      }
    }
    if (job.targets.size > 0) continue
    const queueIndex = autoTranslationQueue.indexOf(job)
    if (queueIndex >= 0) autoTranslationQueue.splice(queueIndex, 1)
    queuedTranslations.delete(job.messageId)
    if (job.started) activeTranslations = Math.max(0, activeTranslations - 1)
  }
  publishQueueStats()
}

function cancelAllTranslationJobs(): void {
  for (const job of queuedTranslations.values()) {
    for (const controller of job.targets.keys()) controller.cancel()
  }
  activeTranslations = 0
}

function publishQueueStats(): void {
  void sendMessageSafely({
    type: "update-slack-translation-stats",
    waiting: autoTranslationQueue.length,
    active: activeTranslations,
  })
}

async function loadSettingsAndInspect(): Promise<void> {
  try {
    const response = await sendMessageSafely<PublicSettings>({ type: "get-public-settings" })
    if (response) settings = response
    applyTranslationVisibility(settings.showTranslations)
    if (!settings.privacyConsent) return
    for (const node of findMessageNodes()) void inspect(node)
  } catch (error) {
    if (!isContextInvalidated(error)) throw error
  }
}

function applyTranslationVisibility(visible: boolean): void {
  document.documentElement.classList.toggle("slacktor-hide-translations", !visible)
  let style = document.querySelector<HTMLStyleElement>("#slacktor-visibility-style")
  if (!style) {
    style = document.createElement("style")
    style.id = "slacktor-visibility-style"
    style.textContent = ".slacktor-hide-translations [data-slacktor-translation] { display: none !important; }"
    document.documentElement.append(style)
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
