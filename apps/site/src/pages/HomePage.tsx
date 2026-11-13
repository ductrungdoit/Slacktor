import { Button } from "@slacktor/ui"
import {
  ArrowDown,
  Database,
  KeyRound,
  Languages,
  type LucideIcon,
  MessagesSquare,
  MoonStar,
  ServerOff,
} from "lucide-react"

import { SlackMessagePreview } from "../components/SlackMessagePreview"
import { getPageHref, SITE_PAGES } from "../pages"

type Feature = {
  icon: LucideIcon
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    icon: MessagesSquare,
    title: "Translations in place",
    description:
      "Each translation appears under the original message, so the conversation keeps its order and you never switch windows.",
  },
  {
    icon: Languages,
    title: "Thread-aware",
    description:
      "Recent messages in the thread are sent as context, which keeps names, references and terminology consistent.",
  },
  {
    icon: KeyRound,
    title: "Your provider, your key",
    description:
      "Use any OpenAI-compatible endpoint, including a local model on localhost. Usage is billed by your provider.",
  },
  {
    icon: ServerOff,
    title: "No Slacktor server",
    description:
      "Requests go straight from your browser to the endpoint you configured. The developer never receives your messages.",
  },
  {
    icon: Database,
    title: "Cached locally",
    description:
      "Translations are cached in your browser for seven days, so reloading Slack does not pay for the same message twice.",
  },
  {
    icon: MoonStar,
    title: "Fits Slack's theme",
    description:
      "Translations follow Slack's light or dark theme. The popup has its own light, dark and system setting.",
  },
]

const SETUP_STEPS = [
  "Install Slacktor in Chrome or another Chromium browser.",
  "Open the popup, review the data disclosure, and add your AI endpoint, model and API key.",
  "Open Slack in the browser. New messages are translated as they arrive, or on demand per message.",
]

export function HomePage() {
  const privacyPage = SITE_PAGES.find((page) => page.id === "privacy-policy")

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-14 pb-20 sm:px-8 sm:pt-20 lg:grid-cols-[1fr_minmax(0,32rem)] lg:gap-16">
        <div>
          <h1 className="text-5xl leading-[1.04] font-semibold tracking-[-0.035em] text-balance sm:text-6xl">
            Read every Slack message in your language.
          </h1>
          <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed text-pretty">
            Slacktor adds a translation under each message in Slack Web, using the AI provider and
            model you choose. Nothing passes through a Slacktor server.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href="#setup">
                <ArrowDown aria-hidden />
                See how to set it up
              </a>
            </Button>
            {privacyPage ? (
              <Button asChild size="lg" variant="outline">
                <a href={getPageHref(privacyPage)}>Read the privacy policy</a>
              </Button>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-5 text-sm">
            Free to use, with the source code on GitHub. Works in Chrome, Edge, Brave and other
            Chromium browsers.
          </p>
        </div>

        <div className="relative">
          <div
            aria-hidden
            className="absolute -inset-4 rounded-[1.75rem] bg-(image:--brand-gradient) sm:-inset-6"
          />
          <div className="relative">
            <SlackMessagePreview />
          </div>
        </div>
      </section>

      <section aria-labelledby="features-heading" className="border-t">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <h2
            id="features-heading"
            className="max-w-2xl text-3xl font-semibold tracking-[-0.02em] text-balance"
          >
            Built around your provider and your data
          </h2>
          <ul className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-4">
                <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-muted-foreground mt-1 leading-relaxed">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="setup"
        aria-labelledby="setup-heading"
        className="bg-muted/60 scroll-mt-16 border-t"
      >
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <div>
            <h2 id="setup-heading" className="text-3xl font-semibold tracking-[-0.02em]">
              Set up in three steps
            </h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              You need an API key from an OpenAI-compatible provider, or a model running on your own
              machine.
            </p>
          </div>
          <ol className="grid gap-4">
            {SETUP_STEPS.map((step, index) => (
              <li key={step} className="bg-card flex items-start gap-4 rounded-xl border p-5">
                <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  {index + 1}
                </span>
                <p className="pt-0.5 leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  )
}
