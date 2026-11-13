export type ThemeMode = "light" | "dark" | "system"

export type UiPreferences = {
  themeMode: ThemeMode
}

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  themeMode: "system",
}

// Stored apart from ProviderSettings on purpose: it is a per-browser UI choice,
// not provider configuration, and config-transfer's import validation requires
// every ProviderSettings field (adding one would reject older export files).
const UI_PREFERENCES_KEY = "ui-preferences"

// chrome.storage is async, so reading it before first paint is not possible.
// A synchronous localStorage mirror lets main.tsx apply the right class before
// React renders, avoiding a white flash when the popup opens in dark mode.
const THEME_MODE_CACHE_KEY = "slacktor-theme-mode"

const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)"

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system"
}

export function readCachedThemeMode(): ThemeMode {
  try {
    const cached = localStorage.getItem(THEME_MODE_CACHE_KEY)
    return isThemeMode(cached) ? cached : DEFAULT_UI_PREFERENCES.themeMode
  } catch {
    return DEFAULT_UI_PREFERENCES.themeMode
  }
}

export function prefersDarkScheme(): boolean {
  return window.matchMedia(DARK_SCHEME_QUERY).matches
}

export function watchSystemColorScheme(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_SCHEME_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

export function applyThemeMode(mode: ThemeMode): void {
  const dark = mode === "dark" || (mode === "system" && prefersDarkScheme())
  document.documentElement.classList.toggle("dark", dark)
}

export async function loadThemeMode(): Promise<ThemeMode> {
  const stored = await chrome.storage.local.get(UI_PREFERENCES_KEY)
  const preferences = stored[UI_PREFERENCES_KEY] as Partial<UiPreferences> | undefined
  const mode = isThemeMode(preferences?.themeMode)
    ? preferences.themeMode
    : DEFAULT_UI_PREFERENCES.themeMode
  cacheThemeMode(mode)
  return mode
}

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  const preferences: UiPreferences = { themeMode: mode }
  await chrome.storage.local.set({ [UI_PREFERENCES_KEY]: preferences })
  cacheThemeMode(mode)
}

function cacheThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_MODE_CACHE_KEY, mode)
  } catch {
    // localStorage can be unavailable (e.g. storage disabled); the async
    // chrome.storage value still applies once loaded.
  }
}
