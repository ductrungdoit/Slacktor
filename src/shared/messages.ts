import type { RawSlackMessage, ThreadContextPlan } from "./types"

export type PublicSettings = {
  targetLanguage: string
  configured: boolean
  autoTranslate: boolean
}

export type TranslateRequest = {
  type: "translate"
  message: RawSlackMessage
  context?: ThreadContextPlan
  forceRefresh?: boolean
}

export type GetPublicSettingsRequest = {
  type: "get-public-settings"
}

export type ClearCacheAndRetranslateRequest = {
  type: "clear-cache-and-retranslate"
}

export type ObserveMessageRequest = {
  type: "observe-message"
  message: RawSlackMessage
}

export type GetThreadContextRequest = {
  type: "get-thread-context"
  message: RawSlackMessage
}

export type InspectThreadContextRequest = {
  type: "inspect-thread-context"
  url: string
}

export type ExtensionRequest =
  | TranslateRequest
  | GetPublicSettingsRequest
  | ClearCacheAndRetranslateRequest
  | ObserveMessageRequest
  | GetThreadContextRequest
  | InspectThreadContextRequest

export type ContentRequest = {
  type: "retranslate-visible"
}

export type TranslateResponse =
  | { ok: true; translation: string }
  | { ok: false; error: string }
