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
import type { ThreadContextPlan } from "../shared/types"

let settings: PublicSettings = {
  targetLanguage: "Vietnamese",
  configured: false,
  autoTranslate: false,
  privacyConsent: false,
}
let activeTranslations = 0
const MAX_CONCURRENT_TRANSLATIONS = 10
let completedTranslations = 0
let totalTranslations = 0
type QueuedTranslation = {
  controller: TranslationController
  started: boolean
}

const autoTranslationQueue: QueuedTranslation[] = []
const controllers = new Map<string, TranslationController>()

async function inspect(node: HTMLElement): Promise<void> {
  try {
    if (!settings.privacyConsent) return
    const message = extractMessage(node)
    const anchor = getTranslationAnchor(node)
    if (message && anchor) {
      // Persist in the background. Rendering and queueing must not wait for an
      // IndexedDB write when Slack initially loads a large channel.
      const persisted = sendMessageSafely({ type: "observe-message", message })
      const controller = renderPlaceholder(node, anchor, message, async () => {
        await persisted
        return await sendMessageSafely<ThreadContextPlan>({ type: "get-thread-context", message }) ?? { recentMessages: [] }
      })
      if (controller) controllers.set(message.messageId, controller)
      if (controller && settings.configured && settings.autoTranslate) {
        if (activeTranslations === 0 && autoTranslationQueue.length === 0) {
          completedTranslations = 0
          totalTranslations = 0
        }
        totalTranslations += 1
        const job: QueuedTranslation = { controller, started: false }
        autoTranslationQueue.push(job)
        controller.markQueued(() => prioritize(job))
        publishQueueStats()
        runAutoTranslationQueue()
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
  job.controller.markPrioritized()
  const index = autoTranslationQueue.indexOf(job)
  if (index > 0) {
    autoTranslationQueue.splice(index, 1)
    autoTranslationQueue.unshift(job)
  }
  publishQueueStats()
  runAutoTranslationQueue()
}

function runAutoTranslationQueue(): void {
  while (activeTranslations < MAX_CONCURRENT_TRANSLATIONS && autoTranslationQueue.length > 0) {
    const job = autoTranslationQueue.shift()
    if (!job) return

    job.started = true
    activeTranslations += 1
    publishQueueStats()
    void job.controller.run().finally(() => {
      activeTranslations = Math.max(0, activeTranslations - 1)
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
        for (const node of findMessageNodes(addedNode)) void inspect(node)
      }
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
  window.addEventListener("pagehide", () => {
    observer.disconnect()
    activeTranslations = 0
    autoTranslationQueue.length = 0
    publishQueueStats()
  }, { once: true })

  chrome.runtime.onMessage.addListener((request: ContentRequest) => {
    if (request.type === "retranslate-visible") {
      for (const node of findMessageNodes()) {
        const message = extractMessage(node)
        if (!message || !node.getBoundingClientRect().height) continue
        const controller = controllers.get(message.messageId)
        if (!controller) continue

        if (activeTranslations === 0 && autoTranslationQueue.length === 0) {
          completedTranslations = 0
          totalTranslations = 0
        }
        totalTranslations += 1
        const job: QueuedTranslation = {
          controller: {
            ...controller,
            run: controller.retranslate,
          },
          started: false,
        }
        autoTranslationQueue.push(job)
        controller.markQueued(() => prioritize(job))
      }
      publishQueueStats()
      runAutoTranslationQueue()
      return
    }

    if (request.type === "terminate-slack-translations") {
      autoTranslationQueue.length = 0
      activeTranslations = 0
      for (const controller of controllers.values()) controller.cancel()
      publishQueueStats()
    }
  })

  return observer
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
