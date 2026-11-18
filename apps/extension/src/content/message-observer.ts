import { DEFAULT_SETTINGS_TARGET_LANGUAGE } from "../shared/languages"
import type { ContentRequest, ObserveMessageResponse, PublicSettings } from "../shared/messages"
import { normalizeSlackMessageId, type RawSlackMessage } from "../shared/types"
import {
  extractMessage,
  findClosestMessageNode,
  findMessageNodes,
  getTranslationAnchor,
  isMessageCandidate,
  NON_TEXT_MUTATION_ZONE_SELECTOR,
} from "./slack-adapter"
import { startSlackThemeSync } from "./slack-theme"
import type { TranslationController } from "./translation-renderer"
import { renderPlaceholder, setTranslationLanguage } from "./translation-renderer"

let settings: PublicSettings = {
  extensionEnabled: false,
  targetLanguage: DEFAULT_SETTINGS_TARGET_LANGUAGE,
  configured: false,
  autoTranslate: true,
  showTranslations: true,
  privacyConsent: false,
}
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
const controllersByRequestId = new Map<
  string,
  { controller: TranslationController; messageKey: string }
>()
const completedTranslationsByMessage = new Map<string, string>()
const stoppedMessageKeys = new Set<string>()
const failedMessageKeys = new Map<string, string>()
const outdatedMessageKeys = new Set<string>()
const manuallyRequestedMessageKeys = new Set<string>()
type MessageLifecycleState = {
  firstSeenAt: number
  lastUpdatedAt: number
  wasEdited: boolean
  wasExpanded: boolean
  stabilizationTimer?: number
}
const messageLifecycleByKey = new Map<string, MessageLifecycleState>()
const STREAM_STABILIZATION_DELAY_MS = 450
const INITIAL_HYDRATION_WINDOW_MS = 3_000
const ACTIVE_STREAM_WINDOW_MS = 2_000
const recentMessageAliases = new Map<
  string,
  {
    messageKey: string
    authorMemberId?: string
    timestamp: number
    lastSeenAt: number
  }
>()
const MESSAGE_ALIAS_WINDOW_MS = 15_000
const NEW_MESSAGE_WINDOW_SECONDS = 30
let queueSequence = 0
let queueRunTimer: number | undefined
let activeObserver: MutationObserver | undefined
let isObserverTerminated = false

function clearStabilizationTimer(messageKey: string): void {
  const state = messageLifecycleByKey.get(messageKey)
  if (state?.stabilizationTimer !== undefined) {
    window.clearTimeout(state.stabilizationTimer)
    state.stabilizationTimer = undefined
  }
}

function clearAllStabilizationTimers(): void {
  for (const state of messageLifecycleByKey.values()) {
    if (state.stabilizationTimer !== undefined) {
      window.clearTimeout(state.stabilizationTimer)
      state.stabilizationTimer = undefined
    }
  }
}

function isRuntimeAvailable(): boolean {
  try {
    return Boolean(typeof chrome !== "undefined" && chrome.runtime?.id)
  } catch {
    return false
  }
}

function shutdownObserver(): void {
  if (isObserverTerminated) return
  isObserverTerminated = true
  activeObserver?.disconnect()
  activeObserver = undefined
  if (queueRunTimer !== undefined) {
    window.clearTimeout(queueRunTimer)
    queueRunTimer = undefined
  }
  clearAllStabilizationTimers()
  cancelAllTranslationJobs()
  autoTranslationQueue.length = 0
  controllersByRequestId.clear()

  for (const messageControllers of controllers.values()) {
    for (const ctrl of messageControllers) {
      if (ctrl.isTranslating?.()) {
        ctrl.cancel()
        ctrl.showRetry?.("Extension reloaded. Please refresh Slack (F5).")
      }
    }
  }
}
export const THREAD_PANEL_SELECTOR = [
  "[data-qa='thread_view']",
  "[data-qa='threads_flexpane']",
  "[data-qa='thread_flexpane']",
  "[aria-label*='thread' i]",
  ".p-threads_flexpane",
  ".p-flexpane",
].join(", ")

