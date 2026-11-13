import { useCallback, useEffect, useState } from "react"

import {
  applyThemeMode,
  loadThemeMode,
  readCachedThemeMode,
  saveThemeMode,
  type ThemeMode,
  watchSystemColorScheme,
} from "../lib/theme-mode"

export function useThemeMode() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(readCachedThemeMode)

  const setThemeMode = useCallback(async (mode: ThemeMode): Promise<void> => {
    setThemeModeState(mode)
    applyThemeMode(mode)
    await saveThemeMode(mode)
  }, [])

  useEffect(() => {
    void loadThemeMode().then((mode) => {
      setThemeModeState(mode)
      applyThemeMode(mode)
    })
  }, [])

  useEffect(() => {
    if (themeMode !== "system") return
    return watchSystemColorScheme(() => applyThemeMode("system"))
  }, [themeMode])

  return { themeMode, setThemeMode }
}
