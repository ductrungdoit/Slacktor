export type AuthorIdentity =
  | { status: "resolved"; memberId: string; displayName?: string }
  | { status: "unknown"; reason: "not-present-in-dom" | "ambiguous" | "parse-failed" }

export type RawSlackMessage = {
  workspaceId?: string
  conversationId?: string
  threadRootTs?: string
  messageId: string
  timestamp?: string
  messageKind: "channel" | "dm" | "thread-reply" | "unknown"
  author: AuthorIdentity
  sourceText: string
  isBot: boolean
  isSystemMessage: boolean
  isDirectMessage: boolean
}

export type ThreadContextMessage = {
  messageId: string
  timestamp: string
  authorName?: string
  sourceText: string
}

export type ThreadContextPlan = {
  summary?: string
  recentMessages: ThreadContextMessage[]
}