async function inspect(node: HTMLElement): Promise<void> {
  try {
    if (isObserverTerminated || !isRuntimeAvailable()) {
      shutdownObserver()
      return
    }
    if (!settings.extensionEnabled || !settings.privacyConsent) return
    const message = extractMessage(node)
    const anchor = getTranslationAnchor(node)
    if (message && anchor) {
      const messageKey = resolveMessageKey(message)
      const now = Date.now()
      let lifecycle = messageLifecycleByKey.get(messageKey)
      if (!lifecycle) {
        lifecycle = {
          firstSeenAt: now,
          lastUpdatedAt: now,
          wasEdited: Boolean(message.isEdited),
          wasExpanded: Boolean(message.isExpanded),
        }
        messageLifecycleByKey.set(messageKey, lifecycle)
        if (messageLifecycleByKey.size > 1000) {
          const oldestKey = messageLifecycleByKey.keys().next().value
          if (oldestKey) {
            clearStabilizationTimer(oldestKey)
            messageLifecycleByKey.delete(oldestKey)
          }
        }
      }

      const existingJob = queuedTranslations.get(messageKey)
      if (existingJob && !existingJob.started && isInThreadPanel(node)) {
        existingJob.threadPanelPriority = true
        sortAutoTranslationQueue()
      }
      // Persist in the background and check for cached translation.
      // Rendering and queueing must not wait for an IndexedDB write when Slack initially loads a large channel.
      const persisted = sendMessageSafely<ObserveMessageResponse>({
        type: "observe-message",
        message,
      })
      const waitForPersist = async () => {
        await persisted
      }
      const controller = renderPlaceholder(
        node,
        anchor,
        message,
        waitForPersist,
        (translation) => {
          failedMessageKeys.delete(messageKey)
          outdatedMessageKeys.delete(messageKey)
          completedTranslationsByMessage.set(messageKey, translation)
          const messageControllers = controllers.get(messageKey)
          if (messageControllers) {
            for (const ctrl of messageControllers) {
              if (ctrl !== controller) ctrl.applyTranslation(translation)
            }
          }
          publishQueueStats()
        },
        (forceRefresh, urgent = false, manual = false, requestId) => {
          clearStabilizationTimer(messageKey)
          if (requestId && controller) {
            controllersByRequestId.set(requestId, { controller, messageKey })
          }
          if (manual) {
            manuallyRequestedMessageKeys.add(messageKey)
          }
          if (forceRefresh || urgent || manual) {
            completedTranslationsByMessage.delete(messageKey)
            failedMessageKeys.delete(messageKey)
            stoppedMessageKeys.delete(messageKey)
            outdatedMessageKeys.delete(messageKey)
            cancelTranslationJobForMessage(messageKey, controller)
          }
          const messageControllers = controllers.get(messageKey)
          if (messageControllers) {
            for (const ctrl of messageControllers) {
              if (ctrl !== controller) ctrl.markPrioritized(urgent, urgent, forceRefresh)
            }
          }
          publishQueueStats()
        },
        (error) => {
          completedTranslationsByMessage.delete(messageKey)
          failedMessageKeys.set(messageKey, error)
          const messageControllers = controllers.get(messageKey)
          if (messageControllers) {
            for (const ctrl of messageControllers) {
              if (ctrl !== controller) ctrl.showRetry?.(error)
            }
          }
          publishQueueStats()
        },
        (requestId) => {
          if (requestId) {
            controllersByRequestId.delete(requestId)
          }
          publishQueueStats()
        },
      )
      if (controller) {
        const messageControllers = controllers.get(messageKey) ?? new Set<TranslationController>()
        messageControllers.add(controller)
        controllers.set(messageKey, messageControllers)

        void persisted.then((response) => {
          if (!response?.cachedTranslation) return
          if (message.skipAutoTranslateReason && !manuallyRequestedMessageKeys.has(messageKey))
            return
          if (controller.getSourceText() !== message.sourceText) return
          const currentControllers = controllers.get(messageKey)
          const isAnyTranslating = currentControllers
            ? Array.from(currentControllers).some((ctrl) => ctrl.isTranslating?.())
            : Boolean(controller.isTranslating?.())
          if (isAnyTranslating) return
          completedTranslationsByMessage.set(messageKey, response.cachedTranslation)
          cancelTranslationJobForMessage(messageKey)
          if (currentControllers) {
            for (const ctrl of currentControllers) {
              ctrl.applyTranslation(response.cachedTranslation)
            }
          } else {
            controller.applyTranslation(response.cachedTranslation)
          }
          publishQueueStats()
        })

        const previousSourceText = controller.getSourceText()
        const isSourceTextChanged = previousSourceText !== message.sourceText

        if (isSourceTextChanged) {
          clearStabilizationTimer(messageKey)
          const isExpansionToggle = Boolean(message.isExpanded) !== lifecycle.wasExpanded
          const isProgressiveHydrationOrStream =
            Boolean(message.isStreaming) ||
            isExpansionToggle ||
            (!message.isEdited &&
              (now - lifecycle.firstSeenAt <= INITIAL_HYDRATION_WINDOW_MS ||
                now - lifecycle.lastUpdatedAt <= ACTIVE_STREAM_WINDOW_MS ||
                message.sourceText.startsWith(previousSourceText)))

          lifecycle.lastUpdatedAt = now
          lifecycle.wasEdited = Boolean(message.isEdited)
          lifecycle.wasExpanded = Boolean(message.isExpanded)

          completedTranslationsByMessage.delete(messageKey)
          failedMessageKeys.delete(messageKey)
          stoppedMessageKeys.delete(messageKey)
          cancelTranslationJobForMessage(messageKey)

          for (const ctrl of messageControllers) {
            ctrl.updateMessage(message, waitForPersist)
          }

          if (message.skipAutoTranslateReason && !manuallyRequestedMessageKeys.has(messageKey)) {
            outdatedMessageKeys.delete(messageKey)
            for (const ctrl of messageControllers) {
              ctrl.markSkipped(message.skipAutoTranslateReason)
            }
            publishQueueStats()
          } else if (isProgressiveHydrationOrStream) {
            // Progressive token streaming, late forwarded-card hydration, or "See more" expansion:
            // do not mark as "Message edited". Instead, debounce while streaming or enqueue immediately on expansion.
            outdatedMessageKeys.delete(messageKey)
            if (
              settings.configured &&
              (settings.autoTranslate || manuallyRequestedMessageKeys.has(messageKey))
            ) {
              if (isExpansionToggle && !message.isStreaming) {
                enqueueTranslation(
                  messageKey,
                  controller,
                  controller.run,
                  message,
                  isInThreadPanel(node),
                )
              } else {
                for (const ctrl of messageControllers) {
                  ctrl.markQueued(() => {
                    clearStabilizationTimer(messageKey)
                    enqueueTranslation(messageKey, ctrl, ctrl.run, message, isInThreadPanel(node))
                    const job = queuedTranslations.get(messageKey)
                    if (job) prioritize(job)
                  })
                }
                publishQueueStats()
                lifecycle.stabilizationTimer = window.setTimeout(() => {
                  lifecycle.stabilizationTimer = undefined
                  if (node.isConnected) {
                    void inspect(node)
                  }
                }, STREAM_STABILIZATION_DELAY_MS)
              }
            }
          } else {
            manuallyRequestedMessageKeys.delete(messageKey)
            outdatedMessageKeys.add(messageKey)
            for (const ctrl of messageControllers) {
              ctrl.markOutdated?.()
            }
            publishQueueStats()
          }
        } else if (
          message.skipAutoTranslateReason &&
          !manuallyRequestedMessageKeys.has(messageKey)
        ) {
          clearStabilizationTimer(messageKey)
          completedTranslationsByMessage.delete(messageKey)
          failedMessageKeys.delete(messageKey)
          stoppedMessageKeys.delete(messageKey)
          outdatedMessageKeys.delete(messageKey)
          cancelTranslationJobForMessage(messageKey)
          for (const ctrl of messageControllers) {
            ctrl.markSkipped(message.skipAutoTranslateReason)
          }
          publishQueueStats()
        } else if (message.isStreaming && lifecycle.stabilizationTimer === undefined) {
          // Message mounted while still actively streaming tokens: wait for stabilization before translating.
          if (settings.configured && settings.autoTranslate) {
            for (const ctrl of messageControllers) {
              ctrl.markQueued(() => {
                clearStabilizationTimer(messageKey)
                enqueueTranslation(messageKey, ctrl, ctrl.run, message, isInThreadPanel(node))
                const job = queuedTranslations.get(messageKey)
                if (job) prioritize(job)
              })
            }
            publishQueueStats()
            lifecycle.stabilizationTimer = window.setTimeout(() => {
              lifecycle.stabilizationTimer = undefined
              if (node.isConnected) {
                void inspect(node)
              }
            }, STREAM_STABILIZATION_DELAY_MS)
          }
        } else if (lifecycle.stabilizationTimer === undefined) {
          if (controller.isTranslating?.()) {
            return
          }
          const activeTranslatingController = Array.from(messageControllers).find(
            (c) => c !== controller && c.isTranslating?.(),
          )
          if (activeTranslatingController) {
            const activeJob = queuedTranslations.get(messageKey)
            if (activeJob && !activeJob.targets.has(controller)) {
              activeJob.targets.set(controller, controller.run)
            }
            controller.markPrioritized(
              Boolean(activeTranslatingController.isUrgent?.() || activeJob?.manualPriority),
              Boolean(activeTranslatingController.isApiStarted?.() || activeJob?.manualPriority),
            )
            return
          }

          const completedTranslation = completedTranslationsByMessage.get(messageKey)
          const failedError = failedMessageKeys.get(messageKey)
          if (completedTranslation !== undefined) controller.applyTranslation(completedTranslation)
          else if (failedError !== undefined) controller.showRetry?.(failedError)
          else if (stoppedMessageKeys.has(messageKey)) controller.markStopped()
          else if (outdatedMessageKeys.has(messageKey)) controller.markOutdated?.()
          else if (message.skipAutoTranslateReason)
            controller.markSkipped(message.skipAutoTranslateReason)
          else if (
            !completedTranslationsByMessage.has(messageKey) &&
            !failedMessageKeys.has(messageKey) &&
            !stoppedMessageKeys.has(messageKey) &&
            !outdatedMessageKeys.has(messageKey) &&
            !message.skipAutoTranslateReason &&
            settings.configured &&
            (settings.autoTranslate || manuallyRequestedMessageKeys.has(messageKey))
          ) {
            enqueueTranslation(
              messageKey,
              controller,
              controller.run,
              message,
              isInThreadPanel(node),
            )
          }
        }
      }
    }
  } catch (error) {
    // Reloading an unpacked extension destroys its old content-script context.
    // The refreshed Slack tab receives a new script; the old one should stop
    // quietly instead of producing an uncaught console error.
    if (isContextInvalidated(error)) {
      shutdownObserver()
      return
    }
    throw error
  }
}

