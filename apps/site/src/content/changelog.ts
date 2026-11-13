// Release history shown on changelog.html. Newest first.
// 0.1.2, 0.1.3 and 0.1.6 were not published with release notes.

export type ChangelogSection = {
  title: string
  items: string[]
}

export type ChangelogRelease = {
  version: string
  summary: string
  sections: ChangelogSection[]
}

export const CHANGELOG: ChangelogRelease[] = [
  {
    version: "0.2.0",
    summary:
      "Translate your Slack draft before sending it, a rebuilt popup with dark mode, rich Slack formatting in translations, smarter conversation context, and a documentation site.",
    sections: [
      {
        title: "New",
        items: [
          "Translate button in the Slack message box. It translates your draft and translates it back for verification, using recent thread or channel context.",
          "Copy or apply the translation to the message box from a popover. Each translation is saved to History.",
          "Rebuilt the popup with Translate, History and Settings tabs.",
          "Light, dark and system themes for the popup. Translations inside Slack now follow Slack's own light or dark theme.",
          "Settings are split into Provider, which you save with a button, and App, which applies instantly.",
          "Retranslate visible messages button in the popup footer, and automatic retranslation when you change the target language.",
          "Documentation site with an about page, this changelog, and the privacy policy, linked from the popup.",
        ],
      },
      {
        title: "Improved",
        items: [
          "Translations preserve rich Slack formatting—bold, italic, strikethrough, inline code, code blocks, quotes, lists, custom emojis, and native link and mention colors—and detect edited or forwarded messages.",
          "Channel and thread context now includes recent translations and rolling summaries, resolved right when each request starts so terminology stays consistent.",
          "Priority translation (⚡) bypasses the batch queue immediately, hides once the API request starts, and reports live waiting and active counts in the popup.",
          "The back translation always uses the Translate to language from Settings, which is also shown in the popup.",
          "AI requests stop with a clear message after 180 seconds instead of waiting forever, and transient failures are retried for every request.",
          "Quick Translator errors are now shown in the popup.",
          "New purple theme and app icon.",
          "Better text contrast for translations in Slack's dark theme.",
        ],
      },
      {
        title: "Removed",
        items: [
          "The Move to Slack input button in the popup, replaced by the Translate button in Slack. The scripting permission it needed is no longer requested.",
        ],
      },
    ],
  },
  {
    version: "0.1.5",
    summary:
      "More reliable translation, a per-installation on/off switch, and configuration import and export.",
    sections: [
      {
        title: "New",
        items: [
          "Enable Slacktor setting that fully turns off one installation, avoiding conflicts between Chrome Web Store and development builds.",
          "Import and export configuration through a JSON file or the clipboard. Exports include your API key, so store them securely.",
          "Move either Quick Translator result straight into the Slack message box.",
          "Translation of Slack message permalink previews.",
        ],
      },
      {
        title: "Improved",
        items: [
          "Translations keep the original tone, urgency and directness instead of softening them.",
          "Messages already in the target language are left untranslated.",
          "Recent messages are prioritized, and duplicate requests from Slack's re-rendering are avoided.",
          "Malformed JSON from AI providers is repaired when it is safe to do so.",
          "Translation visibility moved to a compact toggle in the popup header.",
        ],
      },
      {
        title: "Notes",
        items: [
          "Adds the scripting, clipboardRead and clipboardWrite permissions. Chrome may ask you to approve the update.",
        ],
      },
    ],
  },
  {
    version: "0.1.4",
    summary: "Batched translation requests and custom translation instructions.",
    sections: [
      {
        title: "New",
        items: [
          "Custom translation instructions for terminology and style, applied on top of Slacktor's own rules.",
          "Show translations in Slack switch, so you can copy only the original messages.",
          "Daily counts of translated messages and AI requests.",
        ],
      },
      {
        title: "Improved",
        items: [
          "Messages that arrive close together are batched into one AI request, with a safety limit on request size.",
          "Requests to the provider are paced to reduce rate-limit errors, and retries are shown on the message.",
          "Clearer installation steps for release downloads.",
        ],
      },
    ],
  },
  {
    version: "0.1.1",
    summary: "First public test release.",
    sections: [
      {
        title: "Highlights",
        items: [
          "Translate Slack messages manually or automatically, below the original text.",
          "Thread context for more accurate references and terminology.",
          "Messages in the open thread and newly posted messages are translated first.",
          "Translations are cached locally for seven days across reloads.",
          "Quick Translator in the popup, with local history.",
          "Any HTTPS OpenAI-compatible endpoint, or a local provider on localhost.",
        ],
      },
      {
        title: "Improved",
        items: [
          "Stop translations and Clear translation cache are separate controls.",
          "Test provider checks the values in the form and saves them when the test succeeds.",
        ],
      },
    ],
  },
]
