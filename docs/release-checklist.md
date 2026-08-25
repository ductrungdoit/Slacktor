# Chrome Web Store Release Checklist

- [ ] Enable GitHub Pages from `main` / `docs` and verify
      `https://ductrungdoit.github.io/Slacktor/privacy-policy.html`.
- [ ] Register and verify the Chrome Web Store developer account email.
- [ ] Run `npm run release`.
- [ ] Load the unpacked `dist/` build in a clean Chrome profile.
- [ ] Confirm the disclosure appears before Slack content is processed.
- [ ] Test provider permission, Quick Translator, Slack auto-translation, stop,
      retry, cache clearing, history clearing, and logs clearing.
- [ ] Capture at least one 1280x800 or 640x400 screenshot.
- [ ] Upload the ZIP matching the current version from `release/`.
- [ ] Complete listing, privacy practices, distribution, and reviewer test
      instructions using `docs/store-listing.md`.
- [ ] Start as Unlisted for beta validation, then switch to Public when ready.
