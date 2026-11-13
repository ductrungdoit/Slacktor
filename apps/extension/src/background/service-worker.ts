import type {
  ComposerTranslateResponse,
  ContentRequest,
  ExtensionRequest,
  PublicSettings,
  SimpleResponse,
  TranslateResponse,
} from "../shared/messages"
import type { QuickTranslateResponse } from "../shared/messages"
import { getProviderSettings, type ProviderSettings } from "../shared/settings"
import { composerTranslate } from "./composer-translation-service"
import { buildThreadContextPlan, saveContextMessage } from "./context-store"
import { clearLogs, getLogs, writeLog } from "./log-store"
import { quickTranslate, testProvider } from "./quick-translation-service"
import { summarizeThread } from "./summary-service"
import {
  checkAndMigrateTranslationCache,
  clearTranslationCache,
  getCachedTranslation,
} from "./translation-cache"
import { translateMessage } from "./translation-service"
import { getDailyUsageStats } from "./usage-stats"

type SlackTranslationStats = {
  waiting: number
  active: number
  retrying: number
}
const slackTranslationStats = new Map<number, SlackTranslationStats>()
const activeTranslationRequests = new Map<number, Set<AbortController>>()
const translationRequestsById = new Map<string, AbortController>()
const pendingApiStartedByTab = new Map<number, Set<string>>()

function notifyTabTranslationApiStarted(
  tabId: number | undefined,
  requestId: string | undefined,
): void {
  if (tabId === undefined || !requestId) return
  let requestIds = pendingApiStartedByTab.get(tabId)
  if (!requestIds) {
    requestIds = new Set<string>()
    pendingApiStartedByTab.set(tabId, requestIds)
    queueMicrotask(() => {
      const ids = Array.from(pendingApiStartedByTab.get(tabId) ?? [])
      pendingApiStartedByTab.delete(tabId)
      if (ids.length > 0 && typeof chrome.tabs?.sendMessage === "function") {
        void chrome.tabs
          .sendMessage(tabId, {
            type: "translation-api-started",
            requestIds: ids,
          } satisfies ContentRequest)
          .catch(() => undefined)
      }
    })
  }
  requestIds.add(requestId)
}
type ProviderRuntimeStatus = {
  state: "unconfigured" | "ready" | "error"
  message: string
}
let providerRuntimeStatus: ProviderRuntimeStatus = {
  state: "unconfigured",
  message: "Provider is not configured",
}

void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })
void updateActionBadge()

async function broadcastToSlackTabs(message: ContentRequest): Promise<void> {
  const tabs = await chrome.tabs.query({ url: "https://app.slack.com/*" })
  await Promise.all(
    tabs.flatMap((tab) =>
      tab.id === undefined || typeof chrome.tabs.sendMessage !== "function"
        ? []
        : [chrome.tabs.sendMessage(tab.id, message).catch(() => undefined)],
    ),
  )
}

void checkAndMigrateTranslationCache().then(
  async ({ cacheCleared, contextCleared, summariesCleared, isVersionUpgrade }) => {
    if (cacheCleared || contextCleared || summariesCleared) {
      await writeLog({
        level: "info",
        scope: "background",
        message: "Extension stores reset for version milestone",
      })
    }
    if (cacheCleared || isVersionUpgrade) {
      await broadcastToSlackTabs({ type: "retranslate-visible", force: true })
    }
  },
)

chrome.runtime.onInstalled.addListener(() => {
  void checkAndMigrateTranslationCache().then(async ({ cacheCleared, isVersionUpgrade }) => {
    if (cacheCleared || isVersionUpgrade) {
      await broadcastToSlackTabs({ type: "retranslate-visible", force: true })
    }
  })
})

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return
  if (changes["provider-settings"]) {
    const oldSettings = changes["provider-settings"].oldValue as ProviderSettings | undefined
    const newSettings = changes["provider-settings"].newValue as ProviderSettings | undefined
    if (oldSettings && newSettings && oldSettings.targetLanguage !== newSettings.targetLanguage) {
      void broadcastToSlackTabs({ type: "retranslate-visible", force: true })
    }
    if (oldSettings && newSettings && oldSettings.autoTranslate !== newSettings.autoTranslate) {
      void broadcastToSlackTabs({ type: "public-settings-changed" })
    }
  }
})

