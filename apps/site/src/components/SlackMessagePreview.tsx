import { cn } from "cn"
import { Copy, Hash, RotateCw } from "lucide-react"

type PreviewMessage = {
  author: string
  initials: string
  avatarClassName: string
  time: string
  sourceLanguage: string
  text: string
  translation: string
}

const PREVIEW_MESSAGES: PreviewMessage[] = [
  {
    author: "Haruka Sato",
    initials: "HS",
    avatarClassName: "bg-[#b45309]",
    time: "10:42 AM",
    sourceLanguage: "ja",
    text: "明日のリリースは午後3時に延期します。QAの確認がまだ終わっていません。",
    translation: "Tomorrow's release is moving to 3 PM. QA hasn't finished checking yet.",
  },
  {
    author: "Minh Tran",
    initials: "MT",
    avatarClassName: "bg-[#007a5a]",
    time: "10:44 AM",
    sourceLanguage: "vi",
    text: "Ok, mình sẽ báo khách hàng. Có cần dời buổi demo không?",
    translation: "OK, I'll let the client know. Do we need to move the demo too?",
  },
]

// Static illustration of Slacktor's in-place translation inside a Slack channel.
// Mirrors the real overlay: a purple rule, the translated text, and icon actions.
export function SlackMessagePreview() {
  return (
    <figure className="bg-card text-card-foreground overflow-hidden rounded-xl border shadow-[0_24px_60px_-20px_rgba(43,16,77,0.45)]">
      <figcaption className="sr-only">
        Example Slack channel where Slacktor shows an English translation under messages written in
        Japanese and Vietnamese.
      </figcaption>

      <div className="flex items-center gap-1.5 border-b px-4 py-3 text-[15px] font-bold">
        <Hash className="text-muted-foreground size-4" aria-hidden />
        release-planning
      </div>

      <ul className="flex flex-col gap-5 px-4 py-5">
        {PREVIEW_MESSAGES.map((message) => (
          <li key={message.author} className="flex gap-3">
            <span
              aria-hidden
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white",
                message.avatarClassName,
              )}
            >
              {message.initials}
            </span>
            <div className="min-w-0 flex-1 text-[15px] leading-[1.46]">
              <p>
                <span className="font-bold">{message.author}</span>{" "}
                <span className="text-muted-foreground text-xs">{message.time}</span>
              </p>
              <p lang={message.sourceLanguage}>{message.text}</p>
              <div className="border-primary mt-1.5 border-l-2 pl-2.5">
                <p lang="en">{message.translation}</p>
                <span className="text-primary mt-1.5 flex gap-2" aria-hidden>
                  <Copy className="size-3.5" />
                  <RotateCw className="size-3.5" />
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </figure>
  )
}
