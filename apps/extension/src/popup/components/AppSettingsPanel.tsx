import { cn } from "cn"
import { Loader2, type LucideIcon, Monitor, Moon, Sun } from "lucide-react"
import { useRef, useState } from "react"

import { ConfirmDialog } from "@/components/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import type { useProviderSettings } from "@/hooks/useProviderSettings"
import { toast } from "@/hooks/useToast"
import { buildConfigExport, parseImportedConfig } from "@/lib/config-transfer"
import type { ThemeMode } from "@/lib/theme-mode"

import { getProviderSettings, type ProviderSettings } from "../../shared/settings"

const CARD_TITLE_CLASS = "text-muted-foreground text-[13px] font-semibold tracking-wide uppercase"

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

type QuickLanguages = { targetLanguage: string }

type AppSettingsPanelProps = {
  provider: ReturnType<typeof useProviderSettings>
  quickLanguages: QuickLanguages
  onImportQuickLanguages: (next: QuickLanguages) => void
  /** True while the Provider panel has unsaved edits. */
  providerDirty: boolean
  /** Lets the Provider form pick up imported values. */
  onProviderImported: (settings: ProviderSettings) => void
  themeMode: ThemeMode
  onThemeModeChange: (mode: ThemeMode) => Promise<void>
}

export function AppSettingsPanel({
  provider,
  quickLanguages,
  onImportQuickLanguages,
  providerDirty,
  onProviderImported,
  themeMode,
  onThemeModeChange,
}: AppSettingsPanelProps) {
  const [updatingGeneral, setUpdatingGeneral] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    draft,
    savedConfigured,
    setExtensionEnabled,
    setAutoTranslate,
    clearTranslationCache,
    importSettings,
  } = provider
  const enableLocked = !savedConfigured && !draft.extensionEnabled

  const showError = (error: unknown, fallback: string) =>
    toast.error(error instanceof Error ? error.message : fallback)

  const handleGeneralChange = async (update: () => Promise<void>, successMessage?: string) => {
    setUpdatingGeneral(true)
    try {
      await update()
      if (successMessage) {
        toast.success(successMessage)
      }
    } catch (error) {
      showError(error, "Could not update the setting.")
    } finally {
      setUpdatingGeneral(false)
    }
  }

  const handleThemeChange = (mode: ThemeMode) => {
    void onThemeModeChange(mode).catch((error: unknown) =>
      showError(error, "Could not save the theme preference."),
    )
  }

  const handleClearCache = async () => {
    setClearingCache(true)
    try {
      await clearTranslationCache()
      toast.success("Translation cache cleared. Active translations were not stopped.")
    } catch (error) {
      showError(error, "Could not clear the translation cache.")
    } finally {
      setClearingCache(false)
    }
  }

  const handleExport = async (target: "file" | "clipboard") => {
    if (providerDirty) {
      toast.warning("Save or discard your provider changes before exporting.")
      return
    }
    if (!savedConfigured) {
      toast.warning("Save a provider before exporting the configuration.")
      return
    }

    try {
      const config = buildConfigExport(await getProviderSettings(), quickLanguages)
      if (target === "file") {
        const url = URL.createObjectURL(new Blob([config], { type: "application/json" }))
        const link = document.createElement("a")
        link.href = url
        link.download = "slacktor-config.json"
        link.click()
        URL.revokeObjectURL(url)
        toast.success(
          "Configuration exported to file. Keep it private because it contains your API key.",
        )
      } else {
        await navigator.clipboard.writeText(config)
        toast.success("Configuration copied. It contains your API key.")
      }
    } catch (error) {
      showError(error, "Configuration transfer failed.")
    }
  }

  const handleImportText = async (text: string) => {
    try {
      const config = parseImportedConfig(text)
      await importSettings(config.providerSettings)
      onImportQuickLanguages(config.quickTranslator)
      onProviderImported(config.providerSettings)
      toast.success("Configuration imported.")
    } catch (error) {
      showError(error, "Configuration transfer failed.")
    }
  }

  const handleImportClipboard = async () => {
    try {
      const permissionStatus = await navigator.permissions
        .query({ name: "clipboard-read" as PermissionName })
        .catch(() => null)

      if (permissionStatus?.state === "denied") {
        showError(
          null,
          "Clipboard access is blocked. Allow it in your browser's site settings, then try again.",
        )
        return
      }

      const text = await navigator.clipboard.readText()
      await handleImportText(text)
    } catch (error) {
      showError(error, "Configuration transfer failed.")
    }
  }

  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
      <Card>
        <CardHeader className="px-4">
          <CardTitle className={CARD_TITLE_CLASS}>General</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 px-4">
          <div className="flex flex-row items-start gap-2.5">
            <Switch
              id="extension-enabled"
              checked={draft.extensionEnabled}
              disabled={updatingGeneral || enableLocked}
              onCheckedChange={(next) =>
                void handleGeneralChange(
                  () => setExtensionEnabled(next),
                  next ? "Slacktor enabled." : "Slacktor disabled.",
                )
              }
              aria-describedby="extension-enabled-description"
              className="mt-0.5"
            />
            <div className="grid gap-0.5">
              <Label htmlFor="extension-enabled" className="text-sm font-medium">
                Enable Slacktor
              </Label>
              <p id="extension-enabled-description" className="text-muted-foreground text-xs">
                {enableLocked
                  ? "Save a provider first to turn on translation in Slack Web."
                  : "Master switch to turn all translation features on or off on Slack Web."}
              </p>
            </div>
          </div>

          <div className="flex flex-row items-start gap-2.5">
            <Switch
              id="auto-translate"
              checked={draft.autoTranslate}
              disabled={updatingGeneral}
              onCheckedChange={(next) =>
                void handleGeneralChange(
                  () => setAutoTranslate(next),
                  next ? "Auto-translate enabled." : "Auto-translate disabled.",
                )
              }
              aria-describedby="auto-translate-description"
              className="mt-0.5"
            />
            <div className="grid gap-0.5">
              <Label htmlFor="auto-translate" className="text-sm font-medium">
                Auto-translate member messages
              </Label>
              <p id="auto-translate-description" className="text-muted-foreground text-xs">
                Automatically translates messages from team members. Bot and system messages can
                still be translated manually.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4">
          <CardTitle className={CARD_TITLE_CLASS}>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 px-4">
          <span id="theme-mode-label" className="text-sm font-medium">
            Popup theme
          </span>
          <div
            role="radiogroup"
            aria-labelledby="theme-mode-label"
            className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-0.75"
          >
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
              const selected = themeMode === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${label} theme`}
                  onClick={() => handleThemeChange(value)}
                  className={cn(
                    "focus-visible:ring-ring/50 inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-all outline-none focus-visible:ring-[3px] [&_svg]:size-4",
                    selected
                      ? "bg-background text-foreground dark:bg-input/30 dark:border-input border shadow-sm"
                      : "text-muted-foreground hover:text-foreground border border-transparent",
                  )}
                >
                  <Icon aria-hidden />
                  {label}
                </button>
              )
            })}
          </div>
          <p className="text-muted-foreground text-xs">
            Translations inside Slack always follow Slack's own theme.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4">
          <CardTitle className={CARD_TITLE_CLASS}>Data</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 px-4">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
            <span className="text-sm font-medium">Export configuration</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleExport("file")}
            >
              File
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleExport("clipboard")}
            >
              Clipboard
            </Button>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
            <span className="text-sm font-medium">Import configuration</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              File
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleImportClipboard()}
            >
              Clipboard
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) void file.text().then(handleImportText)
            }}
          />

          <Separator className="my-1" />

          <ConfirmDialog
            trigger={
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:text-destructive w-full"
                disabled={clearingCache}
              >
                {clearingCache ? <Loader2 className="animate-spin" /> : null}
                Clear translation cache
              </Button>
            }
            title="Clear translation cache?"
            description="This removes all cached translations. Active translations in Slack are not stopped, but future views will re-request them from your AI endpoint."
            confirmLabel="Clear cache"
            onConfirm={() => void handleClearCache()}
          />
        </CardContent>
      </Card>
    </div>
  )
}
