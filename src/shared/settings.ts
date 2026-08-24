export type ProviderSettings = {
  baseUrl: string
  apiKey: string
  model: string
  targetLanguage: string
  autoTranslate: boolean
  privacyConsent: boolean
}

const SETTINGS_KEY = "provider-settings"

export const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  baseUrl: "",
  apiKey: "",
  model: "",
  targetLanguage: "Vietnamese",
  autoTranslate: false,
  privacyConsent: false,
}

export async function getProviderSettings(): Promise<ProviderSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY)
  return { ...DEFAULT_PROVIDER_SETTINGS, ...stored[SETTINGS_KEY] }
}

export async function saveProviderSettings(settings: ProviderSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings })
}
