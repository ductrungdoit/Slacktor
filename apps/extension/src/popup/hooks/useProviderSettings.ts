import { useCallback, useEffect, useState } from "react"

import {
  DEFAULT_PROVIDER_SETTINGS,
  getProviderSettings,
  type ProviderSettings,
  saveProviderSettings,
} from "../../shared/settings"
import { sendExtensionMessage } from "../lib/messaging"
import { requestProviderPermission } from "../lib/permissions"

function hasProviderConnection(settings: ProviderSettings): boolean {
  return Boolean(settings.baseUrl.trim() && settings.model.trim() && settings.apiKey.trim())
}

export function useProviderSettings() {
  const [draft, setDraft] = useState<ProviderSettings>(DEFAULT_PROVIDER_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [savedConfigured, setSavedConfigured] = useState(false)
  // Language last persisted in Settings. Unlike draft.targetLanguage it ignores
  // unsaved form edits, so the Quick tab reflects what the background uses.
  const [savedTargetLanguage, setSavedTargetLanguage] = useState(
    DEFAULT_PROVIDER_SETTINGS.targetLanguage,
  )

  useEffect(() => {
    void getProviderSettings().then((settings) => {
      setDraft(settings)
      setSavedConfigured(hasProviderConnection(settings))
      setSavedTargetLanguage(settings.targetLanguage)
      setLoaded(true)
    })
  }, [])

  const updateDraft = useCallback((patch: Partial<ProviderSettings>) => {
    setDraft((current) => ({ ...current, ...patch }))
  }, [])

  /** Saves the provider draft: endpoint, model, API key, target language and
   * custom prompt. Requests the AI endpoint host permission first. */
  const save = useCallback(async (): Promise<ProviderSettings> => {
    const next = { ...draft }
    next.baseUrl = next.baseUrl.trim()
    next.apiKey = next.apiKey.trim()
    next.model = next.model.trim()
    next.targetLanguage = next.targetLanguage.trim()
    next.customPrompt = next.customPrompt.trim()
    if (!next.baseUrl || !next.apiKey || !next.model || !next.targetLanguage) {
      throw new Error("Enter endpoint, model, API key, and target language first.")
    }
    await requestProviderPermission(next.baseUrl)
    await saveProviderSettings(next)
    setDraft(next)
    setSavedConfigured(true)
    setSavedTargetLanguage(next.targetLanguage)
    await sendExtensionMessage({ type: "set-extension-enabled", enabled: next.extensionEnabled })
    return next
  }, [draft])

  const testProvider = useCallback(async (): Promise<void> => {
    const next = {
      ...draft,
      baseUrl: draft.baseUrl.trim(),
      apiKey: draft.apiKey.trim(),
      model: draft.model.trim(),
    }
    await requestProviderPermission(next.baseUrl)
    const response = await sendExtensionMessage<{ ok: boolean; error?: string }>({
      type: "test-provider",
      settings: next,
    })
    if (!response?.ok) throw new Error(response?.error ?? "Provider test failed.")
    await saveProviderSettings(next)
    setDraft(next)
    setSavedConfigured(hasProviderConnection(next))
    setSavedTargetLanguage(next.targetLanguage)
  }, [draft])

  /** Persists immediately and notifies the background so open Slack tabs react
   * without waiting for the "Save configuration" submit. */
  const setExtensionEnabled = useCallback(async (enabled: boolean): Promise<void> => {
    const current = await getProviderSettings()
    const next = { ...current, extensionEnabled: enabled }
    await saveProviderSettings(next)
    setDraft((draftState) => ({ ...draftState, extensionEnabled: enabled }))
    await sendExtensionMessage({ type: "set-extension-enabled", enabled })
  }, [])

  const setShowTranslations = useCallback(async (visible: boolean): Promise<void> => {
    const current = await getProviderSettings()
    const next = { ...current, showTranslations: visible }
    await saveProviderSettings(next)
    setDraft((draftState) => ({ ...draftState, showTranslations: visible }))
    await sendExtensionMessage({ type: "set-translation-visibility", visible })
  }, [])

  /** Persists immediately. The background watches storage and tells open Slack
   * tabs to reload their public settings. */
  const setAutoTranslate = useCallback(async (enabled: boolean): Promise<void> => {
    const current = await getProviderSettings()
    await saveProviderSettings({ ...current, autoTranslate: enabled })
    setDraft((draftState) => ({ ...draftState, autoTranslate: enabled }))
  }, [])

  const acceptPrivacyConsent = useCallback(async (): Promise<void> => {
    const current = await getProviderSettings()
    const next = { ...current, privacyConsent: true }
    await saveProviderSettings(next)
    setDraft((draftState) => ({ ...draftState, privacyConsent: true }))
  }, [])

  const clearTranslationCache = useCallback(async (): Promise<void> => {
    const response = await sendExtensionMessage<{ ok: boolean }>({
      type: "clear-translation-cache",
    })
    if (!response?.ok) throw new Error("Could not clear the translation cache.")
  }, [])

  const importSettings = useCallback(async (next: ProviderSettings): Promise<void> => {
    if (next.baseUrl) await requestProviderPermission(next.baseUrl)
    await saveProviderSettings(next)
    setDraft(next)
    setSavedConfigured(hasProviderConnection(next))
    setSavedTargetLanguage(next.targetLanguage)
    await sendExtensionMessage({ type: "set-extension-enabled", enabled: next.extensionEnabled })
    await sendExtensionMessage({
      type: "set-translation-visibility",
      visible: next.showTranslations,
    })
  }, [])

  const configured = hasProviderConnection(draft)

  return {
    draft,
    loaded,
    configured,
    savedConfigured,
    savedTargetLanguage,
    updateDraft,
    save,
    testProvider,
    setExtensionEnabled,
    setShowTranslations,
    setAutoTranslate,
    acceptPrivacyConsent,
    clearTranslationCache,
    importSettings,
  }
}
