<p align="center">
  <img src="public/icons/icon-128.png" width="128" height="128" alt="Slacktor logo">
</p>

<h1 align="center">Slacktor</h1>

<p align="center">
  Private, context-aware AI translation for Slack Web.
</p>

Slacktor is a Chromium Manifest V3 extension that translates Slack Web messages
through an OpenAI-compatible provider configured by the user. Translations are
rendered directly below the original message without changing data in Slack.

## Features

- Manual and automatic translation on `https://app.slack.com/*`.
- Quick Translator for text pasted directly into the extension popup.
- Full rich-text extraction for long messages, lists, and block-kit content.
- Filtering for system activity, deleted messages, automated notices, bots, and
  Slack apps.
- Thread-aware context with rolling summaries for long conversations.
- Up to 10 concurrent requests with queue priority for manually prioritized,
  open-thread, and recent messages.
- Reserved queue capacity so newly posted messages and opened threads do not
  wait behind the complete visible channel history.
- One provider request per canonical Slack message, including DOM copies created
  by Slack virtualization.
- Per-message retranslation that bypasses cache.
- Seven-day translation cache and 30-day inactive thread-context retention in
  IndexedDB.
- Explicit data disclosure before Slack messages are read or processed.
- No developer-operated AI backend, analytics, advertising, or remote code.

## Requirements

- A Chromium-based browser with Manifest V3 extension support.
- Access to Slack Web at `https://app.slack.com/`.
- An OpenAI-compatible API endpoint, model name, and API key.

Slacktor supports HTTPS provider endpoints and local HTTP endpoints on
`localhost` or `127.0.0.1`. Chrome requests access only to the configured
provider origin.

## Install From A Release

1. Download the versioned `Slacktor-<version>.zip` file from the release's
   **Assets** section. Do not download GitHub's automatically generated
   **Source code (zip)** or **Source code (tar.gz)** archives; they contain the
   project source, not the built extension.
2. Extract the ZIP to a permanent local directory.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the extracted directory that contains
   `manifest.json` directly.
6. Pin Slacktor from the browser extensions menu.

When installing an update manually, keep the same extension entry and use its
**Reload** button after replacing the extracted files. A different extension ID
uses separate local settings and IndexedDB data.

## Install For Development

```powershell
npm install
npm run build
```

Load the generated `dist/` directory through `chrome://extensions`. After source
changes, run `npm run build`, reload Slacktor, then hard-refresh or reopen the
Slack tab so Chrome injects the new content script.

## Configure AI

1. Click the pinned Slacktor icon.
2. Review and accept the Slack data disclosure.
3. Open Settings and enter the provider endpoint, model, API key, and target
   language. Optionally add custom translation instructions for terminology or
   style preferences; Slacktor still enforces its required translation and
   structured-output rules.
4. Enable **Auto-translate messages** if desired.
5. Click **Save configuration**.
6. Approve Chrome access to the exact provider origin when prompted.

Example OpenAI-compatible settings:

```text
AI endpoint: https://api.openai.com/v1
Model: gpt-4o-mini
Translate to: Vietnamese
```

The API key is available only to trusted extension contexts. Slack content
scripts never receive it; all provider requests are made by the background
service worker.

## Translation Controls

With automatic translation disabled, each eligible Slack message displays a
manual translation button.

- Play icon: translate one message.
- Up-arrow icon: move a waiting message to the front of the queue.
- Spinner: queued, prioritized, retrying, or currently translating.
- Reload icon: bypass cache and translate that message again.

Automatic queue order is:

1. A message selected with **Translate next**.
2. A message in the currently open thread panel.
3. A message posted recently.
4. A message with a newer Slack timestamp.
5. Original enqueue order as the final fallback.

Active requests are not interrupted when queue priority changes.

## Stop And Cache Behavior

- **Stop translations** removes only jobs that have not started.
- Active provider requests continue until they finish.
- Completed translations remain visible.
- Stopped messages display **Translation stopped** and can be translated
  individually with their reload button.
- **Clear translation cache** deletes only the IndexedDB translation cache. It
  does not stop requests or automatically retranslate visible messages.
- Manual retranslation bypasses both cache and recent-result deduplication for
  that message.

## Thread Context

Slacktor uses context only to clarify meaning. The provider is instructed to
translate the current message, not the surrounding conversation.

For replies in an identified Slack thread:

1. Eligible raw user messages are stored locally in IndexedDB.
2. Slacktor associates replies through workspace, conversation, and thread-root
   timestamps.
3. The target message is excluded from its own context.
4. Available eligible replies can be used to clarify references and terminology.

Short threads use raw context. For threads exceeding 20 messages or 12,000
characters, Slacktor uses a rolling summary of older discussion and the eight
most recent raw messages. Summary generation is deduplicated and runs in the
background so it does not delay the active translation.

Thread context is retained for 30 days after the thread's last observed
activity.

## Cache And Deduplication

Translations are cached locally in IndexedDB for seven days. Stable cache keys
include:

- Workspace and conversation identity.
- Normalized Slack message identity and source text.
- Provider endpoint, model, and target language.

Thread context is deliberately excluded from the stable cache key because Slack
rebuilds virtualized thread state across page and extension reloads. Selecting
manual retranslation requests a fresh context-aware result instead.

Slacktor also deduplicates in-flight requests and short-lived recent results.
Multiple Slack DOM representations of the same message receive one translation
result without generating duplicate provider calls.

## Quick Translator

Quick Translator sends text entered in the popup to the configured provider and
shows Japanese and English output. It keeps local history for reuse and supports
clearing both the current input and saved history. A completed source draft is
cleared on the next popup open unless the user edits it after translation.

## Data And Privacy

- Slacktor does not modify Slack server-side data.
- Slack content is not read or stored until the user accepts the disclosure.
- Message text and applicable context are sent only to the AI endpoint selected
  by the user.
- Provider settings, cache, context, Quick Translator history, and diagnostic
  logs remain in Chrome's local extension storage or IndexedDB.
- Diagnostic logs exclude API keys and Slack message text.
- Removing the extension deletes its local data through Chrome's normal
  extension-data removal process.

Read the full [Privacy Policy](https://ductrungdoit.github.io/Slacktor/privacy-policy.html).

## Development

```powershell
npm run check
npm run build
npm run release
```

- `npm run check`: type-check the extension.
- `npm run build`: type-check and create a loadable extension in `dist/`.
- `npm run release`: regenerate icons, build, and create the current versioned
  ZIP in `release/`.

Slacktor relies on Slack's public DOM, attributes, URLs, and permalinks. Slack DOM
changes may require selector updates in `src/content/slack-adapter.ts` or queue
location detection in `src/content/message-observer.ts`.

## Documentation And Support

- [Architecture](docs/architecture.md)
- [Privacy policy source](docs/privacy-policy.md)
- [Chrome Web Store listing](docs/store-listing.md)
- [Release checklist](docs/release-checklist.md)
- [Report an issue](https://github.com/ductrungdoit/Slacktor/issues)

## License

No license has been published for this repository. All rights are reserved unless
a license is added later.
