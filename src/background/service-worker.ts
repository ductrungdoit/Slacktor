import { translateMessage } from "./translation-service"
import type { ContentRequest, ExtensionRequest, PublicSettings, TranslateResponse } from "../shared/messages"
import { getProviderSettings } from "../shared/settings"
import { clearTranslationCache } from "./translation-cache"
import { buildThreadContextPlan, getThreadContext, saveContextMessage } from "./context-store"
import { summarizeThread } from "./summary-service"
import { quickTranslate, testProvider } from "./quick-translation-service"
import type { QuickTranslateResponse } from "../shared/messages"
import { clearLogs, getLogs } from "./log-store"

type SlackTranslationStats = {
  waiting: number
  active: number
  concurrency: number
  retrying: number
  completed: number
  total: number
}
const slackTranslationStats = new Map<number, SlackTranslationStats>()
const activeTranslationRequests = new Map<number, Set<AbortController>>()
type ProviderRuntimeStatus = {
  state: "unconfigured" | "ready" | "error"
  message: string
}
let providerRuntimeStatus: ProviderRuntimeStatus = {
  state: "unconfigured",
  message: "Provider is not configured",
}

void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })

chrome.runtime.onMessage.addListener((request: ExtensionRequest, _sender, sendResponse) => {
  if (request.type === "get-public-settings") {
    void getProviderSettings().then((settings) => {
      const response: PublicSettings = {
        targetLanguage: settings.targetLanguage,
        configured: Boolean(settings.baseUrl && settings.apiKey && settings.model),
        autoTranslate: settings.autoTranslate,
        privacyConsent: settings.privacyConsent,
      }
      if (!response.configured) {
        providerRuntimeStatus = { state: "unconfigured", message: "Provider is not configured" }
      } else if (providerRuntimeStatus.state === "unconfigured") {
        providerRuntimeStatus = { state: "ready", message: "Provider configured" }
      }
      sendResponse(response)
    })
    return true
  }

  if (request.type === "translate") {
    const tabId = _sender.tab?.id
    const controller = new AbortController()
    if (tabId !== undefined) {
      const controllers = activeTranslationRequests.get(tabId) ?? new Set<AbortController>()
      controllers.add(controller)
      activeTranslationRequests.set(tabId, controllers)
    }
    void translateMessage(
      request.message,
      request.context,
      request.forceRefresh,
      controller.signal,
      (retrying) => {
        if (tabId === undefined) return
        const stats = slackTranslationStats.get(tabId) ?? {
          waiting: 0,
          active: 0,
          concurrency: 10,
          retrying: 0,
          completed: 0,
          total: 0,
        }
        stats.retrying = Math.max(0, stats.retrying + (retrying ? 1 : -1))
        slackTranslationStats.set(tabId, stats)
      },
    )
      .then((translation) => {
        providerRuntimeStatus = { state: "ready", message: "Provider configured and responding" }
        sendResponse({ ok: true, translation } satisfies TranslateResponse)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Translation failed."
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          providerRuntimeStatus = { state: "error", message: conciseStatusMessage(message) }
        }
        sendResponse({ ok: false, error: message } satisfies TranslateResponse)
      })
      .finally(() => {
        if (tabId === undefined) return
        activeTranslationRequests.get(tabId)?.delete(controller)
      })
    return true
  }

  if (request.type === "observe-message") {
    void saveContextMessage(request.message).then(() => sendResponse({ ok: true }))
    return true
  }

  if (request.type === "get-thread-context") {
    void buildThreadContextPlan(request.message, summarizeThread)
      .then((context) => sendResponse(context))
      .catch(() => sendResponse({ recentMessages: [] }))
    return true
  }

  if (request.type === "quick-translate") {
    void quickTranslate(request.text)
      .then((result) => {
        providerRuntimeStatus = { state: "ready", message: "Provider configured and responding" }
        sendResponse({ ok: true, ...result } satisfies QuickTranslateResponse)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Quick translation failed."
        providerRuntimeStatus = { state: "error", message: conciseStatusMessage(message) }
        sendResponse({ ok: false, error: message } satisfies QuickTranslateResponse)
      })
    return true
  }

  if (request.type === "get-logs") {
    void getLogs().then(sendResponse)
    return true
  }

  if (request.type === "clear-logs") {
    void clearLogs().then(() => sendResponse({ ok: true }))
    return true
  }

  if (request.type === "update-slack-translation-stats") {
    if (_sender.tab?.id !== undefined) {
      slackTranslationStats.set(_sender.tab.id, {
        waiting: request.waiting,
        active: request.active,
        concurrency: request.concurrency,
        retrying: slackTranslationStats.get(_sender.tab.id)?.retrying ?? 0,
        completed: request.completed,
        total: request.total,
      })
      void updateActionBadge()
    }
    sendResponse({ ok: true })
    return false
  }

  if (request.type === "get-slack-translation-stats") {
    const stats = request.tabId === undefined
      ? undefined
      : slackTranslationStats.get(request.tabId)
    sendResponse(stats ?? {
      waiting: 0,
      active: 0,
      concurrency: 10,
      retrying: 0,
      completed: 0,
      total: 0,
    })
    return false
  }

  if (request.type === "get-provider-runtime-status") {
    void getProviderSettings().then((settings) => {
      const configured = Boolean(settings.baseUrl && settings.apiKey && settings.model)
      if (!configured) sendResponse({ state: "unconfigured", message: "Provider is not configured" })
      else sendResponse(providerRuntimeStatus.state === "unconfigured"
        ? { state: "ready", message: "Provider configured" }
        : providerRuntimeStatus)
    })
    return true
  }

  if (request.type === "test-provider") {
    void testProvider(request.settings)
      .then(() => {
        providerRuntimeStatus = { state: "ready", message: "Provider test succeeded" }
        sendResponse({ ok: true })
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Provider test failed."
        providerRuntimeStatus = { state: "error", message: conciseStatusMessage(message) }
        sendResponse({ ok: false, error: message })
      })
    return true
  }

  if (request.type === "retranslate-visible-from-popup") {
    void sendToActiveSlackTab({ type: "retranslate-visible" })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }

  if (request.type === "terminate-slack-translations") {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (!tab?.id || !tab.url?.startsWith("https://app.slack.com/")) throw new Error("No active Slack tab.")
      await chrome.tabs.sendMessage(tab.id, { type: "terminate-slack-translations" })
      sendResponse({ ok: true })
    }).catch(() => sendResponse({ ok: false }))
    return true
  }

  if (request.type === "clear-translation-cache") {
    void clearTranslationCache()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }

  return false
})

async function sendToActiveSlackTab(message: ContentRequest): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url?.startsWith("https://app.slack.com/")) throw new Error("No active Slack tab.")
  await chrome.tabs.sendMessage(tab.id, message)
}

async function updateActionBadge(): Promise<void> {
  let total = 0
  for (const stats of slackTranslationStats.values()) {
    total += stats.waiting + stats.active
  }

  await chrome.action.setBadgeBackgroundColor({ color: "#4a154b" })
  await chrome.action.setBadgeText({ text: total > 0 ? (total > 99 ? "99+" : String(total)) : "" })
  await chrome.action.setTitle({
    title: total > 0 ? `Slacktor - ${total} Slack translations active or waiting` : "Slacktor",
  })
}

chrome.tabs.onRemoved.addListener((tabId) => {
  slackTranslationStats.delete(tabId)
  activeTranslationRequests.delete(tabId)
  void updateActionBadge()
})

function conciseStatusMessage(message: string): string {
  return message.replace(/\s+/g, " ").trim().slice(0, 160) || "Provider request failed"
}