function isContextInvalidated(error: unknown): boolean {
  if (!error) return false
  if (typeof error === "string") return error.includes("Extension context invalidated")
  return error instanceof Error && error.message.includes("Extension context invalidated")
}

function prioritize(job: QueuedTranslation): void {
  const generation = ++job.requestGeneration
  job.manualPriority = true
  const [primaryController] = job.targets.keys() as MapIterator<TranslationController>
  if (!primaryController) return

  if (!job.started) {
    const queueIndex = autoTranslationQueue.indexOf(job)
    if (queueIndex >= 0) autoTranslationQueue.splice(queueIndex, 1)
    job.started = true
    job.usesBackgroundSlot = false
  }

  void primaryController
    .runUrgent()
    .then((translation) => {
      if (translation === undefined || generation !== job.requestGeneration) return
      failedMessageKeys.delete(job.messageId)
      outdatedMessageKeys.delete(job.messageId)
      completedTranslationsByMessage.set(job.messageId, translation)
      for (const controller of job.targets.keys()) {
        if (controller !== primaryController) controller.applyTranslation(translation)
      }
    })
    .finally(() => {
      if (job.result || generation !== job.requestGeneration) return
      finishTranslationJob(job)
    })
  publishQueueStats()
}

function runAutoTranslationQueue(): void {
  sortAutoTranslationQueue()
  markAutomaticPriorityJobs()
  while (autoTranslationQueue.length > 0) {
    const [job] = autoTranslationQueue.splice(0, 1)
    if (!job) return

    const cached = completedTranslationsByMessage.get(job.messageId)
    if (cached !== undefined) {
      for (const controller of job.targets.keys()) {
        controller.applyTranslation(cached)
      }
      finishTranslationJob(job)
      continue
    }

    job.started = true
    job.usesBackgroundSlot = false
    const generation = job.requestGeneration
    const [primaryController, run] = job.targets.entries().next().value as [
      TranslationController,
      (priority?: boolean) => Promise<string | undefined>,
    ]
    job.result = run(job.automaticPriority)
    void job.result
      .then((translation) => {
        if (translation === undefined || generation !== job.requestGeneration) return
        failedMessageKeys.delete(job.messageId)
        outdatedMessageKeys.delete(job.messageId)
        completedTranslationsByMessage.set(job.messageId, translation)
        for (const controller of job.targets.keys()) {
          if (controller !== primaryController) controller.applyTranslation(translation)
        }
      })
      .finally(() => finishTranslationJob(job))
  }
  publishQueueStats()
}

