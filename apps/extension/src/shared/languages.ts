/**
 * Languages offered by the Settings and Quick Translator selects. Values are the
 * full language names sent to the AI provider. Stored settings keep the name as a
 * plain string, so values saved or imported earlier stay valid.
 */
export enum Language {
  Japanese = "Japanese",
  English = "English",
  Vietnamese = "Vietnamese",
}

export type LanguageOption = { value: Language; label: string }

export const LANGUAGE_OPTIONS: LanguageOption[] = Object.values(Language).map((language) => ({
  value: language,
  label: language,
}))

/** BCP 47 codes, used for the HTML `lang` attribute (glyph variants, hyphenation, screen readers). */
const LANGUAGE_CODES: Record<Language, string> = {
  [Language.Japanese]: "ja",
  [Language.English]: "en",
  [Language.Vietnamese]: "vi",
}

export const DEFAULT_SETTINGS_TARGET_LANGUAGE = Language.Vietnamese
export const DEFAULT_QUICK_TARGET_LANGUAGE = Language.Japanese
/** Target language of the connection test request. It does not depend on the user's languages. */
export const PROVIDER_TEST_LANGUAGE = Language.English

export function toLanguage(name: string): Language | undefined {
  const normalized = name.trim().toLowerCase()
  return Object.values(Language).find((language) => language.toLowerCase() === normalized)
}

/** Returns the language code for a stored language name, or undefined for an unknown name. */
export function getLanguageCode(name: string): string | undefined {
  const language = toLanguage(name)
  return language ? LANGUAGE_CODES[language] : undefined
}
