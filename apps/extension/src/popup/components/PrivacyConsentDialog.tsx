import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import { PRIVACY_POLICY_URL } from "../../shared/links"

type PrivacyConsentDialogProps = {
  open: boolean
  onAccept: () => void
}

export function PrivacyConsentDialog({ open, onAccept }: PrivacyConsentDialogProps) {
  const [checked, setChecked] = useState(false)

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Slack data disclosure</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          Slacktor reads user messages displayed in Slack Web to provide translations. Message text
          and thread context may be sent to the AI endpoint you configure.
        </p>
        <p className="text-muted-foreground text-sm">
          Translation cache and thread context are stored locally in this browser. Slacktor does not
          operate a developer-owned server and does not sell or use Slack data for advertising. Read
          the{" "}
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noreferrer"
            className="text-primary font-medium underline underline-offset-2"
          >
            Privacy Policy
          </a>
          .
        </p>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => setChecked(value === true)}
            className="mt-0.5"
          />
          <span>I understand and agree to this processing for translation.</span>
        </label>
        <Button className="w-full" disabled={!checked} onClick={onAccept}>
          Enable Slack translation
        </Button>
      </DialogContent>
    </Dialog>
  )
}
