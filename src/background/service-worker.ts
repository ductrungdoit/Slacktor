import { translateMessage } from "./translation-service"
import type { ExtensionRequest, PublicSettings, TranslateResponse } from "../shared/messages"
import { getProviderSettings } from "../shared/settings"
import { clearTranslationCache } from "./translation-cache"
import { buildThreadContextPlan, getThreadContext, saveContextMessage } from "./context-store"
import { inspectThreadContextByUrl } from "./context-store"
import { summarizeThread } from "./summary-service"

void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })

chrome.runtime.onMessage.addListener((request: ExtensionRequest, _sender, sendResponse) => {
  if (request.type === "get-public-settings") {
    void getProviderSettings().then((settings) => {
      const response: PublicSettings = {
        targetLanguage: settings.targetLanguage,
        configured: Boolean(settings.baseUrl && settings.apiKey && settings.model),
        autoTranslate: settings.autoTranslate,
      }
      sendResponse(response)
    })
    return true
  }

  if (request.type === "translate") {
    void translateMessage(request.message, request.context, request.forceRefresh)
      .then((translation) => sendResponse({ ok: true, translation } satisfies TranslateResponse))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Translation failed."
        sendResponse({ ok: false, error: message } satisfies TranslateResponse)
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

  if (request.type === "inspect-thread-context") {
    void inspectThreadContextByUrl(request.url).then(sendResponse)
    return true
  }

  if (request.type === "clear-cache-and-retranslate") {
    void clearTranslationCache()
      .then(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab.id && tab.url?.startsWith("https://app.slack.com/")) {
          await chrome.tabs.sendMessage(tab.id, { type: "retranslate-visible" })
        }
        sendResponse({ ok: true })
      })
      .catch(() => sendResponse({ ok: false }))
    return true
  }

  return false
})
