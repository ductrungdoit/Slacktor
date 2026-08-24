# Slacktor

Slacktor is a Chromium Manifest V3 extension that translates Slack Web messages
with an OpenAI-compatible AI provider. It injects translations directly below
the original Slack message without changing Slack data.

## Features

- Manual or automatic translation on `https://app.slack.com/*`.
- Translation appears below the complete original message, including long
  rich-text messages, lists, and block-kit content.
- Filters out system activity, deleted messages, automated notices, bots, and
  Slack apps.
- Up to 10 translation requests run in parallel.
- Priority icon for queued messages.
- Per-message reload icon to bypass cache and translate again.
- Seven-day translation cache in IndexedDB.
- Thread-aware context stored in IndexedDB for 30 days after thread activity.
- Hybrid context for long threads: raw recent messages plus a rolling summary.
- Explicit in-extension consent before Slack messages are read or processed.

## Install For Development

```powershell
npm install
npm run build
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `C:\repo\Slacktor\dist`.
5. Pin Slacktor from the Chrome extensions menu.

After code changes, run `npm run build`, click Reload for Slacktor in
`chrome://extensions`, then refresh the Slack tab.

## Configure AI

1. Click the pinned Slacktor icon.
2. Review and accept the Slack data disclosure.
3. Open Settings and fill in:
   - **AI endpoint**: an OpenAI-compatible base URL, for example
     `https://api.openai.com/v1`.
   - **Model**: for example `gpt-4o-mini`.
   - **API key**.
   - **Translate to**: for example `Vietnamese`.
4. Enable **Auto-translate messages** if desired.
5. Click **Save configuration**.
6. Approve Chrome's requested permission for that exact AI endpoint origin.

The API key is restricted to trusted extension contexts. Slack content scripts
do not receive the key; only the background service worker calls the AI API.

## Translation UI

With auto-translate disabled, each eligible message has a play icon.

- Play icon: translate this message.
- Up-arrow icon: prioritize a message that is waiting in the auto queue.
- Spinner: the message is queued with priority or is currently translating.
- Reload icon: bypass cache and translate that one message again.

The popup also provides **Clear cache and retranslate visible messages**. It
clears the seven-day translation cache and requests fresh translations for
currently rendered Slack messages.

## Context

Slacktor uses context only to clarify meaning. The AI is instructed to translate
the current message only, not the surrounding conversation.

For replies in an identified Slack thread:

1. Raw user messages are stored in IndexedDB.
2. Slacktor uses the thread root plus other observed replies in the same thread.
3. The current message is excluded from its own context.
4. Thread context includes replies above and below the target when available.

Short threads send raw context. For threads exceeding 20 messages or 12,000
characters, Slacktor sends a rolling summary of older discussion and the 8 most
recent raw messages. Summary generation is deduplicated per thread and happens
in the background, so it does not delay an active translation.

Context is retained for 30 days after the thread's last observed activity.

## Cache

Translations are stored in IndexedDB for 7 days. Cache keys include:

- Slack message identity and source text.
- Endpoint, model, and target language.
- Current thread context summary and recent raw context.

Changing the message, provider/model, output language, or context produces a
new cache key. Identical in-flight requests are deduplicated so Slacktor does
not call the AI provider twice for the same translation.

## Data And Privacy

- Slacktor does not modify Slack's server-side data.
- Slacktor does not read or store Slack messages until the user accepts the
  in-extension data disclosure.
- Text is sent to the configured AI endpoint only for requested or enabled
  automatic translations.
- System, app, bot, automated, and deleted messages are excluded before they
  reach the translation queue or context store.
- The extension relies on public Slack DOM, permalink, and URL data. Slack DOM
  changes can require updates to `src/content/slack-adapter.ts`.

## Development

```powershell
npm run build
```

The build checks TypeScript and produces a loadable extension in `dist/`.

Architecture decisions and debugging details are available in:

- `docs/architecture.md`
- `docs/privacy-policy.html`
- `docs/store-listing.md`
