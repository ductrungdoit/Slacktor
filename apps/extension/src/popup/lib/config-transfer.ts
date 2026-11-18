import type { ProviderSettings } from "../../shared/settings"
import { APP_VERSION, CONFIG_SCHEMA_RESET_VERSION, isVersionAtLeast } from "../../shared/version"

export type QuickTranslatorLanguages = {
  targetLanguage: string
}

export type ExportedConfig = {
  version: string
  providerSettings: ProviderSettings
  quickTranslator: QuickTranslatorLanguages
}

export function buildConfigExport(
  providerSettings: ProviderSettings,
  quickTranslator: QuickTranslatorLanguages,
): string {
  const config: ExportedConfig = {
    version: APP_VERSION,
    providerSettings,
    quickTranslator,
  }
  return JSON.stringify(config, null, 2)
}

export function parseImportedConfig(text: string): ExportedConfig {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error("The selected content is not valid JSON.")
  }
  if (
    !isRecord(value) ||
    !hasCompatibleConfigVersion(value) ||
    !isProviderSettings(value.providerSettings) ||
    !isRecord(value.quickTranslator)
  ) {
    throw new Error("This is not a valid Slacktor configuration file.")
  }
  // Files exported by older versions also carry backTranslationLanguage. It is
  // ignored: the back translation now follows the Settings language.
  const targetLanguage = value.quickTranslator.targetLanguage
  if (typeof targetLanguage !== "string" || !targetLanguage.trim()) {
    throw new Error("Quick Translator language is invalid.")
  }
  return {
    version: typeof value.version === "string" ? value.version : APP_VERSION,
    providerSettings: value.providerSettings,
    quickTranslator: {
      targetLanguage: targetLanguage.trim(),
    },
  }
}

function hasCompatibleConfigVersion(value: Record<string, unknown>): boolean {
  if (typeof value.version === "string" && value.version.trim()) {
    return isVersionAtLeast(value.version.trim(), CONFIG_SCHEMA_RESET_VERSION)
  }
  return CONFIG_SCHEMA_RESET_VERSION === "0.2.0" && value.schemaVersion === 1
}

function isProviderSettings(value: unknown): value is ProviderSettings {
  if (!isRecord(value)) return false
  return (
    typeof value.extensionEnabled === "boolean" &&
    typeof value.baseUrl === "string" &&
    typeof value.apiKey === "string" &&
    typeof value.model === "string" &&
    typeof value.targetLanguage === "string" &&
    typeof value.customPrompt === "string" &&
    typeof value.autoTranslate === "boolean" &&
    typeof value.showTranslations === "boolean" &&
    typeof value.privacyConsent === "boolean"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
