import { DEFAULT_QUICK_TARGET_LANGUAGE } from "../shared/languages"
import type { ComposerTranslateRequest } from "../shared/messages"
import { QUICK_UI_KEY } from "../shared/quick-history"
import { getProviderSettings } from "../shared/settings"
import type { RawSlackMessage, ThreadContextPlan } from "../shared/types"
import { buildThreadContextPlan } from "./context-store"
import { writeLog } from "./log-store"
import { appendQuickHistory } from "./quick-history-store"
import { quickTranslate } from "./quick-translation-service"
import { summarizeThread } from "./summary-service"

export type ComposerTranslateResult = {
  translation: string
  backTranslation: string
  targetLanguage: string
  backTranslationLanguage: string
  historySaved: boolean
}

export async function composerTranslate(
  request: ComposerTranslateRequest,
  signal: AbortSignal,
): Promise<ComposerTranslateResult> {
  const settings = await getProviderSettings()
  if (!settings.extensionEnabled) throw new Error("Slacktor is disabled.")
  if (!settings.privacyConsent) {
    throw new Error("Accept the privacy notice in the Slacktor popup first.")
  }
  const text = request.text.trim()
  if (!text) throw new Error("Write a message first.")

  const targetLanguage = await getQuickTargetLanguage()
  const context = request.thread
    ? await loadThreadContext(request.thread, targetLanguage)
    : undefined
  const result = await quickTranslate(text, targetLanguage, { context, signal })

  let historySaved = true
  try {
    await appendQuickHistory({
      source: text,
      translation: result.translation,
      backTranslation: result.backTranslation,
      targetLanguage: result.targetLanguage,
      backTranslationLanguage: result.backTranslationLanguage,
    })
  } catch (error) {
    historySaved = false
    // The translation is still valid. Never log message text.
    await writeLog({
      level: "error",
      scope: "quick-translation",
      message: error instanceof Error ? error.message : "Could not save Quick history",
    })
  }

  return {
    translation: result.translation,
    backTranslation: result.backTranslation,
    targetLanguage: result.targetLanguage,
    backTranslationLanguage: result.backTranslationLanguage,
    historySaved,
  }
}

async function getQuickTargetLanguage(): Promise<string> {
  const stored = await chrome.storage.local.get(QUICK_UI_KEY)
  const language = stored[QUICK_UI_KEY]?.targetLanguage
  return typeof language === "string" && language.trim()
    ? language.trim()
    : DEFAULT_QUICK_TARGET_LANGUAGE
}

async function loadThreadContext(
  thread: NonNullable<ComposerTranslateRequest["thread"]>,
  targetLanguage: string,
): Promise<ThreadContextPlan | undefined> {
  // A synthetic target lets the context store return the causal window of
  // the thread or channel. Context is best effort: a storage error must not
  // fail the translation.
  const target: RawSlackMessage = {
    workspaceId: thread.workspaceId,
    conversationId: thread.conversationId,
    threadRootTs: thread.threadRootTs,
    messageId: "slacktor-composer-draft",
    timestamp: (Date.now() / 1000).toFixed(6),
    messageKind: thread.threadRootTs ? "thread-reply" : "channel",
    author: { status: "unknown", reason: "not-present-in-dom" },
    sourceText: "",
    isBot: false,
    isSystemMessage: false,
    isDirectMessage: false,
  }
  try {
    return await buildThreadContextPlan(target, summarizeThread, targetLanguage)
  } catch {
    return undefined
  }
}
