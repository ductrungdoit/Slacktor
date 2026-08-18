# Slacktor Architecture Reference

This project follows the reviewed Slack AI Translator specification. The full
design is intentionally retained here as an implementation reference; Milestone
1 validates DOM identity extraction before provider, cache, context, or queue
implementations are introduced.

## Non-Negotiable Rules

- Read Slack through public DOM, attributes, and permalinks only in the MVP.
- Do not use Slack's internal Redux state or inject page-context code.
- Use `MutationObserver`, not DOM polling.
- Never use DOM offsets or element indexes as persistent Slack identifiers.
- Fail safe if an author identity is unknown: no auto translation and no context.
- Keep all future Slack selectors in `src/content/slack-adapter.ts`.
- Store settings in `chrome.storage.local` with `TRUSTED_CONTEXTS`; context,
  translations, and jobs belong in IndexedDB when those milestones begin.
- A future AI request must be issued only by the background worker.

## Milestone 1 Acceptance Criteria

1. Record which public DOM sources yield a stable message ID, workspace ID,
   conversation ID, author ID, and thread root timestamp.
2. Test initial page load, channel navigation, a thread panel, edits, and DOM
   virtualization while scrolling.
3. Document selector failures and fall back to one-message, no-context behavior.
4. Confirm extension-owned Shadow DOM is ignored by the observer.

## Deferred Architecture

The planned context/cache implementation uses thread-root identity, snapshot
context no newer than the target message, exclusion-aware filtering, deterministic
cache keys, and an IndexedDB-backed MV3-resilient queue. It must not be added
until Milestone 1 validates the identifiers it depends on.

## Locked Decisions For Later Milestones

### Storage and Security

- `chrome.storage.local` holds small settings and provider configuration only.
- IndexedDB is the sole source for collected context, translation cache, message
  exclusions, and persisted jobs.
- Context retention and translation-cache retention use separate TTL settings.
- Context is retained for 30 days after the thread's last observed activity;
  translation cache entries expire after 7 days.
- `chrome.storage.local` is restricted to trusted extension contexts. Content
  scripts obtain public, non-secret settings through background messaging.
- The Options page may configure a key, but neither it nor the background may
  expose a key through messages to a content script. Only the background sends
  AI requests.
- AI host access is requested at runtime for the exact configured origin. The
  manifest declares `http://*/*` and `https://*/*` only as optional patterns;
  it does not grant wildcard access by default.

### Context and Cache

- Context for a target includes every eligible persisted message in the same
  thread, including later replies, but never the target itself. This provides
  full-discussion context for translating references in long-running threads.
- A target that is the thread root has no thread context.
- A root that fails the privacy policy is never sent. Eligible replies may form
  `partial-thread-context`; otherwise the plan is `none`.
- `includeThreadContext: false` always produces a `none` plan before any thread
  data is considered.
- Context prompt messages record the exact prompt text. If a root is truncated,
  its truncated text, rather than its original text, is fingerprinted.
- A thread key has the canonical form
  `workspaceId:conversationId:threadRootTs`. If no stable root timestamp is
  available, no thread key is created and scheduling falls back to the message.
- Translation cache identity includes message/source hash, target language,
  provider, model, style, and prompt version. A full key additionally includes
  context and filter fingerprints; its deterministic hash is the cache entry ID.
- Filter fingerprints include global filtering settings plus the per-conversation
  message-exclusion revision. Adding or removing a per-message exclusion bumps
  that revision, preventing old context-aware cache entries from being reused.
- Fallback cache lookup requires a matching current filter fingerprint. It then
  prefers `thread`, then `partial-thread-context`, then `none`, and finally the
  newest entry. Expired or invalidated entries are never selected.

### Privacy and Exclusions

- Author identity that cannot be resolved is fail-safe: no automatic translation,
  bulk translation, or use as context. Manual translation requires an explicit,
  one-request confirmation.
- Slack member-ID exclusions and one-message exclusions are separate policies.
  Both prevent a message from being sent as a target or context.
- Existing cache entries are not physically deleted when a filter changes, but
  entries created under an older filter fingerprint are not selected normally.
- `cancelInFlightOnPrivacyChange`, when enabled, aborts only requests whose
  target or already-selected context is directly affected by the changed policy.

### Queue Lifecycle

- Global concurrency is limited; true threads are serialized by thread key.
  Messages without a stable thread key use a unique per-message scheduling key.
- Persisted jobs include target identity, source hash, origin (`manual`, `auto`,
  or `bulk`), and whether an unknown-author manual confirmation occurred.
- On service-worker restart, queued jobs are reloaded. Interrupted running jobs
  are requeued only within a bounded retry count. Before retrying, the background
  rehydrates the target, reapplies current policy, rebuilds context, and checks
  the current deterministic cache entry. It never reuses a stale saved prompt.
