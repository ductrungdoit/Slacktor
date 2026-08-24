# Chrome Web Store Listing

## Name

Slacktor

## Short Description

Translate Slack Web messages with your own AI provider and thread-aware context.

## Detailed Description

Slacktor adds readable AI translations directly below messages in Slack Web.
Connect an OpenAI-compatible endpoint, choose a model and target language, then
translate messages manually or automatically.

Key features:

- Translations displayed directly under the complete original Slack message.
- Thread-aware context for more accurate references and terminology.
- Local rolling summaries for long threads.
- Up to 10 concurrent Slack translation requests with queue progress and retry.
- Local seven-day translation cache and 30-day inactive thread-context retention.
- Filters for system, app, bot, automated, and deleted messages.
- Quick Translator that translates text to Japanese and back to English for
  verification.
- User-controlled endpoint, model, API key, history, logs, cache, and request
  termination.

Slacktor does not operate a developer-owned AI server. Slack content is sent
only to the AI endpoint configured by the user after explicit in-extension
consent.

## Category

Productivity

## Permission Justifications

### storage

Stores user configuration, consent, local translation history, local diagnostic
logs, translation cache, and thread context. Storage is restricted to trusted
extension contexts.

### Host access: https://app.slack.com/*

Required to detect user messages displayed in Slack Web and insert translations
directly below them. Slacktor does not access unrelated sites.

### Optional HTTPS host access

Users can configure their own AI provider. Slacktor requests runtime permission
only for the specific HTTPS host entered by the user, then sends translation
requests to that endpoint.

### Optional localhost host access

Supports local AI providers such as Ollama on `localhost` or `127.0.0.1`.

## Single Purpose

Translate Slack Web messages and user-entered text through a user-configured AI
provider.

## Data Disclosure Draft

- Personally identifiable information: Slack author display names/member IDs may
  be processed as thread context.
- Authentication information: user-provided AI API key is stored locally.
- Website content: Slack message text is read and may be transmitted to the
  configured AI endpoint.
- Personal communications and user-generated content: Slack messages and Quick
  Translator input are processed for translation.

Data use: app functionality only. No advertising, sale, profiling, or
developer-operated server collection.

## Reviewer Test Instructions

1. Install the extension and open the popup.
2. Accept the Slack data disclosure.
3. Open Settings, configure an OpenAI-compatible HTTPS endpoint, API key, and
   model, then click Test provider.
4. Open `https://app.slack.com/` with a Slack account containing messages.
5. Enable Auto-translate messages or use the per-message translation icon.
6. Confirm translations appear below eligible user messages. Bot, app, system,
   automated, and deleted messages are excluded.
7. Use Quick Translator in the popup to translate arbitrary text to Japanese and
   back to English.