chrome.runtime.onMessage.addListener((request: ExtensionRequest, _sender, sendResponse) => {
  if (request.type === "get-public-settings") {
    void getProviderSettings().then((settings) => {
      const response: PublicSettings = {
        extensionEnabled: settings.extensionEnabled,
        targetLanguage: settings.targetLanguage,
        configured: Boolean(settings.baseUrl && settings.apiKey && settings.model),
        autoTranslate: settings.autoTranslate,
        showTranslations: settings.showTranslations,
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
    void getProviderSettings()
      .then((settings) => {
        if (!settings.extensionEnabled)
          throw new DOMException("Slacktor is disabled.", "AbortError")
        return translateMessage(
          request.message,
          request.context,
          request.forceRefresh,
          controller.signal,
          (retrying) => {
            if (tabId === undefined) return
            const stats = slackTranslationStats.get(tabId) ?? {
              waiting: 0,
              active: 0,
              retrying: 0,
            }
            stats.retrying = Math.max(0, stats.retrying + (retrying ? 1 : -1))
            slackTranslationStats.set(tabId, stats)
          },
          request.urgent,
          request.priority,
          () => {
            notifyTabTranslationApiStarted(tabId, request.requestId)
          },
        )
      })
      .then((translation) => {
        providerRuntimeStatus = { state: "ready", message: "Provider configured and responding" }
        sendResponse({ ok: true, translation } satisfies TranslateResponse)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Translation failed."
        const cancelled = isAbortError(error)
        if (!cancelled) {
          providerRuntimeStatus = { state: "error", message: conciseStatusMessage(message) }
        }
        sendResponse({ ok: false, error: message, cancelled } satisfies TranslateResponse)
      })
      .finally(() => {
        if (tabId === undefined) return
        activeTranslationRequests.get(tabId)?.delete(controller)
        if (request.requestId) translationRequestsById.delete(request.requestId)
      })
    if (request.requestId) translationRequestsById.set(request.requestId, controller)
    return true
  }

  if (request.type === "cancel-translation") {
    translationRequestsById
      .get(request.requestId)
      ?.abort(new DOMException("Translation no longer visible.", "AbortError"))
    translationRequestsById.delete(request.requestId)
    sendResponse({ ok: true })
    return false
  }

  if (request.type === "observe-message") {
    void getProviderSettings()
      .then(async (settings) => {
        if (!settings.extensionEnabled) return { ok: true }
        const cachedTranslation = await getCachedTranslation(request.message, settings).catch(
          () => undefined,
        )
        await saveContextMessage(
          request.message,
          cachedTranslation
            ? { translation: cachedTranslation, targetLanguage: settings.targetLanguage }
            : undefined,
        ).catch(() => undefined)
        return { ok: true, cachedTranslation }
      })
      .then((response) => sendResponse(response ?? { ok: true }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }

  if (request.type === "get-thread-context") {
    void getProviderSettings()
      .then((settings) =>
        settings.extensionEnabled
          ? buildThreadContextPlan(request.message, summarizeThread, settings.targetLanguage)
          : { recentMessages: [] },
      )
      .then((context) => sendResponse(context))
      .catch(() => sendResponse({ recentMessages: [] }))
    return true
  }

  if (request.type === "quick-translate") {
    void getProviderSettings()
      .then((settings) => {
        if (!settings.extensionEnabled) throw new Error("Slacktor is disabled.")
        return quickTranslate(request.text, request.targetLanguage)
      })
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

  if (request.type === "composer-translate") {
    const tabId = _sender.tab?.id
    const controller = new AbortController()
    if (tabId !== undefined) {
      const controllers = activeTranslationRequests.get(tabId) ?? new Set<AbortController>()
      controllers.add(controller)
      activeTranslationRequests.set(tabId, controllers)
    }
    translationRequestsById.set(request.requestId, controller)
    void composerTranslate(request, controller.signal)
      .then((result) => {
        providerRuntimeStatus = { state: "ready", message: "Provider configured and responding" }
        sendResponse({ ok: true, ...result } satisfies ComposerTranslateResponse)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Translation failed."
        const cancelled = isAbortError(error)
        if (!cancelled) {
          providerRuntimeStatus = { state: "error", message: conciseStatusMessage(message) }
        }
        sendResponse({ ok: false, error: message, cancelled } satisfies ComposerTranslateResponse)
      })
      .finally(() => {
        if (tabId !== undefined) activeTranslationRequests.get(tabId)?.delete(controller)
        if (translationRequestsById.get(request.requestId) === controller) {
          translationRequestsById.delete(request.requestId)
        }
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
        retrying: slackTranslationStats.get(_sender.tab.id)?.retrying ?? 0,
      })
      void updateActionBadge()
    }
    sendResponse({ ok: true })
    return false
  }

  if (request.type === "get-slack-translation-stats") {
    const stats = request.tabId === undefined ? undefined : slackTranslationStats.get(request.tabId)
    void getDailyUsageStats().then((usage) =>
      sendResponse({
        waiting: stats?.waiting ?? 0,
        active: stats?.active ?? 0,
        retrying: stats?.retrying ?? 0,
        translatedToday: usage.translatedMessages,
        requestsToday: usage.llmRequests,
      }),
    )
    return true
  }

  if (request.type === "get-provider-runtime-status") {
    void getProviderSettings().then((settings) => {
      const configured = Boolean(settings.baseUrl && settings.apiKey && settings.model)
      if (!configured)
        sendResponse({ state: "unconfigured", message: "Provider is not configured" })
      else
        sendResponse(
          providerRuntimeStatus.state === "unconfigured"
            ? { state: "ready", message: "Provider configured" }
            : providerRuntimeStatus,
        )
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
    void sendToActiveSlackTab<{ ok: boolean; queued: number }>({
      type: "retranslate-visible",
      force: true,
    })
      .then((response) => sendResponse(response))
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Could not reach a Slack tab.",
        } satisfies SimpleResponse),
      )
    return true
  }

  if (request.type === "terminate-slack-translations") {
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(async ([tab]) => {
        if (!tab?.id || !tab.url?.startsWith("https://app.slack.com/"))
          throw new Error("No active Slack tab.")
        await chrome.tabs.sendMessage(tab.id, { type: "terminate-slack-translations" })
        sendResponse({ ok: true })
      })
      .catch(() => sendResponse({ ok: false }))
    return true
  }

  if (request.type === "set-translation-visibility") {
    void broadcastToSlackTabs(request)
      .then(async () => {
        await updateActionBadge(request.visible)
        sendResponse({ ok: true })
      })
      .catch(() => sendResponse({ ok: false }))
    return true
  }

  if (request.type === "set-extension-enabled") {
    if (!request.enabled) {
      for (const controllers of activeTranslationRequests.values()) {
        for (const controller of controllers)
          controller.abort(new DOMException("Slacktor is disabled.", "AbortError"))
      }
      translationRequestsById.clear()
      slackTranslationStats.clear()
      pendingApiStartedByTab.clear()
    }
    void broadcastToSlackTabs(request)
      .then(async () => {
        await updateActionBadge(undefined, request.enabled)
        sendResponse({ ok: true })
      })
      .catch(() => sendResponse({ ok: false }))
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

async function sendToActiveSlackTab<T>(message: ContentRequest): Promise<T> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url?.startsWith("https://app.slack.com/"))
    throw new Error("No active Slack tab.")
  return (await chrome.tabs.sendMessage(tab.id, message)) as T
}

async function updateActionBadge(
  showTranslations?: boolean,
  extensionEnabled?: boolean,
): Promise<void> {
  let total = 0
  for (const stats of slackTranslationStats.values()) {
    total += stats.waiting + stats.active
  }

  const settings = await getProviderSettings()
  const enabled = extensionEnabled ?? settings.extensionEnabled
  const translationsVisible = showTranslations ?? settings.showTranslations
  const disabled = (!enabled || !translationsVisible) && total === 0
  await chrome.action.setBadgeBackgroundColor({ color: disabled ? "#616061" : "#7b2fd0" })
  await chrome.action.setBadgeText({
    text: total > 0 ? (total > 99 ? "99+" : String(total)) : disabled ? "−" : "",
  })
  await chrome.action.setTitle({
    title:
      total > 0
        ? `Slacktor - ${total} Slack translations active or waiting`
        : !enabled
          ? "Slacktor - extension disabled"
          : disabled
            ? "Slacktor - translations hidden"
            : "Slacktor",
  })
}

chrome.tabs.onRemoved.addListener((tabId) => {
  slackTranslationStats.delete(tabId)
  pendingApiStartedByTab.delete(tabId)
  for (const controller of activeTranslationRequests.get(tabId) ?? []) controller.abort()
  activeTranslationRequests.delete(tabId)
  void updateActionBadge()
})

function conciseStatusMessage(message: string): string {
  return message.replace(/\s+/g, " ").trim().slice(0, 160) || "Provider request failed"
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}
