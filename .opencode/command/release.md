---
description: Build and package the current Slacktor release.
agent: build
---

Prepare a Slacktor release from the current worktree.

1. Read `package.json`, `src/manifest.ts`, and `scripts/package-release.ps1`.
2. Confirm the package and manifest versions match.
3. Run `npm run release`.
4. Verify the resulting ZIP has `manifest.json` at its root and uses the current version.
5. Check that only production build assets are packaged and no real API key is present.
6. Report the ZIP path, version, and verification result. Do not commit or upload anything unless explicitly requested.
