# Slacktor Privacy Policy

Last updated: August 24, 2026

Slacktor is a browser extension that translates messages displayed in Slack Web
using an AI endpoint selected and configured by the user.

## Data Slacktor Handles

Slacktor may process the following data to provide its translation features:

- User-generated Slack message text displayed in Slack Web.
- Slack thread context, message identifiers, channel identifiers, author display
  names, and timestamps needed to associate a translation with its conversation.
- Text entered directly into Slacktor's Quick Translator.
- The AI endpoint, model name, API key, target language, and extension settings
  entered by the user.
- Local operational logs containing request type, endpoint origin/path, model,
  response status, and error messages. Logs do not include API keys or message
  text.

## How Data Is Used

Slacktor uses this data only to:

- Translate Slack messages and text entered into Quick Translator.
- Use thread context to improve translation accuracy.
- Cache translations locally to reduce repeated AI requests.
- Maintain local thread context and rolling summaries for long conversations.
- Display local history, request progress, and diagnostic logs.

## Data Transmission

When translation is requested or automatic translation is enabled, Slacktor
sends the message being translated and applicable thread context to the AI
endpoint configured by the user. Quick Translator text is also sent to that
endpoint.

Slacktor does not operate a developer-owned backend server. The developer does
not receive Slack content, API keys, translations, or diagnostic logs.

Remote AI endpoints must use HTTPS. Plain HTTP is supported only for local
endpoints on `localhost` or `127.0.0.1`.

## Local Storage and Retention

- Provider settings and API keys are stored in Chrome local extension storage.
- Slack thread context is stored locally in IndexedDB and retained for up to 30
  days after the thread's last observed activity.
- Translation cache entries are stored locally in IndexedDB for up to 7 days.
- Quick Translator history and diagnostic logs are stored locally and can be
  cleared from the extension UI.

Removing the extension deletes its locally stored data through Chrome's normal
extension data removal process.

## Sharing and Advertising

Slacktor does not sell user data, use it for advertising, profiling, credit
purposes, or permit human review by the developer. Data is transferred only to
the AI endpoint chosen by the user as necessary to provide translation.

Slacktor's use of information received from Chrome APIs complies with the Chrome
Web Store User Data Policy, including the Limited Use requirements.

## Security

Slacktor restricts its local storage to trusted extension contexts and does not
expose API keys to Slack page scripts. Users are responsible for selecting an AI
provider whose privacy and retention practices meet their requirements.

## User Controls

Users can:

- Disable automatic Slack translation.
- Stop active Slack translation requests.
- Clear translation cache and trigger fresh translations.
- Clear Quick Translator history and diagnostic logs.
- Remove the extension to delete all local extension data.

## Contact

For privacy questions, contact: ductrung.do.it@gmail.com
