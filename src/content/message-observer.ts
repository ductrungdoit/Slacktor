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

let settings: PublicSettings = { targetLanguage: "Vietnamese", configured: false, autoTranslate: false }
let activeTranslations = 0
const MAX_CONCURRENT_TRANSLATIONS = 8
type QueuedTranslation = {
  controller: TranslationController
  started: boolean
}

const autoTranslationQueue: QueuedTranslation[] = []
const controllers = new Map<string, TranslationController>()

async function inspect(node: HTMLElement): Promise<void> {
  try {
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
        const job: QueuedTranslation = { controller, started: false }
        autoTranslationQueue.push(job)
        controller.markQueued(() => prioritize(job))
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
  runAutoTranslationQueue()
}

function runAutoTranslationQueue(): void {
  while (activeTranslations < MAX_CONCURRENT_TRANSLATIONS && autoTranslationQueue.length > 0) {
    const job = autoTranslationQueue.shift()
    if (!job) return

    job.started = true
    activeTranslations += 1
    void job.controller.run().finally(() => {
      activeTranslations = Math.max(0, activeTranslations - 1)
      runAutoTranslationQueue()
    })
  }
}

export function startMessageObserver(): MutationObserver {
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
  window.addEventListener("pagehide", () => observer.disconnect(), { once: true })

  chrome.runtime.onMessage.addListener((request: ContentRequest) => {
    if (request.type !== "retranslate-visible") return
    for (const node of findMessageNodes()) {
      const message = extractMessage(node)
      if (!message || !node.getBoundingClientRect().height) continue
      void controllers.get(message.messageId)?.retranslate()
    }
  })

  return observer
}

async function loadSettingsAndInspect(): Promise<void> {
  try {
    const response = await sendMessageSafely<PublicSettings>({ type: "get-public-settings" })
    if (response) settings = response
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
