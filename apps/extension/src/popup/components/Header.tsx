import { cn } from "cn"
import { BookOpen, ScrollText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ProviderStatus } from "@/hooks/useProviderStatus"

import { CHANGELOG_URL, SITE_URL } from "../../shared/links"
import { APP_VERSION } from "../../shared/version"

type HeaderProps = {
  status: ProviderStatus
  showTranslations: boolean
  onToggleShowTranslations: (next: boolean) => void
  onOpenLogs: () => void
  hasProviderError: boolean
}

const STATUS_DOT_CLASS: Record<ProviderStatus["state"], string> = {
  unconfigured: "bg-muted-foreground/50",
  ready: "bg-success",
  error: "bg-destructive",
}

export function Header({
  status,
  showTranslations,
  onToggleShowTranslations,
  onOpenLogs,
  hasProviderError,
}: HeaderProps) {
  return (
    <header className="flex items-center gap-2.5 px-4 pt-4 pb-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(image:--brand-gradient)">
        <img src="/icons/icon-32.png" alt="" className="size-6" />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h1 className="truncate text-[15px] leading-none font-semibold">Slacktor</h1>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={CHANGELOG_URL}
              target="_blank"
              rel="noreferrer"
              aria-label={`Version ${APP_VERSION}, view changelog`}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-sm text-[10px] leading-none font-medium outline-none hover:underline focus-visible:ring-[3px]"
            >
              v{APP_VERSION}
            </a>
          </TooltipTrigger>
          <TooltipContent>View changelog</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="status"
              tabIndex={0}
              aria-label={status.message}
              className={cn("size-2 shrink-0 rounded-full", STATUS_DOT_CLASS[status.state])}
            />
          </TooltipTrigger>
          <TooltipContent>{status.message}</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex size-9 items-center justify-center">
              <Switch
                id="show-translations"
                aria-label={showTranslations ? "Hide translations" : "Show translations"}
                checked={showTranslations}
                onCheckedChange={onToggleShowTranslations}
              />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {showTranslations ? "Hide translations" : "Show translations"}
          </TooltipContent>
        </Tooltip>

        <span className="bg-border mx-0.5 h-4 w-px shrink-0" aria-hidden />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" asChild>
              <a href={SITE_URL} target="_blank" rel="noreferrer" aria-label="Open Slacktor docs">
                <BookOpen />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Docs</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Logs"
              onClick={onOpenLogs}
              className={cn(hasProviderError && "text-destructive hover:text-destructive")}
            >
              <ScrollText />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Logs</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
