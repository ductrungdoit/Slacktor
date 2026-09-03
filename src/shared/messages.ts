import type { RawSlackMessage, ThreadContextPlan } from "./types"
import type { ProviderSettings } from "./settings"

export type PublicSettings = {
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

export type GetThreadContextRequest = {
  type: "get-thread-context"
  message: RawSlackMessage
}

export type QuickTranslateRequest = {
  type: "quick-translate"
  text: string
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
export type SetTranslationVisibilityRequest = { type: "set-translation-visibility"; visible: boolean }

export type ExtensionRequest =
  | TranslateRequest
  | CancelTranslationRequest
  | GetPublicSettingsRequest
  | ClearTranslationCacheRequest
  | ObserveMessageRequest
  | GetThreadContextRequest
  | QuickTranslateRequest
  | GetLogsRequest
  | ClearLogsRequest
  | UpdateSlackTranslationStatsRequest
  | GetSlackTranslationStatsRequest
  | GetProviderRuntimeStatusRequest
  | TestProviderRequest
  | RetranslateVisibleRequest
  | TerminateSlackTranslationsRequest
  | SetTranslationVisibilityRequest

export type ContentRequest =
  | { type: "retranslate-visible" }
  | { type: "terminate-slack-translations" }
  | { type: "set-translation-visibility"; visible: boolean }

export type TranslateResponse =
  | { ok: true; translation: string }
  | { ok: false; error: string }

export type QuickTranslateResponse =
  | { ok: true; japanese: string; english: string }
  | { ok: false; error: string }
