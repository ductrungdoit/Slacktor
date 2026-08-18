# Inspecting Thread Context

Open a Slack page, then open DevTools Console. Slacktor installs the read-only
`CheckContext(url)` command automatically. Pass a Slack permalink for a thread
reply or its thread root:

```js
await CheckContext(
  "https://workspace.slack.com/archives/C01234567/p1785312156202579"
)
```

The result includes:

- `context`: the exact prior messages selected for this target. It is expected
  to be empty when the URL belongs to the thread root.
- `storedThreadMessages`: replies Slacktor has persisted for the detected thread.
- `threadRootTs` and `threadKey`: the thread identity extracted from Slack DOM.
- `reason`: why no context was selected.

For a real context test, pass the permalink of a **reply**, not the root. If a
reply still has no `threadRootTs`, copy that reply's outer HTML and its
thread-panel parent HTML; the Slack adapter needs an additional public-DOM
selector for that Slack view.
