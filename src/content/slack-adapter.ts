import type { AuthorIdentity, RawSlackMessage } from "../shared/types"

// Slack does not publish stable DOM contracts. Keep all observed selectors here
// so Milestone 1 changes remain isolated from the observer and renderer.
const MESSAGE_CONTAINER_SELECTOR = "[data-qa='message_container']"
const FALLBACK_MESSAGE_SELECTOR = "[data-message-id], .c-message_kit__message[data-ts]"
const MESSAGE_SELECTOR = `${MESSAGE_CONTAINER_SELECTOR}, ${FALLBACK_MESSAGE_SELECTOR}`

const SYSTEM_SELECTOR = [
  "[data-message-type='system']",
  "[data-subtype='channel_join']",
  "[data-subtype='channel_leave']",
  "[data-subtype='channel_topic']",
  "[data-subtype='channel_purpose']",
  "[data-subtype='channel_name']",
  "[data-subtype='group_join']",
  "[data-subtype='group_leave']",
  "[data-qa='channel_join']",
  "[data-qa='channel_leave']",
  "[data-qa='message_system']",
  "[data-qa='date_divider']",
  "[data-qa='notification']",
  ".c-message__body--automated",
  ".c-message_kit__message--automated",
  ".c-message_kit__tombstone",
  ".c-message_kit__tombstone__text",
  "[data-qa='message_sender_app_badge']",
  ".c-message_kit__gutter__right--system",
].join(", ")

const SYSTEM_SUBTYPES = new Set([
  "channel_archive",
  "channel_join",
  "channel_leave",
  "channel_name",
  "channel_purpose",
  "channel_topic",
  "group_join",
  "group_leave",
  "me_message",
  "tombstone",
])

export function findMessageNodes(root: ParentNode = document): HTMLElement[] {
  // Slack's real message containers exist independently in the channel and
  // thread-panel virtual lists. Prefer them unconditionally: the previous
  // outermost-candidate rule let a broad data-message-id wrapper swallow all
  // reply containers, so only a thread root reached IndexedDB.
  const containers = Array.from(root.querySelectorAll<HTMLElement>(MESSAGE_CONTAINER_SELECTOR))
  if (containers.length > 0) return containers

  return Array.from(root.querySelectorAll<HTMLElement>(FALLBACK_MESSAGE_SELECTOR)).filter((node) => {
    if (node.hasAttribute("data-slacktor-translation")) return false
    return node.closest<HTMLElement>(FALLBACK_MESSAGE_SELECTOR) === node
  })
}

export function extractMessage(node: HTMLElement): RawSlackMessage | undefined {
  if (isSystemOrDisplayNode(node)) return undefined

  const timestamp = findMessageTimestamp(node)
  const messageId = node.dataset.messageId ?? timestamp ?? findMessageId(node)
  if (!messageId) return undefined

  const textNode = getTextNode(node)
  if (!textNode) return undefined

  const sourceText = getSourceText(textNode)
  if (!sourceText) return undefined

  const author = extractAuthor(node)
  const threadRootTs = node.dataset.threadTs ?? node.dataset.threadRootTs ?? extractThreadRootFromPermalink(node)
    ?? extractThreadRootFromCurrentPage(messageId)

  return {
    workspaceId: node.dataset.workspaceId,
    conversationId: node.dataset.msgChannelId ?? node.dataset.channelId,
    threadRootTs,
    messageId,
    timestamp,
    messageKind: threadRootTs ? "thread-reply" : "unknown",
    author,
    sourceText,
    isBot: node.dataset.botId !== undefined || node.dataset.subtype === "bot_message",
    isSystemMessage: false,
    isDirectMessage: false,
  }
}

function getSourceText(textNode: HTMLElement): string {
  const clone = textNode.cloneNode(true) as HTMLElement
  for (const injected of Array.from(clone.querySelectorAll("[data-slacktor-translation], [data-slacktor-translate-action]"))) {
    injected.remove()
  }
  return extractStructuredText(clone)
}

const LINE_BREAK_ELEMENTS = new Set([
  "BLOCKQUOTE", "LI", "OL", "P", "PRE", "UL",
])

