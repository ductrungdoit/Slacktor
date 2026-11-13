import { RotateCw, Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { SlackStats } from "@/hooks/useSlackStats"
import { toast } from "@/hooks/useToast"
import { sendExtensionMessage } from "@/lib/messaging"

type FooterProps = {
  stats?: SlackStats
  unavailable: boolean
}

export function Footer({ stats, unavailable }: FooterProps) {
  const queueLabel = unavailable
    ? "Stats unavailable"
    : `${stats?.waiting ?? 0} waiting · ${stats?.active ?? 0} active${
        stats && stats.retrying > 0 ? ` · ${stats.retrying} retrying` : ""
      }`
  const progressLabel = unavailable
    ? ""
    : `${stats?.translatedToday ?? 0} translated today · ${stats?.requestsToday ?? 0} LLM requests`

  const retranslateAll = () => {
    void sendExtensionMessage<{ ok: boolean; queued?: number }>({
      type: "retranslate-visible-from-popup",
    }).then((response) => {
      if (response?.ok) {
        toast.success(`${response.queued ?? 0} visible messages queued for retranslation.`)
      } else {
        toast.error("No visible Slack messages could be retranslated.")
      }
    })
  }

  const terminateAll = () => {
    void sendExtensionMessage<{ ok: boolean }>({ type: "terminate-slack-translations" }).then(
      (response) => {
        if (response?.ok) {
          toast.success("Queued translations stopped. Active translations will finish.")
        } else {
          toast.error("Could not stop translations on the active Slack tab.")
        }
      },
    )
  }

  return (
    <footer className="border-t px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span
          className={
            !unavailable && stats && stats.waiting > 0
              ? "text-warning"
              : !unavailable && stats && stats.active > 0
                ? "text-success"
                : "text-muted-foreground"
          }
        >
          {queueLabel}
        </span>
        <span className="text-muted-foreground text-right">{progressLabel}</span>
      </div>

      <div className="mt-2 flex gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Retranslate visible Slack messages"
              onClick={retranslateAll}
            >
              <RotateCw />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Retranslate visible messages</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Stop Slack translations"
              onClick={terminateAll}
            >
              <Square />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop Slack translations</TooltipContent>
        </Tooltip>
      </div>
    </footer>
  )
}
