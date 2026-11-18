# Slacktor internal documentation

Notes for people working on Slacktor. These files are not published.

The public site (home, about, changelog, privacy policy) is a React app in
[`apps/site/`](../apps/site) and is deployed to
https://ductrungdoit.github.io/Slacktor/ by
[`.github/workflows/pages.yml`](../.github/workflows/pages.yml).

## Architecture

- [Overview](architecture/overview.md): non-negotiable rules and locked
  decisions for storage, context, cache, privacy, and the translation queue.
- [Debugging thread context](architecture/debugging-thread-context.md): the
  `CheckContext(url)` console helper.

## Release

- [Checklist](release/checklist.md): steps before each Chrome Web Store upload.
- [Chrome Web Store listing](release/chrome-web-store-listing.md): listing copy,
  permission justifications, and reviewer instructions.

## Tooling

- [OpenCode token optimization](tooling/opencode-token-optimization.md): agent
  workflow notes for working on this repository.
