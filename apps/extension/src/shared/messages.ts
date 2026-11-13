import type { ProviderSettings } from "./settings"
import type { RawSlackMessage, ThreadContextPlan } from "./types"

export type PublicSettings = {
  extensionEnabled: boolean
  targetLanguage: string
  configured: boolean
  autoTranslate: boolean
  showTranslations: boolean
  privacyConsent: boolean
}

export type TranslateRequest = {
  type: "translate"
  message: RawSlackMessage
  context?: ThreadContextPlan
  forceRefresh?: boolean
  urgent?: boolean
  priority?: boolean
  requestId?: string
}
export type CancelTranslationRequest = { type: "cancel-translation"; requestId: string }

export type GetPublicSettingsRequest = {
  type: "get-public-settings"
}

export type ClearTranslationCacheRequest = {
  type: "clear-translation-cache"
}

export type ObserveMessageRequest = {
  type: "observe-message"
  message: RawSlackMessage
}
export type ObserveMessageResponse = {
  ok: boolean
  cachedTranslation?: string
}

export type GetThreadContextRequest = {
  type: "get-thread-context"
  message: RawSlackMessage
}

export type QuickTranslateRequest = {
  type: "quick-translate"
  text: string
  targetLanguage: string
}

export type ComposerTranslateRequest = {
  type: "composer-translate"
  requestId: string
  text: string
  thread?: {
    workspaceId?: string
    conversationId: string
    threadRootTs?: string
  }
}

export type GetLogsRequest = { type: "get-logs" }
export type ClearLogsRequest = { type: "clear-logs" }
export type UpdateSlackTranslationStatsRequest = {
  type: "update-slack-translation-stats"
  waiting: number
  active: number
}
export type GetSlackTranslationStatsRequest = {
  type: "get-slack-translation-stats"
  tabId?: number
}
export type GetProviderRuntimeStatusRequest = { type: "get-provider-runtime-status" }
export type TestProviderRequest = {
  type: "test-provider"
  settings: ProviderSettings
}
export type RetranslateVisibleRequest = { type: "retranslate-visible-from-popup" }
export type TerminateSlackTranslationsRequest = { type: "terminate-slack-translations" }
export type SetTranslationVisibilityRequest = {
  type: "set-translation-visibility"
  visible: boolean
}
export type SetExtensionEnabledRequest = { type: "set-extension-enabled"; enabled: boolean }
export type SimpleResponse = { ok: boolean; error?: string }

export type ExtensionRequest =
  | TranslateRequest
  | CancelTranslationRequest
  | GetPublicSettingsRequest
  | ClearTranslationCacheRequest
  | ObserveMessageRequest
  | GetThreadContextRequest
  | QuickTranslateRequest
  | ComposerTranslateRequest
  | GetLogsRequest
  | ClearLogsRequest
  | UpdateSlackTranslationStatsRequest
  | GetSlackTranslationStatsRequest
  | GetProviderRuntimeStatusRequest
  | TestProviderRequest
  | RetranslateVisibleRequest
  | TerminateSlackTranslationsRequest
  | SetTranslationVisibilityRequest
  | SetExtensionEnabledRequest

export type ContentRequest =
  | { type: "retranslate-visible"; force?: boolean }
  | { type: "terminate-slack-translations" }
  | { type: "set-translation-visibility"; visible: boolean }
  | { type: "set-extension-enabled"; enabled: boolean }
  | { type: "public-settings-changed" }
  | { type: "translation-api-started"; requestIds: string[] }

export type TranslateResponse =
  { ok: true; translation: string } | { ok: false; error: string; cancelled?: boolean }

export type QuickTranslateResponse =
  | {
      ok: true
      translation: string
      backTranslation: string
      targetLanguage: string
      backTranslationLanguage: string
    }
  | { ok: false; error: string }

export type ComposerTranslateResponse =
  | {
      ok: true
      translation: string
      backTranslation: string
      targetLanguage: string
      backTranslationLanguage: string
      /** False when the translation succeeded but could not be saved to Quick history. */
      historySaved: boolean
    }
  | { ok: false; error: string; cancelled?: boolean }