export function startMessageObserver(): MutationObserver {
  startSlackThemeSync()
  publishQueueStats()
  void loadSettingsAndInspect()

  const observer = new MutationObserver((records) => {
    if (isObserverTerminated || !isRuntimeAvailable()) {
      shutdownObserver()
      return
    }
    const inspectedContainers = new Set<HTMLElement>()

    const scheduleInspect = (container: HTMLElement | undefined) => {
      if (!container || inspectedContainers.has(container)) return
      inspectedContainers.add(container)
      void inspect(container)
    }

    for (const record of records) {
      if (record.type === "childList" && record.target instanceof HTMLElement) {
        if (!record.target.closest(NON_TEXT_MUTATION_ZONE_SELECTOR)) {
          const container = isMessageCandidate(record.target)
            ? record.target
            : findClosestMessageNode(record.target)
          scheduleInspect(container)
        }
      }
      for (const addedNode of Array.from(record.addedNodes)) {
        if (!(addedNode instanceof HTMLElement)) continue
        if (addedNode.closest(NON_TEXT_MUTATION_ZONE_SELECTOR)) continue
        if (isMessageCandidate(addedNode)) scheduleInspect(addedNode)
        const container = findClosestMessageNode(addedNode)
        scheduleInspect(container)
        for (const node of findMessageNodes(addedNode)) scheduleInspect(node)
      }
      if (record.type === "attributes" && record.target instanceof HTMLElement) {
        if (!record.target.closest(NON_TEXT_MUTATION_ZONE_SELECTOR)) {
          const container = isMessageCandidate(record.target)
            ? record.target
            : findClosestMessageNode(record.target)
          scheduleInspect(container)
        }
      }
      if (record.type === "characterData") {
        const parent = record.target.parentElement
        if (parent && !parent.closest(NON_TEXT_MUTATION_ZONE_SELECTOR)) {
          const container = isMessageCandidate(parent) ? parent : findClosestMessageNode(parent)
          scheduleInspect(container)
        }
      }
    }
    scheduleReconcile()
  })

  activeObserver = observer
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: [
      "data-message-id",
      "data-msg-ts",
      "data-ts",
      "data-qa-placeholder",
      "data-qa-unprocessed",
      "aria-expanded",
    ],
    childList: true,
    characterData: true,
    subtree: true,
  })
  window.addEventListener(
    "pagehide",
    () => {
      observer.disconnect()
      if (queueRunTimer !== undefined) window.clearTimeout(queueRunTimer)
      clearAllStabilizationTimers()
      cancelAllTranslationJobs()
      autoTranslationQueue.length = 0
      queuedTranslations.clear()
      controllersByRequestId.clear()
      publishQueueStats()
    },
    { once: true },
  )

  chrome.runtime.onMessage.addListener((request: ContentRequest, _sender, sendResponse) => {
    if (request.type === "translation-api-started") {
      for (const requestId of request.requestIds) {
        const entry = controllersByRequestId.get(requestId)
        if (!entry) continue
        entry.controller.markApiStarted()
        const messageControllers = controllers.get(entry.messageKey)
        if (messageControllers) {
          for (const ctrl of messageControllers) {
            if (ctrl !== entry.controller) ctrl.markApiStarted()
          }
        }
      }
      publishQueueStats()
      return
    }

    if (request.type === "retranslate-visible") {
      if (!settings.extensionEnabled) {
        sendResponse?.({ ok: false, queued: 0 })
        return
      }
      if (request.force) {
        cancelAllTranslationJobs()
        autoTranslationQueue.length = 0
        queuedTranslations.clear()
        completedTranslationsByMessage.clear()
        failedMessageKeys.clear()
        outdatedMessageKeys.clear()
      }
      void loadSettingsAndInspect().then(() => {
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
            if (message.skipAutoTranslateReason) {
              controller.markSkipped(message.skipAutoTranslateReason)
              continue
            }
            if (!settings.autoTranslate && !controller.isTranslated?.()) {
              continue
            }
            enqueueTranslation(
              messageKey,
              controller,
              controller.retranslate,
              message,
              isInThreadPanel(node),
            )
            queued += 1
          }
          if (messageControllers.size === 0) controllers.delete(messageKey)
        }
        publishQueueStats()
        runAutoTranslationQueue()
        sendResponse?.({ ok: queued > 0, queued })
      })
      return true
    }

    if (request.type === "terminate-slack-translations") {
      clearAllStabilizationTimers()
      for (const job of autoTranslationQueue) {
        stoppedMessageKeys.add(job.messageId)
        queuedTranslations.delete(job.messageId)
        for (const controller of job.targets.keys()) {
          controller.cancel()
          controller.markStopped()
        }
      }
      autoTranslationQueue.length = 0

      for (const [messageKey, messageControllers] of controllers.entries()) {
        const isApiStarted = Array.from(messageControllers).some(
          (ctrl) => ctrl.isTranslating?.() && ctrl.isApiStarted?.(),
        )
        if (isApiStarted) continue
        const isWaiting = Array.from(messageControllers).some(
          (ctrl) => ctrl.isQueued?.() || (ctrl.isTranslating?.() && !ctrl.isApiStarted?.()),
        )
        if (!isWaiting) continue
        stoppedMessageKeys.add(messageKey)
        queuedTranslations.delete(messageKey)
        for (const ctrl of messageControllers) {
          ctrl.cancel()
          ctrl.markStopped()
        }
      }
      publishQueueStats()
    }

    if (request.type === "set-translation-visibility") {
      settings.showTranslations = request.visible
      applyTranslationVisibility(request.visible)
    }

    if (request.type === "public-settings-changed") {
      void loadSettingsAndInspect()
    }

    if (request.type === "set-extension-enabled") {
      settings.extensionEnabled = request.enabled
      if (request.enabled) {
        void loadSettingsAndInspect()
      } else {
        clearAllStabilizationTimers()
        cancelAllTranslationJobs()
        autoTranslationQueue.length = 0
        queuedTranslations.clear()
        controllersByRequestId.clear()
        for (const host of Array.from(document.querySelectorAll("[data-slacktor-translation]")))
          host.remove()
        for (const node of Array.from(document.querySelectorAll("[data-slacktor-rendered]")))
          node.removeAttribute("data-slacktor-rendered")
        controllers.clear()
        completedTranslationsByMessage.clear()
        failedMessageKeys.clear()
        outdatedMessageKeys.clear()
        messageLifecycleByKey.clear()
        publishQueueStats()
      }
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
  // Scope by workspace and conversation to prevent identical short messages
  // in different channels or workspaces from colliding.
  const aliasKey = [
    message.workspaceId ?? "",
    message.conversationId ?? "",
    message.sourceText,
  ].join(":")
  const timestamp = Number.parseFloat(message.timestamp ?? "")
  const now = Date.now()
  const authorMemberId = message.author.status === "resolved" ? message.author.memberId : undefined
  const existing = recentMessageAliases.get(aliasKey)
  const nowSeconds = now / 1000
  const isRecentTimestamp = (value: number) =>
    Number.isFinite(value) && Math.abs(nowSeconds - value) <= NEW_MESSAGE_WINDOW_SECONDS

  const isAuthorMismatch = Boolean(
    existing?.authorMemberId && authorMemberId && existing.authorMemberId !== authorMemberId,
  )

  if (
    existing &&
    !isAuthorMismatch &&
    now - existing.lastSeenAt <= MESSAGE_ALIAS_WINDOW_MS &&
    (isRecentTimestamp(timestamp) || isRecentTimestamp(existing.timestamp))
  ) {
    existing.lastSeenAt = now
    if (!existing.authorMemberId && authorMemberId) {
      existing.authorMemberId = authorMemberId
    }
    return existing.messageKey
  }

  if (!Number.isFinite(timestamp)) {
    recentMessageAliases.set(aliasKey, { messageKey, authorMemberId, timestamp, lastSeenAt: now })
    return messageKey
  }
  if (!isRecentTimestamp(timestamp)) return messageKey

  recentMessageAliases.set(aliasKey, { messageKey, authorMemberId, timestamp, lastSeenAt: now })
  if (recentMessageAliases.size > 500) {
    for (const [key, value] of recentMessageAliases) {
      if (now - value.lastSeenAt > MESSAGE_ALIAS_WINDOW_MS) recentMessageAliases.delete(key)
    }
  }
  return messageKey
}

