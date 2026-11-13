import { History, Languages, Settings as SettingsIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Footer } from "@/components/Footer"
import { Header } from "@/components/Header"
import { HistoryTab } from "@/components/HistoryTab"
import { LogsDialog } from "@/components/LogsDialog"
import { PrivacyConsentDialog } from "@/components/PrivacyConsentDialog"
import { QuickTranslateTab } from "@/components/QuickTranslateTab"
import { SettingsTab } from "@/components/SettingsTab"
import { Toaster } from "@/components/Toaster"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useLogs } from "@/hooks/useLogs"
import { useProviderSettings } from "@/hooks/useProviderSettings"
import { useProviderStatus } from "@/hooks/useProviderStatus"
import { useQuickTranslator } from "@/hooks/useQuickTranslator"
import { useSlackStats } from "@/hooks/useSlackStats"
import { useThemeMode } from "@/hooks/useThemeMode"

type TabKey = "quick" | "history" | "settings"

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("quick")
  const [logsOpen, setLogsOpen] = useState(false)
  const [settingsDirty, setSettingsDirty] = useState(false)
  const [pendingTab, setPendingTab] = useState<TabKey | null>(null)
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
  const [focusTargetLanguage, setFocusTargetLanguage] = useState(false)
  const settingsResetRef = useRef<(() => void) | undefined>(undefined)

  const provider = useProviderSettings()
  const status = useProviderStatus(provider.configured)
  const slackStats = useSlackStats()
  const quick = useQuickTranslator()
  const logs = useLogs()
  const { themeMode, setThemeMode } = useThemeMode()

  const handleTabChange = (value: string) => {
    const tab = value as TabKey
    // Intercept navigation away from settings when there are unsaved changes.
    if (activeTab === "settings" && settingsDirty && tab !== "settings") {
      setPendingTab(tab)
      setDiscardDialogOpen(true)
      return
    }
    setActiveTab(tab)
  }

  const handleDiscardAndSwitch = () => {
    // Reset the form to its last-saved state, then navigate.
    settingsResetRef.current?.()
    if (pendingTab) setActiveTab(pendingTab)
    setPendingTab(null)
    setDiscardDialogOpen(false)
  }

  const handleCancelDiscard = () => {
    setPendingTab(null)
    setDiscardDialogOpen(false)
  }

  useEffect(() => {
    if (provider.loaded) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.body.classList.remove("preload")
        })
      })
    }
  }, [provider.loaded])

  return (
    <TooltipProvider>
      <div className="flex size-full flex-col">
        <Header
          status={status}
          showTranslations={provider.draft.showTranslations}
          onToggleShowTranslations={(next) => void provider.setShowTranslations(next)}
          onOpenLogs={() => setLogsOpen(true)}
          hasProviderError={status.state === "error"}
        />

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="flex min-h-0 w-full flex-1 flex-col"
        >
          <div className="px-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="quick">
                <Languages />
                Translate
              </TabsTrigger>
              <TabsTrigger value="history">
                <History />
                History
              </TabsTrigger>
              <TabsTrigger value="settings">
                <SettingsIcon />
                Settings
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="quick" className="mt-0 min-h-0 flex-1 overflow-y-auto">
            <QuickTranslateTab
              quick={quick}
              settingsLanguage={provider.savedTargetLanguage}
              onOpenSettings={() => {
                setFocusTargetLanguage(true)
                handleTabChange("settings")
              }}
            />
          </TabsContent>
          <TabsContent value="history" className="mt-0 min-h-0 flex-1 overflow-y-auto">
            <HistoryTab
              history={quick.history}
              onRestore={(entry) => {
                quick.restoreFromHistory(entry)
                setActiveTab("quick")
              }}
              onDelete={quick.deleteHistoryEntry}
              onClear={quick.clearHistory}
            />
          </TabsContent>
          <TabsContent value="settings" className="mt-0 min-h-0 flex-1 overflow-y-auto">
            <SettingsTab
              provider={provider}
              quickLanguages={{ targetLanguage: quick.targetLanguage }}
              onImportQuickLanguages={(next) => quick.setTargetLanguage(next.targetLanguage)}
              themeMode={themeMode}
              onThemeModeChange={setThemeMode}
              onDirtyChange={setSettingsDirty}
              resetRef={settingsResetRef}
              focusTargetLanguage={focusTargetLanguage}
              onTargetLanguageFocused={() => setFocusTargetLanguage(false)}
            />
          </TabsContent>
        </Tabs>

        <Footer stats={slackStats.stats} unavailable={slackStats.unavailable} />
      </div>

      {/* Discard-changes confirmation when navigating away from dirty settings */}
      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved provider changes in Settings. Leave without saving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDiscard}>Stay in Settings</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardAndSwitch}>Discard changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LogsDialog open={logsOpen} onOpenChange={setLogsOpen} logsState={logs} />
      <PrivacyConsentDialog
        open={provider.loaded && !provider.draft.privacyConsent}
        onAccept={() => void provider.acceptPrivacyConsent()}
      />
      <Toaster />
    </TooltipProvider>
  )
}
