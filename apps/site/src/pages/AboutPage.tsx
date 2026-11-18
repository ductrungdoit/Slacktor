import { ISSUES_URL, REPOSITORY_URL } from "@slacktor/ui"

import { PageHeader } from "../components/SiteLayout"
import { getPageHref, SITE_PAGES } from "../pages"

export function AboutPage() {
  const privacyPage = SITE_PAGES.find((page) => page.id === "privacy-policy")
  const changelogPage = SITE_PAGES.find((page) => page.id === "changelog")

  return (
    <>
      <PageHeader title="About Slacktor">
        <p>
          A browser extension for people who work in Slack with colleagues who write in other
          languages.
        </p>
      </PageHeader>

      <div className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <article className="prose-slacktor">
          <h2>What it does</h2>
          <p>
            Slacktor watches the messages that Slack Web shows on screen and adds a translation
            under each one, in the language you pick. You can let it translate member messages
            automatically, or translate a single message on demand. Bot and system messages are
            never translated automatically.
          </p>
          <p>
            The popup also has a Quick Translator for your own replies. It translates your draft
            into one language and back into another, so you can check the meaning before you move
            the result into the Slack message box.
          </p>

          <h2>How translation works</h2>
          <ul>
            <li>
              Slacktor sends the message, plus recent messages from the same thread as context, to
              the OpenAI-compatible endpoint you configured.
            </li>
            <li>
              Messages that arrive close together are batched into one request, and messages in an
              open thread or posted just now are translated first.
            </li>
            <li>
              Results are cached in your browser for seven days. A message already written in your
              target language is left as it is.
            </li>
            <li>
              Translations follow Slack's light or dark theme and can be hidden at any time from the
              popup header.
            </li>
          </ul>

          <h2>What you need</h2>
          <ul>
            <li>Chrome or another Chromium-based browser, and Slack opened at app.slack.com.</li>
            <li>
              An API key and model from an OpenAI-compatible provider, or a local model served on{" "}
              <code>localhost</code> or <code>127.0.0.1</code>. Remote endpoints must use HTTPS.
            </li>
          </ul>

          <h2>What it does not do</h2>
          <ul>
            <li>It does not run a server. Your messages and API key never reach the developer.</li>
            <li>It does not use analytics, advertising, or remotely loaded code.</li>
            <li>It does not post, edit or delete anything in Slack on its own.</li>
          </ul>
          <p>
            {privacyPage ? (
              <>
                The <a href={getPageHref(privacyPage)}>privacy policy</a> lists exactly what is
                handled and for how long.
              </>
            ) : null}
          </p>

          <h2>Known limitations</h2>
          <p>
            Slack does not offer a public interface for its web app, so Slacktor reads the page
            structure. A Slack redesign can temporarily affect message detection or where
            translations appear. Translation quality, speed and cost depend on the provider and
            model you choose.
          </p>

          <h2>Source code and feedback</h2>
          <p>
            The source code is on <a href={REPOSITORY_URL}>GitHub</a>. Found a bug or have an idea?{" "}
            <a href={ISSUES_URL}>Open an issue</a> with your browser version and steps to reproduce.
            Never include your API key or private Slack content.
            {changelogPage ? (
              <>
                {" "}
                Recent changes are in the <a href={getPageHref(changelogPage)}>changelog</a>.
              </>
            ) : null}
          </p>
        </article>
      </div>
    </>
  )
}
