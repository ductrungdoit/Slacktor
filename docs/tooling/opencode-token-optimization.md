# OpenCode Token Optimization Runbook

## Scope

This runbook optimizes OpenCode usage while working on Slacktor. It does not change Slacktor's AI prompts, thread context, translation cache, summary flow, or provider requests. Runtime token optimization for Slacktor must be handled in a separate session.

## Goals

- Reduce old conversation history sent to the model.
- Prevent large tool output from entering the session context.
- Avoid repeating stable Slacktor project information in every prompt.
- Reuse short commands for recurring validation and release work.
- Keep one authoritative OpenCode configuration file.

## Applied Configuration

The authoritative global configuration is:

```text
C:\Users\admin\.config\opencode\opencode.json
```

The duplicate file below has been removed:

```text
C:\Users\admin\.config\opencode\opencode.jsonc
```

The following settings have been added to `opencode.json`:

```json
{
  "compaction": {
    "auto": true,
    "tail_turns": 8
  },
  "tool_output": {
    "max_lines": 300,
    "max_bytes": 16000
  }
}
```

Do not change the configured primary or small model as part of this runbook. Do not move or rotate provider credentials unless separately requested.

## Configuration Meaning

### Automatic Compaction

`compaction.auto` allows OpenCode to summarize old session history instead of retaining every turn verbatim.

`compaction.tail_turns: 8` keeps the eight most recent turns intact. This is enough for current implementation context while reducing input growth in long sessions.

### Tool Output Limits

`tool_output.max_lines: 300` and `tool_output.max_bytes: 16000` prevent oversized build logs, generated bundles, minified files, and search results from consuming the context window.

When more output is needed, inspect a targeted file range or use a narrower search instead of increasing the global limits.

## Project Context

The project guide is stored at:

```text
C:\repo\Slacktor\AGENTS.md
```

Keep this file short and limited to stable facts:

- Build and release commands.
- Main source directories.
- Security and privacy constraints.
- Chrome Web Store version requirements.

Do not add task history, release notes, copied logs, current bug details, or long architectural explanations. Those details should stay in task-specific documents or the active session.

## Reusable Commands

Project commands are stored under:

```text
C:\repo\Slacktor\.opencode\command
```

Available commands:

```text
/release
/check-extension
/store-package
```

### `/release`

Use after source and version changes. It builds, packages, and verifies the current version without committing or uploading.

### `/check-extension`

Use after implementation changes. Pass a narrow scope when possible:

```text
/check-extension Quick Translator draft clearing
```

It inspects relevant changes, builds the extension, and checks permissions, privacy, logging, and remote-code constraints.

### `/store-package`

Use before uploading to Chrome Web Store:

```text
/store-package C:\repo\Slacktor\release\Slacktor-0.1.1.zip
```

It verifies archive structure, version, expected assets, and credential leakage without publishing.

## Session Workflow

### Start A New Session

Start a new OpenCode session when the work changes category, for example:

- Extension implementation.
- Chrome Web Store submission.
- Image or listing preparation.
- OpenCode configuration.
- Slacktor AI token optimization.

Do not continue an implementation task in a Store-listing conversation merely because the repository is the same.

### Initial Prompt

Keep the first prompt narrowly scoped and refer to files rather than pasting their content:

```text
Optimize Quick Translator API usage. Follow AGENTS.md. Inspect only the quick translation service, related shared types, and tests. Implement and verify the change.
```

Avoid prompts that request a review of the entire repository unless that scope is genuinely required.

### During Work

- Ask OpenCode to inspect specific files or a specific feature.
- Prefer `Glob` and `Grep` over reading complete directories.
- Read focused file ranges when a file is large.
- Avoid printing generated bundles or full dependency trees.
- Run focused checks before broad release commands.
- Use a subagent only for distinct parallel work, not to duplicate the main investigation.
- Do not paste repeated summaries from earlier sessions when `AGENTS.md` or a runbook already contains the stable facts.

### End A Session

End the session after implementation and verification are complete. Record durable follow-up work in a short Markdown task file only when another session genuinely needs it.

A handoff should contain only:

- Objective.
- Completed changes.
- Remaining work.
- Exact files and commands needed next.
- Known blockers.

Do not include the full conversation, raw build logs, or large code excerpts.

## Recommended Task Separation

Use separate sessions for these tasks:

1. OpenCode configuration and workflow optimization.
2. Slacktor translation-context token optimization.
3. Quick Translator request and cache optimization.
4. Token usage measurement and UI statistics.
5. Chrome Web Store release preparation.

This separation makes compaction more effective because each session contains one technical vocabulary and one set of relevant files.

## Verification

After changing OpenCode configuration:

1. Confirm `opencode.json` is valid JSON.
2. Confirm `opencode.jsonc` no longer exists.
3. Confirm `compaction.auto` is `true`.
4. Confirm `compaction.tail_turns` is `8`.
5. Confirm `tool_output.max_lines` is `300`.
6. Confirm `tool_output.max_bytes` is `16000`.
7. Confirm `AGENTS.md` exists at the Slacktor repository root.
8. Confirm all three command files exist under `.opencode/command/`.
9. Quit and restart OpenCode because configuration and command files are loaded only at startup.

## Rollback

If the tool-output limit hides information needed for debugging, use narrower reads and searches first. If necessary, temporarily increase only the relevant limit in `opencode.json`, then restart OpenCode.

If compaction removes useful recent context, increase `tail_turns` from `8` to `10` or `12`. Do not disable compaction by default.

If a project command becomes outdated, update or remove the individual Markdown command. Do not put task-specific instructions into the global configuration.

## Completion Criteria

OpenCode optimization is complete when:

- One global configuration file remains.
- Automatic compaction and tool-output limits are active after restart.
- Slacktor's stable instructions are available in `AGENTS.md`.
- Recurring validation and packaging tasks use project commands.
- New work is split into focused sessions with concise handoffs.
- No Slacktor runtime AI behavior has been changed in this optimization task.
