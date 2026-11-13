# Slacktor Agent Guide

## Project

Slacktor is a Chrome Manifest V3 extension that translates Slack Web messages through an OpenAI-compatible provider configured by the user.

## Commands

- Run dev servers (both extension and site): `npm run dev`
- Run extension dev server: `npm run dev:extension`
- Run docs site dev server: `npm run dev:site` (http://localhost:5173/Slacktor/)
- Build both extension and site: `npm run build`
- Build extension only: `npm run build:extension`
- Build docs site only: `npm run build:site` (output in `dist/site/`)
- Type-check all packages: `npm run check`
- Create icons, build, and package extension: `npm run release`
- Load the unpacked extension from `dist/extension/`
- Upload the versioned ZIP from `release/` to Chrome Web Store

## Structure

- `apps/extension/src/background/`: AI requests, cache, context, summaries, logs, and service worker
- `apps/extension/src/content/`: Slack DOM observation, queueing, message extraction, and rendering
- `apps/extension/src/popup/`: popup UI and settings
- `apps/extension/src/shared/`: extension types, messages, and settings
- `apps/site/`: React docs site (home, about, changelog, privacy policy) prerendered to static HTML and deployed to GitHub Pages
- `packages/ui/`: shared UI components, theme tokens, and public links
- `dist/extension/`: unpacked extension build output
- `dist/site/`: static prerendered HTML output for GitHub Pages
- `scripts/`: icon generation, docs site build, and release packaging
- `docs/`: internal architecture, release, and tooling notes (not published; see `docs/README.md`)

## Constraints

- Do not log or package API keys or Slack message text.
- Keep executable code inside the extension; do not introduce remote code.
- Keep production permissions minimal and justified.
- Preserve explicit privacy consent before reading or translating Slack content.
- Do not add a developer-owned AI backend; requests go only to the endpoint configured by the user.
- Increment the manifest and package version before every Chrome Web Store update.
- Keep `package.json` and `apps/extension/src/manifest.ts` versions identical.
- Prefer minimal changes and run `npm run build` after code edits.
- Do not edit generated files in `dist/`; regenerate them with the build.
- Use icons, not visible text, for compact actions attached to translation results. Put the action name in `title` and an explicit accessible description in `aria-label`.
