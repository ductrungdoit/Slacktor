---
description: Validate Slacktor after source changes.
agent: build
---

Validate the Slacktor extension with minimal context and output.

1. Inspect only files relevant to $ARGUMENTS, or the current diff when no argument is supplied.
2. Run `npm run build`.
3. Check `dist/manifest.json` for Manifest V3, expected permissions, version consistency, and packaged icons.
4. Review the changed code for API-key or Slack-message logging, remote-code use, and privacy-consent regressions.
5. Report failures first, then a concise success summary. Do not create a release ZIP unless requested.
