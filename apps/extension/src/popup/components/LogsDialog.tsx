import { cn } from "cn"
import { useEffect } from "react"

import { ConfirmDialog } from "@/components/ConfirmDialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { useLogs } from "@/hooks/useLogs"
import { toast } from "@/hooks/useToast"

type LogsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  logsState: ReturnType<typeof useLogs>
}

export function LogsDialog({ open, onOpenChange, logsState }: LogsDialogProps) {
  const { logs, refresh, clear } = logsState

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[70vh] flex-col gap-3 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Slacktor logs</DialogTitle>
          <DialogDescription>
            Request metadata only. API keys and message text are not logged.
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void refresh()
                .then(() => toast.success("Logs refreshed.", undefined, 2000))
                .catch((error: unknown) => {
                  toast.error(error instanceof Error ? error.message : "Could not refresh logs.")
                })
            }
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void navigator.clipboard
                .writeText(JSON.stringify(logs, null, 2))
                .then(() => toast.success("Logs copied to clipboard."))
                .catch(() => toast.error("Could not copy logs."))
            }
          >
            Copy
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm">
                Clear
              </Button>
            }
            title="Clear all logs?"
            description="This removes every stored request log. This action cannot be undone."
            confirmLabel="Clear logs"
            onConfirm={() =>
              void Promise.resolve(clear())
                .then(() => toast.success("Logs cleared."))
                .catch((error: unknown) => {
                  toast.error(error instanceof Error ? error.message : "Could not clear logs.")
                })
            }
          />
        </div>

        {logs.length === 0 ? (
          <p className="text-muted-foreground text-xs">No logs yet.</p>
        ) : (
          <ScrollArea className="min-h-0 w-full flex-1">
            <div className="grid w-full min-w-0 gap-2 pr-3 pb-1">
              {logs.map((entry) => (
                <article
                  key={entry.id}
                  className={cn(
                    "bg-muted w-full min-w-0 rounded-md border-l-2 px-2.5 py-2",
                    entry.level === "error" ? "border-l-destructive" : "border-l-primary",
                  )}
                >
                  <header className="text-muted-foreground flex items-center justify-between gap-2 text-[10px]">
                    <strong className="text-foreground truncate">{entry.scope}</strong>
                    <time className="shrink-0">
                      {new Date(entry.createdAt).toLocaleTimeString()}
                    </time>
                  </header>
                  <p className="mt-0.5 text-[11px] leading-relaxed wrap-anywhere">
                    {entry.message}
                  </p>
                  {entry.details ? (
                    <pre className="text-muted-foreground mt-1 max-w-full text-[10px] leading-relaxed break-all whitespace-pre-wrap">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  ) : null}
                </article>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
