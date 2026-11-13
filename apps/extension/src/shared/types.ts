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
  isEdited?: boolean
  isStreaming?: boolean
  isExpanded?: boolean
  skipAutoTranslateReason?: string
}

export type ThreadContextMessage = {
  messageId: string
  timestamp: string
  authorName?: string
  sourceText: string
  translatedText?: string
  isThreadRoot?: boolean
}

export type ThreadContextPlan = {
  scopeType?: "thread" | "channel"
  summary?: string
  rootMessage?: ThreadContextMessage
  channelBridgeMessages?: ThreadContextMessage[]
  recentMessages: ThreadContextMessage[]
}

export function normalizeSlackMessageId(value: string): string {
  const permalinkMatch = value.match(/^p(\d{10})(\d{6})$/)
  return permalinkMatch ? `${permalinkMatch[1]}.${permalinkMatch[2]}` : value
}
