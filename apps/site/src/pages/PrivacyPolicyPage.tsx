import { CONTACT_EMAIL } from "@slacktor/ui"

import { PageHeader } from "../components/SiteLayout"

// Published at /Slacktor/privacy-policy.html and referenced by the Chrome Web
// Store listing. Update LAST_UPDATED whenever the policy text changes.
const LAST_UPDATED = { iso: "2026-08-24", label: "August 24, 2026" }

export function PrivacyPolicyPage() {
  return (
    <>
      <PageHeader title="Slacktor Privacy Policy">
        <p>
          Last updated: <time dateTime={LAST_UPDATED.iso}>{LAST_UPDATED.label}</time>
        </p>
      </PageHeader>

      <div className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <article className="prose-slacktor">
          <p>
            Slacktor is a browser extension that translates messages displayed in Slack Web using an
            AI endpoint selected and configured by the user.
          </p>

          <h2>Data Slacktor handles</h2>
          <p>Slacktor may process the following data to provide its translation features:</p>
          <ul>
            <li>User-generated Slack message text displayed in Slack Web.</li>
            <li>
              Slack thread context, message identifiers, channel identifiers, author display names,
              and timestamps needed to associate a translation with its conversation.
            </li>
            <li>Text entered directly into Slacktor's Quick Translator.</li>
            <li>
              The AI endpoint, model name, API key, target language, privacy consent, and extension
              settings entered by the user.
            </li>
            <li>
              Local operational logs containing request type, endpoint origin/path, model, response
              status, and error messages. Logs do not include API keys or message text.
            </li>
          </ul>

          <h2>How data is used</h2>
          <p>Slacktor uses this data only to:</p>
          <ul>
            <li>Translate Slack messages and text entered into Quick Translator.</li>
            <li>Use thread context to improve translation accuracy.</li>
            <li>Cache translations locally to reduce repeated AI requests.</li>
            <li>Maintain local thread context and rolling summaries for long conversations.</li>
            <li>Display local history, request progress, and diagnostic logs.</li>
          </ul>

          <h2>Data transmission</h2>
          <p>
            When translation is requested or automatic translation is enabled, Slacktor sends the
            message being translated and applicable thread context to the AI endpoint configured by
            the user. Quick Translator text is also sent to that endpoint.
          </p>
          <p>
            Slacktor does not operate a developer-owned backend server. The developer does not
            receive Slack content, API keys, translations, or diagnostic logs.
          </p>
          <p>
            Remote AI endpoints must use HTTPS. Plain HTTP is supported only for local endpoints on{" "}
            <code>localhost</code> or <code>127.0.0.1</code>.
          </p>

          <h2>Local storage and retention</h2>
          <ul>
            <li>Provider settings and API keys are stored in Chrome local extension storage.</li>
            <li>
              Slack thread context is stored locally in IndexedDB and retained for up to 30 days
              after the thread's last observed activity.
            </li>
            <li>Translation cache entries are stored locally in IndexedDB for up to 7 days.</li>
            <li>
              Quick Translator history and diagnostic logs are stored locally and can be cleared
              from the extension UI.
            </li>
          </ul>
          <p>
            Removing the extension deletes its locally stored data through Chrome's normal extension
            data removal process.
          </p>

          <h2>Sharing and advertising</h2>
          <p>
            Slacktor does not sell user data, use it for advertising, profiling, credit purposes, or
            permit human review by the developer. Data is transferred only to the AI endpoint chosen
            by the user as necessary to provide translation.
          </p>
          <p>
            Slacktor's use of information received from Chrome APIs complies with the Chrome Web
            Store User Data Policy, including the Limited Use requirements.
          </p>

          <h2>Security</h2>
          <p>
            Slacktor restricts its local storage to trusted extension contexts and does not expose
            API keys to Slack page scripts. Users are responsible for selecting an AI provider whose
            privacy and retention practices meet their requirements.
          </p>

          <h2>User controls</h2>
          <p>Users can:</p>
          <ul>
            <li>Disable automatic Slack translation.</li>
            <li>Stop active Slack translation requests.</li>
            <li>Clear translation cache and trigger fresh translations.</li>
            <li>Clear Quick Translator history and diagnostic logs.</li>
            <li>Remove the extension to delete all local extension data.</li>
          </ul>

          <h2>Contact</h2>
          <p>
            For privacy questions, contact <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </article>
      </div>
    </>
  )
}
