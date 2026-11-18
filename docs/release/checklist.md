# Chrome Web Store Release Checklist

- [ ] Confirm the **Deploy documentation site** workflow
      (`.github/workflows/pages.yml`) succeeded on `main` and verify
      `https://ductrungdoit.github.io/Slacktor/privacy-policy.html`.
- [ ] Add the release to `apps/site/src/content/changelog.ts` with its date.
- [ ] Register and verify the Chrome Web Store developer account email.
- [ ] Run `npm run release`.
- [ ] Load the unpacked `dist/extension/` build in a clean Chrome profile.
- [ ] Confirm the disclosure appears before Slack content is processed.
- [ ] Test provider permission, Quick Translator, Slack auto-translation, stop,
      retry, cache clearing, history clearing, and logs clearing.
- [ ] Capture at least one 1280x800 or 640x400 screenshot.
- [ ] Upload the ZIP matching the current version from `release/`.
- [ ] Open the published GitHub Release and confirm its Assets section contains
      `Slacktor-<version>.zip`; GitHub's generated Source code archives are not
      extension packages.
- [ ] Download the published asset, extract it, and confirm `manifest.json` is
      at the extracted directory root before sharing installation instructions.
- [ ] Complete listing, privacy practices, distribution, and reviewer test
      instructions using `docs/release/chrome-web-store-listing.md`.
- [ ] Start as Unlisted for beta validation, then switch to Public when ready.
