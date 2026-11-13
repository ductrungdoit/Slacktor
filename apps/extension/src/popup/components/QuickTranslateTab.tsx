import { cn } from "cn"
import { Copy, Languages, Loader2, Settings as SettingsIcon, Undo2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { useQuickTranslator } from "@/hooks/useQuickTranslator"
import { toast } from "@/hooks/useToast"

import { LANGUAGE_OPTIONS } from "../../shared/languages"
import { QuickResultKey } from "../../shared/quick-history"

type QuickTranslateTabProps = {
  quick: ReturnType<typeof useQuickTranslator>
  /** Translate to language saved in Settings. The back translation always uses it. */
  settingsLanguage: string
  onOpenSettings: () => void
}

export function QuickTranslateTab({
  quick,
  settingsLanguage,
  onOpenSettings,
}: QuickTranslateTabProps) {
  const {
    draft,
    targetLanguage,
    results,
    translating,
    setDraft,
    setTargetLanguage,
    translate,
    clearSource,
  } = quick

  // The back translation language is the Settings language, so offering it as
  // the forward language would translate into the language of the source.
  // Keep the currently selected value so the select never renders blank.
  const targetLanguageOptions = LANGUAGE_OPTIONS.filter(
    (option) => option.value !== settingsLanguage || option.value === targetLanguage,
  )
  const languagesConflict =
    targetLanguage.trim().toLowerCase() === settingsLanguage.trim().toLowerCase()

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="quick-target-language" className="text-muted-foreground text-xs">
            Translate to
          </Label>
          <Select value={targetLanguage} onValueChange={setTargetLanguage}>
            <SelectTrigger id="quick-target-language" className="w-full">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {targetLanguageOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-muted-foreground text-xs">Then translate back to</Label>
          <div className="border-input bg-muted/40 flex h-9 items-center justify-between gap-1 rounded-md border pr-1 pl-3 text-sm">
            <span id="quick-back-language" className="truncate">
              {settingsLanguage}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Back translation uses ${settingsLanguage} from Settings. Open Settings to change it`}
                  onClick={onOpenSettings}
                >
                  <SettingsIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Follows Settings. Click to change</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {languagesConflict ? (
        <p role="alert" className="text-destructive text-xs">
          Choose a Translate to language different from your Settings language ({settingsLanguage}).
        </p>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor="quick-source" className="text-muted-foreground text-xs">
          Source text
        </Label>
        <Textarea
          id="quick-source"
          rows={4}
          placeholder="Enter any text..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={translating || languagesConflict}
          onClick={() =>
            void translate().catch((error: unknown) => {
              toast.error(
                error instanceof Error ? error.message : "Translation failed. Please retry.",
              )
            })
          }
        >
          {translating ? <Loader2 className="animate-spin" /> : null}
          Translate
        </Button>
        <Button variant="outline" onClick={clearSource}>
          Clear
        </Button>
      </div>

      {results ? (
        <div className="grid gap-2">
          <QuickResultCard
            variant="translation"
            label={results.targetLanguage}
            text={results.translation}
            onCopy={() =>
              void quick.copyResult(QuickResultKey.Translation).then(() => toast.success("Copied"))
            }
          />
          <QuickResultCard
            variant="back"
            label={results.backTranslationLanguage}
            text={results.backTranslation}
            onCopy={() =>
              void quick
                .copyResult(QuickResultKey.BackTranslation)
                .then(() => toast.success("Copied"))
            }
          />
        </div>
      ) : null}
    </div>
  )
}

type QuickResultCardProps = {
  /** `translation` is the main result; `back` is the verification and is visually secondary. */
  variant: "translation" | "back"
  /** Result language. Unknown for history entries saved by older versions. */
  label?: string
  text: string
  onCopy: () => void
}

function QuickResultCard({ variant, label, text, onCopy }: QuickResultCardProps) {
  const isTranslation = variant === "translation"
  const Icon = isTranslation ? Languages : Undo2
  const caption = isTranslation ? "Translation" : "Back translation"

  return (
    <Card className="gap-2 py-3">
      <CardHeader className="flex-row items-center justify-between gap-2 px-3 pb-0">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
          <Icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          {label ? (
            <>
              <span className="truncate">{label}</span>
              <span className="text-muted-foreground shrink-0 font-normal">· {caption}</span>
            </>
          ) : (
            <span className="truncate">{caption}</span>
          )}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Copy ${label ? `${label} ` : ""}${caption.toLowerCase()}`}
              onClick={onCopy}
            >
              <Copy />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy</TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent className="px-3">
        <pre
          className={cn(
            "max-h-32 overflow-auto font-sans text-[13px] leading-relaxed wrap-anywhere whitespace-pre-wrap",
            isTranslation ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {text}
        </pre>
      </CardContent>
    </Card>
  )
}
