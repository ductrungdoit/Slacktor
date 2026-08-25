# Slacktor Agent Guide

## Project

Slacktor is a Chrome Manifest V3 extension that translates Slack Web messages through an OpenAI-compatible provider configured by the user.

## Commands

- Type-check and build: `npm run build`
- Create icons, build, and package: `npm run release`
- Load the unpacked extension from `dist/`
- Upload the versioned ZIP from `release/` to Chrome Web Store

## Structure

- `src/background/`: AI requests, cache, context, summaries, logs, and service worker
- `src/content/`: Slack DOM observation, queueing, message extraction, and rendering
- `src/popup/`: popup UI and settings
- `src/shared/`: shared types, messages, and settings
- `scripts/`: icon generation and release packaging
- `docs/`: privacy, Store, release, and operational documentation

## Constraints

- Do not log or package API keys or Slack message text.
- Keep executable code inside the extension; do not introduce remote code.
- Keep production permissions minimal and justified.
- Preserve explicit privacy consent before reading or translating Slack content.
- Do not add a developer-owned AI backend; requests go only to the endpoint configured by the user.
- Increment the manifest and package version before every Chrome Web Store update.
- Keep `package.json` and `src/manifest.ts` versions identical.
- Prefer minimal changes and run `npm run build` after code edits.
- Do not edit generated files in `dist/`; regenerate them with the build.
