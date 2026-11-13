import { zodResolver } from "@hookform/resolvers/zod"
import { cn } from "cn"
import { AlertTriangle, PlugZap, SlidersHorizontal } from "lucide-react"
import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import { AppSettingsPanel } from "@/components/AppSettingsPanel"
import {
  type ProviderFormValues,
  ProviderSettingsPanel,
  providerSettingsSchema,
  toProviderFormValues,
} from "@/components/ProviderSettingsPanel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { useProviderSettings } from "@/hooks/useProviderSettings"
import type { ThemeMode } from "@/lib/theme-mode"

import type { ProviderSettings } from "../../shared/settings"

type SettingsPanelKey = "provider" | "app"

const PANEL_HINTS: Record<SettingsPanelKey, string> = {
  provider: "AI connection and translation. Changes apply after you save.",
  app: "Slacktor behavior, appearance and data. Changes apply instantly.",
}

type SettingsTabProps = {
  provider: ReturnType<typeof useProviderSettings>
  quickLanguages: { targetLanguage: string }
  onImportQuickLanguages: (next: { targetLanguage: string }) => void
  themeMode: ThemeMode
  onThemeModeChange: (mode: ThemeMode) => Promise<void>
  /** Called whenever the provider form dirty state changes — lets App.tsx guard tab navigation. */
  onDirtyChange?: (isDirty: boolean) => void
  /** Pass a ref; SettingsTab will populate `.current` with a reset function. */
  resetRef?: React.RefObject<(() => void) | undefined>
  /** When true, switch to Provider and scroll to the Translate to field, then call `onTargetLanguageFocused`. */
  focusTargetLanguage?: boolean
  onTargetLanguageFocused?: () => void
}

export function SettingsTab({
  provider,
  quickLanguages,
  onImportQuickLanguages,
  themeMode,
  onThemeModeChange,
  onDirtyChange,
  resetRef,
  focusTargetLanguage,
  onTargetLanguageFocused,
}: SettingsTabProps) {
  const [panel, setPanel] = useState<SettingsPanelKey>("provider")

  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerSettingsSchema),
    defaultValues: toProviderFormValues(provider.draft),
  })
  const isDirty = form.formState.isDirty

  const handleProviderImported = (settings: ProviderSettings) => {
    form.reset(toProviderFormValues(settings))
  }

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    if (resetRef) resetRef.current = () => form.reset()
  })

  useEffect(() => {
    if (!focusTargetLanguage) return
    setPanel("provider")
    // Wait for the Provider panel to become visible before scrolling to the field.
    const frame = requestAnimationFrame(() => {
      const field = document.getElementById("target-language")
      field?.scrollIntoView({ behavior: "smooth", block: "center" })
      field?.focus({ preventScroll: true })
      onTargetLanguageFocused?.()
    })
    return () => cancelAnimationFrame(frame)
  }, [focusTargetLanguage, onTargetLanguageFocused])

  return (
    <Tabs
      value={panel}
      onValueChange={(value) => setPanel(value as SettingsPanelKey)}
      className="gap-0"
    >
      <div className="bg-background sticky top-0 z-30 border-b">
        <TabsList
          variant="line"
          className="grid w-full grid-cols-2 gap-0 p-0 group-data-[orientation=horizontal]/tabs:h-10"
          aria-label="Settings sections"
        >
          <TabsTrigger
            value="provider"
            className="data-[state=active]:text-foreground after:bg-primary h-full rounded-none group-data-[orientation=horizontal]/tabs:after:-bottom-px"
          >
            <PlugZap />
            Provider
            {isDirty ? (
              <>
                <span className="bg-warning size-1.5 rounded-full" aria-hidden />
                <span className="sr-only">(unsaved changes)</span>
              </>
            ) : null}
          </TabsTrigger>
          <TabsTrigger
            value="app"
            className="data-[state=active]:text-foreground after:bg-primary h-full rounded-none group-data-[orientation=horizontal]/tabs:after:-bottom-px"
          >
            <SlidersHorizontal />
            App
          </TabsTrigger>
        </TabsList>

        <div
          className={cn(
            "grid transition-all duration-300 ease-in-out",
            isDirty
              ? "grid-rows-[1fr] opacity-100"
              : "pointer-events-none grid-rows-[0fr] opacity-0",
          )}
          aria-hidden={!isDirty}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="bg-warning text-warning-foreground flex items-center gap-2 border-t px-4 py-1.5 text-xs">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              <span className="font-medium">Unsaved provider changes — remember to save.</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-muted-foreground px-4 pt-3 text-xs">{PANEL_HINTS[panel]}</p>

      {/* Both panels stay mounted so switching sections never drops unsaved input. */}
      <TabsContent value="provider" forceMount className="data-[state=inactive]:hidden">
        <ProviderSettingsPanel form={form} provider={provider} />
      </TabsContent>
      <TabsContent value="app" forceMount className="data-[state=inactive]:hidden">
        <AppSettingsPanel
          provider={provider}
          quickLanguages={quickLanguages}
          onImportQuickLanguages={onImportQuickLanguages}
          providerDirty={isDirty}
          onProviderImported={handleProviderImported}
          themeMode={themeMode}
          onThemeModeChange={onThemeModeChange}
        />
      </TabsContent>
    </Tabs>
  )
}