function enqueueTranslation(
  messageId: string,
  controller: TranslationController,
  run: (priority?: boolean) => Promise<string | undefined>,
  message: RawSlackMessage,
  threadPanelPriority: boolean,
): void {
  if (message.skipAutoTranslateReason) {
    controller.markSkipped(message.skipAutoTranslateReason)
    return
  }

  const existing = queuedTranslations.get(messageId)
  if (existing) {
    if (existing.targets.has(controller)) return
    existing.targets.set(controller, run)
    existing.threadPanelPriority ||= threadPanelPriority
    existing.recentPriority ||= isRecentMessage(message)
    existing.timestamp = Math.max(existing.timestamp, getMessageTimestamp(message))
    if (existing.started) {
      const startedController = Array.from(existing.targets.keys()).find(
        (c) => c !== controller && c.isTranslating?.(),
      )
      controller.markPrioritized(
        Boolean(startedController?.isUrgent?.() || existing.manualPriority),
        Boolean(startedController?.isApiStarted?.() || existing.manualPriority),
      )
      void existing.result?.then((translation) => {
        if (translation !== undefined) controller.applyTranslation(translation)
      })
    } else controller.markQueued(() => prioritize(existing))
    sortAutoTranslationQueue()
    publishQueueStats()
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
    if (left.threadPanelPriority !== right.threadPanelPriority)
      return left.threadPanelPriority ? -1 : 1
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
  for (const [messageKey, messageControllers] of controllers.entries()) {
    const hasConnectedController = Array.from(messageControllers).some((ctrl) => ctrl.isConnected())
    if (hasConnectedController) continue
    for (const controller of messageControllers) {
      controller.cancel()
    }
    controllers.delete(messageKey)
  }

  for (const job of [...queuedTranslations.values()]) {
    const hasConnectedTarget = Array.from(job.targets.keys()).some((ctrl) => ctrl.isConnected())
    if (hasConnectedTarget) continue
    for (const controller of job.targets.keys()) {
      controller.cancel()
    }
    const queueIndex = autoTranslationQueue.indexOf(job)
    if (queueIndex >= 0) autoTranslationQueue.splice(queueIndex, 1)
    queuedTranslations.delete(job.messageId)
  }
  publishQueueStats()
}

function cancelTranslationJobForMessage(
  messageId: string,
  excludeController?: TranslationController,
): void {
  const messageControllers = controllers.get(messageId)
  if (messageControllers) {
    for (const controller of messageControllers) {
      if (controller !== excludeController) {
        controller.cancel()
      }
    }
  }

  const job = queuedTranslations.get(messageId)
  if (!job) return

  for (const controller of job.targets.keys()) {
    if (controller !== excludeController) {
      controller.cancel()
    }
  }
  const queueIndex = autoTranslationQueue.indexOf(job)
  if (queueIndex >= 0) {
    autoTranslationQueue.splice(queueIndex, 1)
  }
  queuedTranslations.delete(messageId)
  publishQueueStats()
}

function cancelAllTranslationJobs(): void {
  for (const messageControllers of controllers.values()) {
    for (const controller of messageControllers) {
      controller.cancel()
    }
  }
  for (const job of queuedTranslations.values()) {
    for (const controller of job.targets.keys()) controller.cancel()
  }
}

function publishQueueStats(): void {
  let waiting = 0
  let active = 0
  const countedMessages = new Set<string>()

  for (const [messageKey, messageControllers] of controllers.entries()) {
    const hasConnectedController = Array.from(messageControllers).some((ctrl) => ctrl.isConnected())
    if (!hasConnectedController) continue

    let isMessageActive = false
    let isMessageWaiting = false
    for (const ctrl of messageControllers) {
      if (ctrl.isTranslating?.()) {
        if (ctrl.isApiStarted?.()) {
          isMessageActive = true
        } else {
          isMessageWaiting = true
        }
      } else if (ctrl.isQueued?.()) {
        isMessageWaiting = true
      }
    }

    if (isMessageActive) {
      active += 1
      countedMessages.add(messageKey)
    } else if (isMessageWaiting || queuedTranslations.has(messageKey)) {
      waiting += 1
      countedMessages.add(messageKey)
    }
  }

  for (const job of autoTranslationQueue) {
    if (!countedMessages.has(job.messageId)) {
      waiting += 1
      countedMessages.add(job.messageId)
    }
  }

  void sendMessageSafely({
    type: "update-slack-translation-stats",
    waiting,
    active,
  })
}

async function loadSettingsAndInspect(): Promise<void> {
  try {
    const response = await sendMessageSafely<PublicSettings>({ type: "get-public-settings" })
    if (response) settings = response
    setTranslationLanguage(settings.targetLanguage)
    applyTranslationVisibility(settings.showTranslations)
    if (!settings.extensionEnabled || !settings.privacyConsent) return
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
    style.textContent =
      ".slacktor-hide-translations [data-slacktor-translation] { display: none !important; }"
    document.documentElement.append(style)
  }
}

async function sendMessageSafely<T>(message: unknown): Promise<T | undefined> {
  if (isObserverTerminated || !isRuntimeAvailable()) {
    shutdownObserver()
    return undefined
  }
  try {
    return (await chrome.runtime.sendMessage(message)) as T | undefined
  } catch (error) {
    if (isContextInvalidated(error)) {
      shutdownObserver()
      return undefined
    }
    throw error
  }
}
