import type { RawSlackMessage, ThreadContextPlan } from "../shared/types"
import { getProviderSettings } from "../shared/settings"
import {
  cacheTranslation,
  getCachedTranslation,
  getTranslationCacheId,
} from "./translation-cache"
import { safeEndpoint, writeLog } from "./log-store"

const MAX_ATTEMPTS = 2
const inFlightTranslations = new Map<string, Promise<string>>()

export async function translateMessage(
  message: RawSlackMessage,
  context: ThreadContextPlan = { recentMessages: [] },
  forceRefresh = false,
  signal?: AbortSignal,
  onRetryStateChange?: (retrying: boolean) => void,
): Promise<string> {
  const settings = await getProviderSettings()
  if (!settings.baseUrl || !settings.apiKey || !settings.model) {
    throw new Error("Configure the AI provider in Slacktor options first.")
  }

  if (!forceRefresh) {
    const cached = await getCachedTranslation(message, settings, context)
    if (cached) return cached
  }

  const requestId = getTranslationCacheId(message, settings, context)
  if (!forceRefresh) {
    const pending = inFlightTranslations.get(requestId)
    if (pending) return pending
  }

  const request = requestTranslation(message, context, settings, signal, onRetryStateChange)
  if (!forceRefresh) inFlightTranslations.set(requestId, request)
  try {
    return await request
  } finally {
    if (!forceRefresh) inFlightTranslations.delete(requestId)
  }
}

async function requestTranslation(
  message: RawSlackMessage,
  context: ThreadContextPlan,
  settings: Awaited<ReturnType<typeof getProviderSettings>>,
  signal?: AbortSignal,
  onRetryStateChange?: (retrying: boolean) => void,
): Promise<string> {

  const baseUrl = settings.baseUrl.replace(/\/+$/, "")
  const endpoint = baseUrl.endsWith("/chat/completions")
    ? baseUrl
    : `${baseUrl}/chat/completions`
  const payload = {
    model: settings.model,
    messages: [
      {
        role: "system",
        content: "Translate Slack messages accurately. Preserve names, URLs, code, and Slack mentions. Return only the translation.",
      },
      {
        role: "user",
        content: buildTranslationPrompt(message, context, settings.targetLanguage),
      },
    ],
    temperature: 0.2,
  }
  await writeLog({
    level: "info",
    scope: "translation",
    message: "Translation request started",
    details: { endpoint: safeEndpoint(endpoint), model: settings.model },
  })
  let response: Response
  try {
    response = await requestWithRetry(endpoint, settings.apiKey, payload, signal, onRetryStateChange)
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
    await writeLog({ level: "error", scope: "translation", message: error, details: { endpoint: safeEndpoint(endpoint), model: settings.model, status: response.status } })
    throw new Error(error)
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  const translation = data.choices?.[0]?.message?.content?.trim()
  if (!translation) throw new Error("AI provider returned no translation.")
  await cacheTranslation(message, settings, translation, context)
  await writeLog({ level: "info", scope: "translation", message: "Translation request completed", details: { endpoint: safeEndpoint(endpoint), model: settings.model, status: response.status } })
  return translation
}

async function requestWithRetry(
  endpoint: string,
  apiKey: string,
  payload: unknown,
  signal?: AbortSignal,
  onRetryStateChange?: (retrying: boolean) => void,
): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal,
      })
      if (response.ok || !isRetriableStatus(response.status) || attempt === MAX_ATTEMPTS - 1) {
        return response
      }
      onRetryStateChange?.(true)
      try {
        await delay(retryDelayMs(attempt), signal)
      } finally {
        onRetryStateChange?.(false)
      }
    } catch (error) {
      lastError = error
      if (attempt === MAX_ATTEMPTS - 1) break
      onRetryStateChange?.(true)
      try {
        await delay(retryDelayMs(attempt), signal)
      } finally {
        onRetryStateChange?.(false)
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI request failed after retries.")
}

function isRetriableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504
}

function retryDelayMs(attempt: number): number {
  return 400 * 2 ** attempt + Math.floor(Math.random() * 200)
}

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds)
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout)
      reject(new DOMException("Translation terminated.", "AbortError"))
    }, { once: true })
  })
}

function buildTranslationPrompt(
  message: RawSlackMessage,
  context: ThreadContextPlan,
  targetLanguage: string,
): string {
  if (!context.summary && context.recentMessages.length === 0) {
    return `Target language: ${targetLanguage}\n\nMessage:\n${message.sourceText}`
  }

  const thread = context.recentMessages
    .map((item) => `[${item.authorName ?? "Slack member"}]: ${item.sourceText}`)
    .join("\n")
  return [
    `Target language: ${targetLanguage}`,
    "Use the full thread context only to resolve meaning. Translate only the current message.",
    "",
    context.summary ? `Summary of older thread discussion:\n${context.summary}` : "",
    context.summary ? "" : "",
    "Recent thread messages:",
    thread,
    "",
    "Current message:",
    message.sourceText,
  ].join("\n")
}
