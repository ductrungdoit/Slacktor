import { PROVIDER_TEST_LANGUAGE } from "../shared/languages"
import { getProviderSettings, type ProviderSettings } from "../shared/settings"
import type { ThreadContextPlan } from "../shared/types"
import { safeEndpoint, writeLog } from "./log-store"
import { providerRequest } from "./provider-request"
import { sanitizeContextText } from "./translation-service"

const MAX_CONTEXT_MESSAGES = 5

type QuickTranslateOptions = {
  /** Thread context. Used for the forward translation only. */
  context?: ThreadContextPlan
  signal?: AbortSignal
}

export type QuickTranslateResult = {
  translation: string
  backTranslation: string
  targetLanguage: string
  backTranslationLanguage: string
}

// The back translation always uses the Translate to language saved in
// Settings: it is the language the user reads, and Slack overlays reuse it.
export async function quickTranslate(
  text: string,
  targetLanguage: string,
  options: QuickTranslateOptions = {},
): Promise<QuickTranslateResult> {
  const settings = await getProviderSettings()
  if (!settings.baseUrl || !settings.apiKey || !settings.model) {
    throw new Error("Configure the AI provider first.")
  }
  const target = targetLanguage.trim()
  const backTranslationLanguage = settings.targetLanguage.trim()
  if (!target || !backTranslationLanguage) {
    throw new Error("Enter the Quick Translator language and the Settings language.")
  }
  if (target.toLowerCase() === backTranslationLanguage.toLowerCase()) {
    throw new Error("Choose a Translate to language different from your Settings language.")
  }

  const hasContext = Boolean(options.context?.recentMessages.length || options.context?.summary)
  const translation = await translate(text, target, settings, {
    context: options.context,
    signal: options.signal,
    hasContext,
  })
  const backTranslation = await translate(translation, backTranslationLanguage, settings, {
    signal: options.signal,
    hasContext: false,
  })
  return { translation, backTranslation, targetLanguage: target, backTranslationLanguage }
}

export async function testProvider(settings: ProviderSettings): Promise<void> {
  if (!settings.baseUrl || !settings.apiKey || !settings.model) {
    throw new Error("Configure endpoint, model, and API key first.")
  }
  await translate("Reply with exactly OK.", PROVIDER_TEST_LANGUAGE, settings, {
    hasContext: false,
  })
}

function formatContextLine(message: ThreadContextPlan["recentMessages"][number]): string {
  const base = `${message.authorName ?? "Member"}: ${sanitizeContextText(message.sourceText)}`
  if (message.translatedText) {
    return `${base}\n  -> Translation: ${sanitizeContextText(message.translatedText)}`
  }
  return base
}

function buildUserPrompt(text: string, targetLanguage: string, context?: ThreadContextPlan) {
  const recentMessages = context?.recentMessages ?? []
  const slicedRecent = recentMessages.slice(-MAX_CONTEXT_MESSAGES)
  const rootMessage =
    context?.rootMessage &&
    !slicedRecent.some((item) => item.messageId === context.rootMessage?.messageId)
      ? context.rootMessage
      : undefined
  const bridge = (context?.channelBridgeMessages ?? []).map(formatContextLine).join("\n")
  const recent = [
    ...(rootMessage ? [formatContextLine(rootMessage)] : []),
    ...slicedRecent.map(formatContextLine),
  ].join("\n")

  const parts = [`Target language: ${targetLanguage}`]
  if (context?.summary) {
    parts.push(
      `Earlier conversation summary (for reference only, do not translate):\n${context.summary}`,
    )
  }
  if (bridge) {
    parts.push(
      `Preceding channel messages leading into this thread (for reference only, do not translate):\n${bridge}`,
    )
  }
  if (recent) {
    parts.push(`Previous context (for reference only, do not translate):\n${recent}`)
  }
  parts.push(`Text:\n${text}`)
  return parts.join("\n\n")
}

async function translate(
  text: string,
  targetLanguage: string,
  settings: Awaited<ReturnType<typeof getProviderSettings>>,
  options: { context?: ThreadContextPlan; signal?: AbortSignal; hasContext: boolean },
): Promise<string> {
  const baseUrl = settings.baseUrl.replace(/\/+$/, "")
  const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`
  const payload = {
    model: settings.model,
    messages: [
      {
        role: "system",
        content:
          "Translate the provided text accurately. Preserve its original vibe, intent, emotional tone, names, URLs, and formatting. For code blocks and inline code, translate natural human language inside them while keeping actual programming code untranslated. Make the wording naturally polite in the target language without changing the meaning or intensity. Return only the translation.",
      },
      {
        role: "user",
        content: buildUserPrompt(text, targetLanguage, options.context),
      },
    ],
    temperature: 0.2,
  }
  let response: Response
  try {
    response = await providerRequest(endpoint, settings.apiKey, payload, {
      signal: options.signal,
    })
  } catch (error) {
    if (!options.signal?.aborted) {
      await writeLog({
        level: "error",
        scope: "quick-translation",
        message:
          error instanceof Error ? error.message : "Quick translation network request failed",
        details: {
          endpoint: safeEndpoint(endpoint),
          model: settings.model,
          targetLanguage,
          hasContext: options.hasContext,
        },
      })
    }
    throw error
  }

  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 240)
    const error = `AI request failed (${response.status})${detail ? `: ${detail}` : ""}`
    await writeLog({
      level: "error",
      scope: "quick-translation",
      message: error,
      details: {
        endpoint: safeEndpoint(endpoint),
        model: settings.model,
        targetLanguage,
        status: response.status,
        hasContext: options.hasContext,
      },
    })
    throw new Error(error)
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const translation = data.choices?.[0]?.message?.content?.trim()
  if (!translation) throw new Error(`AI provider returned no ${targetLanguage} translation.`)
  await writeLog({
    level: "info",
    scope: "quick-translation",
    message: "Quick translation step completed",
    details: {
      endpoint: safeEndpoint(endpoint),
      model: settings.model,
      targetLanguage,
      status: response.status,
      hasContext: options.hasContext,
    },
  })
  return translation
}
