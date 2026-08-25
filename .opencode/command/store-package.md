---
description: Verify a Slacktor Chrome Web Store ZIP.
agent: build
---

Verify the Chrome Web Store package at $ARGUMENTS. If no path is supplied, use the ZIP in `release/` matching the current `package.json` version.

1. Extract it under `C:\Users\admin\AppData\Local\Temp\opencode`.
2. Confirm `manifest.json` is at the ZIP root and its version matches `package.json`.
3. Confirm the archive contains build output only, including popup assets and required icons.
4. Search for real API-key patterns and unexpected source, debug, map, environment, or credential files.
5. Report the package path, file count, manifest version, and any blocking issue. Do not upload or publish it.
