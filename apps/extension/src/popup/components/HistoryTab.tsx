import { Trash2 } from "lucide-react"

import { ConfirmDialog } from "@/components/ConfirmDialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { QuickHistoryEntry } from "@/hooks/useQuickTranslator"
import { toast } from "@/hooks/useToast"

type HistoryTabProps = {
  history: QuickHistoryEntry[]
  onRestore: (entry: QuickHistoryEntry) => void
  onDelete: (id: string) => void
  onClear: () => void
}

export function HistoryTab({ history, onRestore, onDelete, onClear }: HistoryTabProps) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm leading-none font-semibold">History</h2>
          <p className="text-muted-foreground mt-1 text-xs">Previous verification translations.</p>
        </div>
        {history.length > 0 ? (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                Clear history
              </Button>
            }
            title="Clear all history?"
            description="This removes every saved verification translation. This action cannot be undone."
            confirmLabel="Clear history"
            onConfirm={() => {
              onClear()
              toast.success("History cleared.")
            }}
          />
        ) : null}
      </div>

      {history.length === 0 ? (
        <p className="text-muted-foreground text-xs">No translations yet.</p>
      ) : (
        <ScrollArea className="h-70">
          <div className="grid gap-1.5 pr-2">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="group bg-muted hover:bg-accent flex items-stretch rounded-md transition-colors"
              >
                <button
                  type="button"
                  onClick={() => {
                    onRestore(entry)
                    toast.success("Restored to Quick Translate.")
                  }}
                  className="text-foreground min-w-0 flex-1 px-3 py-2 text-left text-xs leading-relaxed"
                >
                  <span className="line-clamp-2">{entry.backTranslation}</span>
                </button>
                <AlertDialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* AlertDialogTrigger forwards all received props (including
                          Tooltip's hover/focus handlers) down to the real button, so
                          this nesting keeps both the tooltip and the confirm dialog
                          working. Putting Tooltip around a plain ConfirmDialog trigger
                          wouldn't work here since Tooltip.Root renders no DOM node of
                          its own for AlertDialogTrigger to attach onClick to. */}
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete history entry"
                          onClick={(event) => event.stopPropagation()}
                          className="text-muted-foreground hover:text-destructive mr-1 shrink-0 self-center opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <Trash2 />
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Delete entry</TooltipContent>
                  </Tooltip>
                  <AlertDialogContent onClick={(event) => event.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes this saved translation. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => {
                          onDelete(entry.id)
                          toast.success("Entry deleted.")
                        }}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