function extractStructuredText(root: HTMLElement): string {
  let text = ""
  const appendBreak = () => {
    if (text && !text.endsWith("\n")) text += "\n"
  }
  const visit = (node: Node) => {
    if (node instanceof Text) {
      text += node.data
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.tagName === "BR") {
      text += "\n"
      return
    }
    const isBlock = LINE_BREAK_ELEMENTS.has(node.tagName) || (
      node !== root && (
        node.classList.contains("p-rich_text_section") ||
        node.classList.contains("p-rich_text_list") ||
        node.classList.contains("p-rich_text_quote") ||
        node.classList.contains("p-rich_text_preformatted")
      )
    )
    if (isBlock) appendBreak()
    for (const child of Array.from(node.childNodes)) visit(child)
    if (isBlock) appendBreak()
  }
  visit(root)
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function getTranslationAnchor(node: HTMLElement): HTMLElement | undefined {
  const textNode = getTextNode(node)
  if (!textNode) return undefined

  // A Slack message can contain several rich-text sections, lists, headers, or
  // block-kit blocks. Appending to the first section inserts translation in the
  // middle of a long message. Use message-text as the single outer anchor so
  // translation is always added after every original block.
  return textNode
}

export function isMessageCandidate(node: HTMLElement): boolean {
  return node.matches(MESSAGE_CONTAINER_SELECTOR) || (
    !node.closest<HTMLElement>(MESSAGE_CONTAINER_SELECTOR) && node.matches(FALLBACK_MESSAGE_SELECTOR)
  )
}

function getTextNode(node: HTMLElement): HTMLElement | undefined {
  // querySelector with a combined selector returns the first DOM match, not
  // the selector listed first. Slack's message_content appears before its
  // block-kit/message-text descendant, so query each preferred text container
  // explicitly to avoid sending sender names and timestamps to the AI.
  return (
    node.querySelector<HTMLElement>("[data-qa='message-text']") ??
    node.querySelector<HTMLElement>(".p-rich_text_section") ??
    node.querySelector<HTMLElement>(".c-message__body") ??
    undefined
  )
}

function findMessageId(node: HTMLElement): string | undefined {
  return node.querySelector<HTMLElement>("[data-message-id], [data-ts]")?.dataset.messageId
    ?? node.querySelector<HTMLElement>("[data-message-id], [data-ts]")?.dataset.ts
}

function findMessageTimestamp(node: HTMLElement): string | undefined {
  const permalink = node.querySelector<HTMLAnchorElement>("a.c-timestamp[href*='/p']")?.href
  if (permalink) {
    try {
      const match = new URL(permalink).pathname.match(/\/p(\d{10})(\d{6})(?:\/|$)/)
      if (match) return `${match[1]}.${match[2]}`
    } catch {
      // Fall back to Slack's nested timestamp attributes.
    }
  }

  const direct = node.dataset.msgTs ?? node.dataset.ts
  if (direct) return normalizeSlackTimestamp(direct)

  // Thread wrappers can contain data-ts values for the thread root. Only use
  // this broad fallback when the message's own timestamp permalink is absent.
  const nested = node.querySelector<HTMLElement>("[data-msg-ts], [data-ts]")
  const nestedTimestamp = nested?.dataset.msgTs ?? nested?.dataset.ts
  return nestedTimestamp ? normalizeSlackTimestamp(nestedTimestamp) : undefined
}

function normalizeSlackTimestamp(value: string): string {
  const permalinkMatch = value.match(/^p(\d{10})(\d{6})$/)
  return permalinkMatch ? `${permalinkMatch[1]}.${permalinkMatch[2]}` : value
}

function extractThreadRootFromPermalink(node: HTMLElement): string | undefined {
  const permalink = node.querySelector<HTMLAnchorElement>("a.c-timestamp[href*='thread_ts=']")?.href
  if (!permalink) return undefined

  try {
    return new URL(permalink).searchParams.get("thread_ts") ?? undefined
  } catch {
    return undefined
  }
}

function extractThreadRootFromCurrentPage(messageId: string): string | undefined {
  try {
    const url = new URL(window.location.href)
    const fromQuery = url.searchParams.get("thread_ts") ?? undefined
    if (fromQuery && fromQuery !== messageId) return fromQuery

    // Slack's client thread panel commonly uses /thread/<channel>-<root-ts>.
    // This is a public navigation value and supplies a stable fallback when the
    // timestamp permalink of an individual reply omits thread_ts.
    const routeMatch = url.pathname.match(/\/thread\/[^/]+-(\d{10}\.\d{6})/)
    if (routeMatch?.[1] && routeMatch[1] !== messageId) return routeMatch[1]
  } catch {
    // Keep the no-context fallback when Slack has an unexpected URL shape.
  }
  return undefined
}

function isSystemOrDisplayNode(node: HTMLElement): boolean {
  if (node.matches(SYSTEM_SELECTOR) || node.querySelector(SYSTEM_SELECTOR)) return true
  if (node.dataset.messageType === "system") return true
  if (node.dataset.subtype && SYSTEM_SUBTYPES.has(node.dataset.subtype)) return true
  if (node.dataset.botId !== undefined || node.dataset.subtype === "bot_message") return true
  if (node.querySelector("[data-qa='message_sender_app_badge'], .c-app_badge")) return true

  // Slack renders app lifecycle notices (for example "added an integration") as
  // message containers. They are not user-authored content and must never reach
  // translation even though they have a timestamp and a visible body.
  if (node.querySelector(
    ".c-message__body--automated, .c-message_kit__message--automated, .c-message_kit__tombstone, .c-message_kit__tombstone__text",
  )) {
    return true
  }

  const ariaLabel = node.getAttribute("aria-label")?.toLowerCase() ?? ""
  if (ariaLabel.includes("system message") || ariaLabel.includes("channel activity")) return true

  const qa = node.dataset.qa?.toLowerCase() ?? ""
  return qa.includes("system") || qa.includes("notification") || qa.includes("date_divider")
}

function extractAuthor(node: HTMLElement): AuthorIdentity {
  const memberId =
    node.dataset.memberId ??
    node.dataset.userId ??
    node.querySelector<HTMLElement>("[data-message-sender]")?.dataset.messageSender
  const displayName = node.querySelector<HTMLElement>("[data-qa='message_sender']")?.dataset.stringifyText
  if (memberId) return { status: "resolved", memberId, displayName }

  return { status: "unknown", reason: "not-present-in-dom" }
}
