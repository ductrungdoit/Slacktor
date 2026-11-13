import type { AuthorIdentity, RawSlackMessage } from "../shared/types"

// Slack does not publish stable DOM contracts. Keep all observed selectors here
// so Milestone 1 changes remain isolated from the observer and renderer.

// ============================================================================
// Slacktor Markers and Attributes
// ============================================================================
export const SLACKTOR_TRANSLATION_ATTR = "data-slacktor-translation"
export const SLACKTOR_ACTION_ATTR = "data-slacktor-translate-action"
export const SLACKTOR_INJECTED_SELECTOR = `[${SLACKTOR_TRANSLATION_ATTR}], [${SLACKTOR_ACTION_ATTR}]`

// ============================================================================
// Message Containers and Candidates
// ============================================================================
const MESSAGE_CONTAINER_SELECTOR = "[data-qa='message_container']"
const FALLBACK_MESSAGE_SELECTOR = "[data-message-id], .c-message_kit__message[data-ts]"
const MESSAGE_SELECTOR = `${MESSAGE_CONTAINER_SELECTOR}, ${FALLBACK_MESSAGE_SELECTOR}`

// ============================================================================
// Message Body and Text Containers
// ============================================================================
const MESSAGE_TEXT_SELECTOR = "[data-qa='message-text']"
const RICH_TEXT_SECTION_SELECTOR = ".p-rich_text_section"
const MESSAGE_BODY_SELECTOR = ".c-message__body"
const MESSAGE_COMMENT_SELECTOR = ".c-message_kit__comment"
const AUTOMATED_MESSAGE_BODY_SELECTOR = ".c-message__body--automated"
const MESSAGE_BODY_BLOCK_SELECTOR = `${MESSAGE_TEXT_SELECTOR}, ${MESSAGE_BODY_SELECTOR}, ${MESSAGE_COMMENT_SELECTOR}, ${AUTOMATED_MESSAGE_BODY_SELECTOR}`

// ============================================================================
// Forwarded Messages and Attachments
// ============================================================================
const FORWARDED_CARD_SELECTOR = "[data-qa='forwarded_message_card']"
const ATTACHMENT_SELECTOR = ".c-message_attachment"
const ATTACHMENTS_CONTAINER_SELECTOR = ".c-message_kit__attachments"
const ATTACHMENT_WRAPPER_SELECTOR = ".c-message_kit__attachment"
const ATTACHMENT_DEFAULT_SELECTOR = "[data-qa='message_attachment_default']"

const FORWARDED_AND_ATTACHMENTS_SELECTOR = `${FORWARDED_CARD_SELECTOR}, ${ATTACHMENT_SELECTOR}:not([${SLACKTOR_TRANSLATION_ATTR}] *)`
const FORWARDED_CARD_PARENT_CHECK_SELECTOR = `${FORWARDED_CARD_SELECTOR}, ${ATTACHMENT_SELECTOR}`
const FORWARDED_AUTHOR_SELECTOR = [
  "[data-qa='message_attachment_author_name']",
  "[data-qa='member_name']",
  "[data-qa='message_sender_name']",
  ".c-message_attachment__author_name",
  "[class*='authorName__']",
].join(", ")
const FORWARDED_HEADER_SELECTOR = [
  "[class*='headerRow__']",
  "[class*='byline__']",
  "[class*='context__']",
  ".c-message_attachment__footer",
  ".c-message_attachment__footer_ts",
  "[data-qa='attachment-footer-timestamp']",
  "[class*='authorName__']",
  "[class*='timestamp__']",
  "[class*='footer__']",
].join(", ")
const FORWARDED_CONTENT_SELECTOR = [
  "[data-qa='message_attachment_slack_msg_text']",
  ".p-sui-share-dialog-blocks",
  "[class*='body__']",
  ".c-message_attachment__text",
].join(", ")
const RICH_TEXT_BLOCK_OR_SECTION_SELECTOR = ".p-rich_text_block, .p-rich_text_section"
const EXCLUDED_ATTACHMENT_CONTAINERS_SELECTOR = `${ATTACHMENTS_CONTAINER_SELECTOR}, ${ATTACHMENT_WRAPPER_SELECTOR}, ${ATTACHMENT_SELECTOR}, ${FORWARDED_CARD_SELECTOR}`
export const TRANSLATION_ANCHOR_ATTACHMENTS_SELECTOR = `${ATTACHMENTS_CONTAINER_SELECTOR}, ${ATTACHMENT_WRAPPER_SELECTOR}, ${ATTACHMENT_DEFAULT_SELECTOR}`
// ============================================================================
// Structured Text Classes & Attributes
// ============================================================================
const CLASS_EXPAND_BUTTON = "c-rich_text_expand_button"
const CLASS_MESSAGE_KIT_FILE = "c-message_kit__file"
const CLASS_MESSAGE_KIT_REACTION_BAR = "c-message_kit__reaction_bar"
const CLASS_MESSAGE_KIT_BLOCKS = "c-message_kit__blocks"
const CLASS_MRKDWN_PRE = "c-mrkdwn__pre"
const CLASS_MRKDWN_QUOTE = "c-mrkdwn__quote"
const CLASS_LIST = "p-rich_text_list"
const CLASS_CHECK_ICON = "p-rich_text_list__check_icon"
const CLASS_RICH_TEXT_SECTION = "p-rich_text_section"
const CLASS_TIMESTAMP = "c-timestamp"
const CLASS_MRKDWN_BR = "c-mrkdwn__br"
const CLASS_MEMBER_SLUG = "c-member_slug"
const CLASS_USER_GROUP = "c-user_group"
const CLASS_BROADCAST = "c-broadcast"
const CLASS_CHANNEL_NAME = "c-channel_name"
const CLASS_MRKDWN_CHANNEL = "c-mrkdwn__channel"
const CLASS_INTERNAL_CHANNEL_LINK = "internal_channel_link"
const CLASS_MESSAGE_EDITED_LABEL = "c-message__edited_label"
const STRINGIFY_PARAGRAPH_BREAK = "paragraph-break"
const STRINGIFY_LINE_BREAK = "line-break"
const ATTR_DATA_MEMBER_ID = "data-member-id"
const ATTR_DATA_CHANNEL_ID = "data-channel-id"
const ATTR_DATA_CHANNEL_NAME = "data-channel-name"
const DATA_QA_CHANNEL_LINK = "channel_link"
const DATA_QA_RICH_TEXT_HEADER = "bk_rich_text_header"
const DATA_QA_RICH_TEXT_DIVIDER = "bk_rich_text_divider"
const NESTED_LIST_PARENT_SELECTOR = "li"

// ============================================================================
// Media, File Attachments and Inline File Selectors & Classes
// ============================================================================
const CLASS_FILES_CONTAINER = "c-files_container"
const CLASS_FILE_GALLERY = "c-file_gallery"
const CLASS_FILE_GALLERY_IMAGE = "c-file_gallery_image_file"
const CLASS_MESSAGE_GALLERY_IMAGE = "p-message_gallery_image_file"
const CLASS_MESSAGE_KIT_FILE_META = "c-message_kit__file__meta"
const CLASS_FILE_ACTIONS = "c-file__actions"
const CLASS_FILE_NAME = "c-file_name"
const CLASS_FILE_IMAGE_THUMBNAIL_WRAPPER = "p-file_image_thumbnail__wrapper"

const ATTR_UNFURL_DELETE_TARGET = "data-unfurl-delete-target"
const DATA_QA_RICH_TEXT_FILE_ELEMENT = "rich_text_file_element"
const DATA_QA_MESSAGE_KIT_FILES = "message_kit_files"
const DATA_QA_MESSAGE_FILE_THUMBNAIL = "message_file_image_thumbnail"
const DATA_QA_FILE_ACTIONS = "file_actions"
const DATA_QA_DOWNLOAD_ACTION = "download_action"
const DATA_QA_FILE_NAME = "file_name"

const CLASS_SUBSTRING_MEDIA = "media__"

const RICH_TEXT_FILE_ELEMENT_SELECTOR = `[data-qa='${DATA_QA_RICH_TEXT_FILE_ELEMENT}']`
const FILE_NAME_SELECTOR = `.${CLASS_FILE_NAME}, [data-qa='${DATA_QA_FILE_NAME}']`
const INLINE_FILE_PARENT_CONTAINERS_SELECTOR = `.${CLASS_FILES_CONTAINER}, [data-qa='${DATA_QA_MESSAGE_KIT_FILES}'], .${CLASS_MESSAGE_KIT_FILE}, .${CLASS_FILE_GALLERY}`

const MEDIA_AND_FILES_SELECTOR = [
  `[data-qa='${DATA_QA_MESSAGE_KIT_FILES}']`,
  `.${CLASS_FILES_CONTAINER}`,
  `.${CLASS_FILE_GALLERY}`,
  `.${CLASS_FILE_GALLERY_IMAGE}`,
  `.${CLASS_MESSAGE_KIT_FILE}`,
  `.${CLASS_MESSAGE_KIT_FILE_META}`,
  `.${CLASS_MESSAGE_GALLERY_IMAGE}`,
  `[data-qa='${DATA_QA_MESSAGE_FILE_THUMBNAIL}']`,
  `.${CLASS_FILE_IMAGE_THUMBNAIL_WRAPPER}`,
  `[${ATTR_UNFURL_DELETE_TARGET}]`,
  `.${CLASS_FILE_ACTIONS}`,
  `[data-qa='${DATA_QA_FILE_ACTIONS}']`,
  `[data-qa='${DATA_QA_DOWNLOAD_ACTION}']`,
  `[class*='${CLASS_SUBSTRING_MEDIA}']`,
  "a[href*='files.slack.com']",
  "a[href*='/files-pri/']",
  "a[href*='/files-tmb/']",
].join(", ")

const EDITED_LABEL_SELECTOR = `.${CLASS_MESSAGE_EDITED_LABEL}`

const NON_CONTENT_CHROME_SELECTOR = [
  "[data-qa='slackbot-conversation-footer']",
  "[data-qa='slackbot-conversation-thinking-indicator']",
  "[data-qa='agent-container']",
  "[data-qa='agent-container-legacy']",
  "[data-qa='agent-loading']",
  "[data-qa='message_send_on_behalf_attribution']",
  "[data-qa='message_agent_prompt_display']",
  ".c-message__broadcast_footer",
  ".c-message_kit__broadcast_footer",
  "[class*='translationContent__']",
  "[class*='loadingBarContainer__']",
].join(", ")

const MESSAGE_TRANSIENT_STATE_SELECTOR = [
  ".c-message_kit__background--editing",
  ".c-message_kit__background--deleting",
  ".c-message_kit__hidden_message_blur",
  "[data-qa='privacy-reveal-overlay']",
  "[class*='privacyBlurred']",
].join(", ")

const STREAMING_MESSAGE_SELECTOR = [
  "[data-qa='agent-loading']",
  "[data-qa='agent-loading-text']",
  "[data-qa='agent-loading-text-legacy']",
  "[data-qa='slackbot-conversation-thinking-indicator']",
  "[class*='loadingBarContainer__']",
].join(", ")

const TRUNCATION_EXPAND_BUTTON_SELECTOR = [
  `.${CLASS_EXPAND_BUTTON}`,
  ".c-message__message_blocks button[aria-expanded]",
  ".p-rich_text_block button[aria-expanded]",
].join(", ")

const CONVERSATION_BUBBLE_SELECTOR = "[data-qa='slackbot-conversation-bubble']"
const PARTICIPANT_SENDER_SELECTOR = "[class*='participantSender__']"

export const NON_TEXT_MUTATION_ZONE_SELECTOR = [
  ".c-message__actions",
  "[data-qa='message_actions']",
  `.${CLASS_MESSAGE_KIT_REACTION_BAR}`,
  ".c-message__reply_bar",
  ".c-message_kit__gutter__left",
  "[data-qa='slackbot-conversation-footer']",
  `[${SLACKTOR_TRANSLATION_ATTR}]`,
].join(", ")

export function stripEditedBadge(text: string): string {
  return text
    .replace(/(?:^|\s*)\((?:edited|đã chỉnh sửa|編集済み)\)\s*$/gi, "")
    .replace(/^\n+|\s+$/g, "")
}

// ============================================================================
// Permalinks, Timestamps, and Thread Navigation
// ============================================================================
const PERMALINK_MESSAGE_SELECTOR = "a.c-timestamp[href*='/p'], a[href*='/archives/'][href*='/p']"
const PERMALINK_ARCHIVES_SELECTOR = "a.c-timestamp[href*='/archives/'], a[href*='/archives/']"
const PERMALINK_THREAD_ROOT_SELECTOR = "a.c-timestamp[href*='thread_ts=']"
const BROADCAST_PREAMBLE_LINK_SELECTOR =
  "[data-qa*='broadcast'] a[href*='thread_ts='], .c-message__broadcast_preamble a[href*='thread_ts='], .c-message_kit__broadcast_preamble a[href*='thread_ts='], a.c-message__broadcast_preamble_link"
const ANY_THREAD_TS_LINK_SELECTOR = "a[href*='thread_ts=']"
const THREAD_LINK_EXCLUDE_CONTAINERS_SELECTOR = `${MESSAGE_TEXT_SELECTOR}, ${RICH_TEXT_SECTION_SELECTOR}, ${MESSAGE_BODY_SELECTOR}, ${FORWARDED_CARD_SELECTOR}, [${SLACKTOR_TRANSLATION_ATTR}]`

// ============================================================================
// Message Metadata & Senders (Data Attributes & Badges)
// ============================================================================
const MESSAGE_ID_DATA_SELECTOR = "[data-message-id], [data-ts]"
const MESSAGE_TS_DATA_SELECTOR = "[data-msg-ts], [data-ts]"
const MESSAGE_CHANNEL_DATA_SELECTOR = "[data-message-channel]"
const SENDER_DATA_SELECTOR = "[data-message-sender]"
const SENDER_QA_SELECTOR = "[data-qa='message_sender']"
const BOT_BADGE_SELECTOR = "[data-qa='message_sender_app_badge'], .c-app_badge"
const BOT_AVATAR_SERVICE_SELECTOR =
  "a.c-message_kit__avatar[href*='/services/'], a[href*='/services/']"
const SLACKBOT_MEMBER_ID = "USLACKBOT"
const BOT_ID_REGEX = /^B[A-Z0-9]+$/
const SLACKBOT_DOM_SELECTOR = [
  `[data-message-sender='${SLACKBOT_MEMBER_ID}']`,
  `[data-member-id='${SLACKBOT_MEMBER_ID}']`,
  "[data-qa='slackbot-conversation-bubble']",
  "[data-qa='slackbot-conversation-footer']",
  "[data-qa='agent-container']",
  "[data-qa='agent-container-legacy']",
  ".c-message_kit__avatar img[src*='slackbot_']",
  ".c-message_kit__avatar img[src*='/slackbot']",
].join(", ")

const ADJACENT_MESSAGE_INDICATOR_SELECTOR = [
  ".p-message_pane_message__compact_timestamp--adjacent",
  ".p-message_pane_message__compact_timestamp",
  ".p-thread_compact_gutter_generic--adjacent",
  ".p-thread_compact_gutter_generic",
  "[data-qa='thread_compact_gutter']",
  ".c-message_kit__gutter__left .c-timestamp",
].join(", ")

const VIRTUAL_LIST_ITEM_SELECTOR = [
  ".c-virtual_list__item",
  "[data-qa='virtual-list-item']",
  "[role='listitem']",
].join(", ")

// ============================================================================
// Display, Divider & Tombstone Selectors
// ============================================================================
const DATA_QA_DATE_DIVIDER = "date_divider"
const DATE_DIVIDER_SELECTOR = `[data-qa='${DATA_QA_DATE_DIVIDER}']`
const TOMBSTONE_SELECTOR = ".c-message_kit__tombstone, .c-message_kit__tombstone__text"
const STRINGIFY_IGNORE_ATTR = "data-stringify-ignore"

// ============================================================================
// Skip Detection Selectors
// ============================================================================
const MENTION_SELECTOR = `[data-stringify-type='mention'], .${CLASS_MEMBER_SLUG}, .${CLASS_USER_GROUP}, .${CLASS_BROADCAST}`
const EMOJI_SELECTOR = ".c-emoji, [data-stringify-type='emoji'], img"
const LINK_SELECTOR = "a[href]"
const IGNORED_TEXT_IN_SKIP_CHECK_SELECTOR = `[${STRINGIFY_IGNORE_ATTR}='true'], button, [${SLACKTOR_TRANSLATION_ATTR}], [${SLACKTOR_ACTION_ATTR}]`

// ============================================================================
// Skip Reason Messages (User Explanations)
// ============================================================================
export const SKIP_REASON_SYSTEM = "Not auto-translated: System message."
export const SKIP_REASON_BOT = "Not auto-translated: Bot or app message."
export const SKIP_REASON_EMPTY = "Not auto-translated: Empty message."
export const SKIP_REASON_NO_TEXT = "Not auto-translated: No translatable text."

// ============================================================================
// Regex Patterns
// ============================================================================
const PERMALINK_TS_REGEX = /\/p(\d{10})(\d{6})(?:\/|$|\?)/
const PERMALINK_PATHNAME_TS_REGEX = /\/p(\d{10})(\d{6})(?:\/|$)/
const PERMALINK_ARCHIVES_CID_REGEX = /\/archives\/([A-Z0-9]+)(?:\/|$|\?)/i
const PERMALINK_CID_PARAM_REGEX = /[?&]cid=([A-Z0-9]+)/i
const THREAD_TS_PARAM_REGEX = /[?&]thread_ts=([0-9.]+)/
const NORMALIZED_SLACK_TS_REGEX = /^p(\d{10})(\d{6})$/
const WORKSPACE_CLIENT_ROUTE_REGEX = /\/client\/([A-Z0-9]+)/i
const CHANNEL_CLIENT_ROUTE_REGEX = /\/client\/[^/]+\/([A-Z0-9]+)/i
const THREAD_PANEL_ROUTE_REGEX = /\/thread\/[^/]+-(\d{10}\.\d{6})/

// ============================================================================
// System Messages & Subtypes
// ============================================================================
const SYSTEM_SELECTOR = [
  "[data-qa='channel_join']",
  "[data-qa='channel_leave']",
  DATE_DIVIDER_SELECTOR,
  "[data-qa='notification']",
  ".c-message__body--automated",
  ".c-message_kit__tombstone",
  ".c-message_kit__tombstone__text",
  "[class*='systemMessage__']",
].join(", ")

export function findMessageNodes(root: ParentNode = document): HTMLElement[] {
  // Slack's real message containers exist independently in the channel and
  // thread-panel virtual lists. Prefer them unconditionally.
  const containers = Array.from(root.querySelectorAll<HTMLElement>(MESSAGE_CONTAINER_SELECTOR))
  if (containers.length > 0) return containers

  return Array.from(root.querySelectorAll<HTMLElement>(FALLBACK_MESSAGE_SELECTOR)).filter(
    (node) => {
      if (node.hasAttribute(SLACKTOR_TRANSLATION_ATTR)) return false
      return node.closest<HTMLElement>(FALLBACK_MESSAGE_SELECTOR) === node
    },
  )
}

export const MESSAGE_EDITOR_SELECTOR = [".c-message__editor", "[data-qa='message_editor']"].join(
  ", ",
)

function isTempSlackTimestamp(value: string | undefined): boolean {
  if (!value) return false
  // Slack's client-v2 module "vXJa" marks optimistic/unconfirmed timestamps with "x"
  return value.includes("x")
}

export function extractMessage(node: HTMLElement): RawSlackMessage | undefined {
  if (isIgnoredDisplayNode(node)) return undefined
  if (node.matches(MESSAGE_EDITOR_SELECTOR) || node.querySelector(MESSAGE_EDITOR_SELECTOR)) {
    return undefined
  }

  const timestamp = findMessageTimestamp(node)
  if (isTempSlackTimestamp(timestamp)) return undefined

  const messageId = node.dataset.messageId ?? timestamp ?? findMessageId(node)
  if (!messageId || isTempSlackTimestamp(messageId)) return undefined

  const conversationId = findConversationId(node)
  const threadRootTs =
    node.dataset.threadTs ??
    extractThreadRootFromPermalink(node) ??
    extractThreadRootFromCurrentPage(messageId)
  const clusterScopeKey =
    conversationId && threadRootTs ? `${conversationId}:${threadRootTs}` : conversationId
  const isSystem = isSystemMessageNode(node)
  const author = extractAuthor(node, clusterScopeKey, timestamp)
  const isBot = isBotNode(node, clusterScopeKey, timestamp)
  const isEdited = Boolean(node.querySelector(EDITED_LABEL_SELECTOR))
  const isStreaming = Boolean(node.querySelector(STREAMING_MESSAGE_SELECTOR))
  const isExpanded = Array.from(
    node.querySelectorAll<HTMLElement>(TRUNCATION_EXPAND_BUTTON_SELECTOR),
  ).some((btn) => btn.getAttribute("aria-expanded") === "true")

  const sourceText = extractFullMessageSourceText(node) ?? ""
  if (!sourceText && !isSystem && !isBot) return undefined

  const skipAutoTranslateReason = getMessageSkipReason(node, sourceText, isSystem, isBot)

  return {
    workspaceId:
      typeof window !== "undefined"
        ? window.location.pathname.match(WORKSPACE_CLIENT_ROUTE_REGEX)?.[1]
        : undefined,
    conversationId,
    threadRootTs,
    messageId,
    timestamp,
    messageKind: threadRootTs ? "thread-reply" : "unknown",
    author,
    sourceText,
    isBot,
    isSystemMessage: isSystem,
    isDirectMessage: false,
    isEdited,
    isStreaming,
    isExpanded,
    skipAutoTranslateReason,
  }
}

function extractFullMessageSourceText(node: HTMLElement): string | undefined {
  const parts: string[] = []

  // 1. Main message body
  const mainTextNode = getMainTextNode(node)
  if (mainTextNode) {
    const mainText = getSourceText(mainTextNode)
    if (mainText) parts.push(mainText)
  }

  // 2. Forwarded message cards and attachments
  const cards = Array.from(node.querySelectorAll<HTMLElement>(FORWARDED_AND_ATTACHMENTS_SELECTOR))

  for (const card of cards) {
    // Avoid double processing if card is nested inside another matched card
    if (card.parentElement?.closest(FORWARDED_CARD_PARENT_CHECK_SELECTOR)) continue

    const author = card.querySelector<HTMLElement>(FORWARDED_AUTHOR_SELECTOR)?.textContent?.trim()

    const contentNode =
      card.querySelector<HTMLElement>(FORWARDED_CONTENT_SELECTOR) ??
      Array.from(card.querySelectorAll<HTMLElement>(RICH_TEXT_BLOCK_OR_SECTION_SELECTOR)).find(
        (el) => !el.closest(FORWARDED_HEADER_SELECTOR),
      )

    if (contentNode) {
      const cardText = getForwardedSourceText(contentNode)
      if (cardText) {
        const header = author ? `↳ ${author}:` : "↳ Forwarded message:"

        const quoted = cardText
          .split("\n")
          .map((line) => (line.startsWith(">") ? `>${line}` : line ? `> ${line}` : ">"))
          .join("\n")

        parts.push(`> ${header}\n${quoted}`)
      }
    }
  }

  if (parts.length === 0) return undefined
  const combined = parts.join("\n\n").trim()
  return stripEditedBadge(stripMediaAndFileLinks(combined)) || undefined
}

function getForwardedSourceText(textNode: HTMLElement): string {
  const clone = textNode.cloneNode(true) as HTMLElement
  for (const el of Array.from(
    clone.querySelectorAll(
      `${SLACKTOR_INJECTED_SELECTOR}, ${FORWARDED_HEADER_SELECTOR}, ${MEDIA_AND_FILES_SELECTOR}, ${EDITED_LABEL_SELECTOR}, ${NON_CONTENT_CHROME_SELECTOR}`,
    ),
  )) {
    el.remove()
  }
  return stripEditedBadge(extractStructuredText(clone))
}

function getMainTextNode(node: HTMLElement): HTMLElement | undefined {
  const messageBlocks = Array.from(node.querySelectorAll<HTMLElement>(MESSAGE_BODY_BLOCK_SELECTOR))
  const mainBlock = messageBlocks.find((el) => !el.closest(EXCLUDED_ATTACHMENT_CONTAINERS_SELECTOR))
  if (mainBlock) return mainBlock

  // If no message-text, only look for p-rich_text_section outside attachments
  const sections = Array.from(node.querySelectorAll<HTMLElement>(RICH_TEXT_SECTION_SELECTOR))
  return sections.find((s) => !s.closest(EXCLUDED_ATTACHMENT_CONTAINERS_SELECTOR))
}

function getSourceText(textNode: HTMLElement): string {
  const clone = textNode.cloneNode(true) as HTMLElement
  for (const el of Array.from(
    clone.querySelectorAll(
      `${SLACKTOR_INJECTED_SELECTOR}, ${MEDIA_AND_FILES_SELECTOR}, ${EDITED_LABEL_SELECTOR}, ${NON_CONTENT_CHROME_SELECTOR}`,
    ),
  )) {
    el.remove()
  }
  return stripEditedBadge(extractStructuredText(clone))
}

function getInlineFileName(node: HTMLElement): string | undefined {
  if (node.closest(INLINE_FILE_PARENT_CONTAINERS_SELECTOR)) {
    return undefined
  }

  // Explicit inline file chip element in Slack rich text
  const isFileSlug = node.getAttribute("data-qa") === DATA_QA_RICH_TEXT_FILE_ELEMENT

  const href = node.getAttribute("href") ?? ""
  const isFileLink =
    node.tagName === "A" &&
    (Boolean(node.querySelector(RICH_TEXT_FILE_ELEMENT_SELECTOR)) ||
      href.includes(".slack.com/files/") ||
      href.includes("files.slack.com/") ||
      href.includes("/files-pri/") ||
      href.includes("/files-tmb/"))

  if (!isFileSlug && !isFileLink) {
    return undefined
  }

  const nameEl = node.querySelector<HTMLElement>(FILE_NAME_SELECTOR)
  const text = nameEl?.textContent?.trim()
  if (text) return text

  if (href) {
    const cleanPath = href.split("?")[0].split("#")[0]
    const segment = cleanPath.split("/").pop()
    if (segment && /\.[a-z0-9]{2,5}$/i.test(segment)) {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    }
  }

  const directText = node.textContent?.trim()
  if (directText && directText.length < 100 && /\.[a-z0-9]{2,5}$/i.test(directText)) {
    return directText
  }

  if (isFileSlug) {
    return "file"
  }

  return undefined
}

function isMediaOrFileNode(node: HTMLElement): boolean {
  if (
    node.getAttribute("data-qa") === DATA_QA_RICH_TEXT_FILE_ELEMENT ||
    Boolean(node.closest(RICH_TEXT_FILE_ELEMENT_SELECTOR))
  ) {
    return false
  }

  if (
    node.classList.contains(CLASS_MESSAGE_KIT_FILE) ||
    node.classList.contains(CLASS_FILES_CONTAINER) ||
    node.classList.contains(CLASS_FILE_GALLERY) ||
    node.classList.contains(CLASS_FILE_GALLERY_IMAGE) ||
    node.classList.contains(CLASS_MESSAGE_GALLERY_IMAGE) ||
    node.classList.contains(CLASS_MESSAGE_KIT_FILE_META) ||
    node.classList.contains(CLASS_FILE_ACTIONS) ||
    node.hasAttribute(ATTR_UNFURL_DELETE_TARGET) ||
    node.getAttribute("data-qa") === DATA_QA_MESSAGE_KIT_FILES ||
    node.getAttribute("data-qa") === DATA_QA_MESSAGE_FILE_THUMBNAIL ||
    node.getAttribute("data-qa") === DATA_QA_FILE_ACTIONS ||
    node.getAttribute("data-qa") === DATA_QA_DOWNLOAD_ACTION ||
    node.className?.includes?.(CLASS_SUBSTRING_MEDIA)
  ) {
    return true
  }

  if (node.tagName === "A") {
    const href = node.getAttribute("href") ?? ""
    if (
      href.includes("files.slack.com/") ||
      href.includes("/files-pri/") ||
      href.includes("/files-tmb/")
    ) {
      if (getInlineFileName(node)) return false
      return true
    }
  }

  return false
}

export function stripMediaAndFileLinks(raw: string): string {
  const cleaned = raw
    .replace(
      /\[[^\]\n]*\]\((?:https?:\/\/)?[^\s)\n]*(?:files\.slack\.com|\/files-pri\/|\/files-tmb\/)[^\s)\n]*\)/gi,
      "",
    )
    .replace(
      /\[[^\]\n]+\.(?:png|jpe?g|gif|webp|svg|bmp|pdf|zip|tar|gz|mp4|mov|avi|docx?|xlsx?|pptx?)(?:@[0-9]+x)?\]\((?!slack:\/\/file)[^)\n]+\)/gi,
      "",
    )
    .replace(
      /\[[^\]\n]+\.(?:png|jpe?g|gif|webp|svg|bmp|pdf|zip|tar|gz|mp4|mov|avi|docx?|xlsx?|pptx?)(?:@[0-9]+x)?\](?!\()/gi,
      "",
    )
    .replace(
      /&lt;https?:\/\/[^\s|&>]*(?:files\.slack\.com|\/files-pri\/|\/files-tmb\/)[^\s|&>]*(\|[^&>]*)?&gt;/gi,
      "",
    )
    .replace(
      /<https?:\/\/[^\s|>']*(?:files\.slack\.com|\/files-pri\/|\/files-tmb\/)[^\s|>']*(\|[^>']*)?>/gi,
      "",
    )
    .replace(
      /https?:\/\/[^\s)<>"'`]*(?:files\.slack\.com|\/files-pri\/|\/files-tmb\/)[^\s)<>"'`]*/gi,
      "",
    )

  const lines = cleaned.split(/\r?\n/)
  const filteredLines: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^>[ \t]*$/.test(line)) {
      let hasNextQuoteLine = false
      for (let j = i + 1; j < lines.length; j++) {
        if (/^>[ \t]*\S/.test(lines[j])) {
          hasNextQuoteLine = true
          break
        }
        if (!lines[j].startsWith(">")) break
      }
      if (
        hasNextQuoteLine &&
        filteredLines.length > 0 &&
        /^>[ \t]*\S/.test(filteredLines[filteredLines.length - 1])
      ) {
        filteredLines.push(">")
      }
      continue
    }
    filteredLines.push(line)
  }

  return filteredLines
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\s+$/g, "")
}

const LINE_BREAK_ELEMENTS = new Set([
  "BLOCKQUOTE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HR",
  "LI",
  "OL",
  "P",
  "PRE",
  "UL",
])

function wrapInline(text: string, marker: string): string {
  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/)
  const leading = match?.[1] ?? ""
  const content = match?.[2] ?? ""
  const trailing = match?.[3] ?? ""
  if (!content) return text
  return `${leading}${marker}${content}${marker}${trailing}`
}

const PLAIN_TEXT_BULLET_LINE_REGEX = /^[ \t]*(?:[-*+•]|\d+[.)])[ \t]+\S/

function hasPrecedingPlainBulletLine(node: HTMLElement): boolean {
  let listEl = node.closest<HTMLElement>(`ul, ol, .${CLASS_LIST}`)
  if (!listEl) return false
  while (listEl.parentElement?.closest<HTMLElement>(`ul, ol, .${CLASS_LIST}`)) {
    listEl = listEl.parentElement.closest<HTMLElement>(`ul, ol, .${CLASS_LIST}`)!
  }

  let prev = listEl.previousElementSibling
  while (
    prev instanceof HTMLElement &&
    (prev.tagName === "UL" || prev.tagName === "OL" || prev.classList.contains(CLASS_LIST))
  ) {
    prev = prev.previousElementSibling
  }

  if (!(prev instanceof HTMLElement) || !prev.classList.contains(CLASS_RICH_TEXT_SECTION)) {
    return false
  }

  const sectionText = extractStructuredText(prev)
  const lines = sectionText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  const lastLine = lines[lines.length - 1]
  return Boolean(lastLine && PLAIN_TEXT_BULLET_LINE_REGEX.test(lastLine))
}

function resolveBaseListIndentLevel(node: HTMLElement): number {
  if (node.dataset.stringifyIndent !== undefined) {
    const val = Number.parseInt(node.dataset.stringifyIndent, 10)
    if (!Number.isNaN(val) && val >= 0) return val
  }
  if (node.dataset.indent !== undefined) {
    const val = Number.parseInt(node.dataset.indent, 10)
    if (!Number.isNaN(val) && val >= 0) return val
  }
  const parent = node.parentElement
  if (parent?.dataset.indent !== undefined) {
    const val = Number.parseInt(parent.dataset.indent, 10)
    if (!Number.isNaN(val) && val >= 0) return val
  }
  let depth = 0
  let curr = node.parentElement
  while (curr && !curr.classList.contains(CLASS_MESSAGE_KIT_BLOCKS) && curr !== document.body) {
    if (curr.tagName === "UL" || curr.tagName === "OL" || curr.classList.contains(CLASS_LIST)) {
      depth += 1
    }
    curr = curr.parentElement
  }
  return Math.max(0, depth - 1)
}

function getListIndentLevel(node: HTMLElement): number {
  const baseIndent = resolveBaseListIndentLevel(node)
  return hasPrecedingPlainBulletLine(node) ? baseIndent + 1 : baseIndent
}

function getListItemPrefix(node: HTMLElement): string {
  const indentLevel = getListIndentLevel(node)
  const indentSpaces = "  ".repeat(indentLevel)

  if (node.dataset.stringifyPrefix) {
    return `${indentSpaces}${node.dataset.stringifyPrefix.trimStart()}`
  }
  const parent = node.parentElement
  if (!parent) return `${indentSpaces}- `
  const isOrdered =
    parent.tagName === "OL" ||
    parent.dataset.stringifyType === "ordered" ||
    parent.dataset.stringifyType === "ordered-list"
  if (isOrdered) {
    const siblings = Array.from(parent.children).filter((child) => child.tagName === "LI")
    const index = siblings.indexOf(node)
    const start = Number.parseInt(parent.getAttribute("start") ?? "1", 10)
    const num = (index >= 0 ? index : 0) + (Number.isNaN(start) ? 1 : start)
    return `${indentSpaces}${num}. `
  }
  return `${indentSpaces}- `
}

function escapeLeadingPlainQuotes(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^([ \t\u00A0]*)(>+)/, "$1\\$2"))
    .join("\n")
}

function extractStructuredText(root: HTMLElement): string {
  const visit = (node: Node, insidePre = false, insideCode = false, quoteDepth = 0): string => {
    if (node instanceof Text) {
      return node.data
    }
    if (!(node instanceof HTMLElement)) return ""

    if (
      node.getAttribute(STRINGIFY_IGNORE_ATTR) === "true" ||
      node.classList.contains(CLASS_EXPAND_BUTTON) ||
      node.classList.contains(CLASS_CHECK_ICON) ||
      node.classList.contains(CLASS_MESSAGE_KIT_REACTION_BAR) ||
      node.classList.contains(CLASS_MESSAGE_EDITED_LABEL) ||
      Boolean(node.closest(`.${CLASS_MESSAGE_EDITED_LABEL}`)) ||
      node.matches(NON_CONTENT_CHROME_SELECTOR) ||
      node.hasAttribute(SLACKTOR_TRANSLATION_ATTR) ||
      node.hasAttribute(SLACKTOR_ACTION_ATTR) ||
      isMediaOrFileNode(node)
    ) {
      return ""
    }

    const inlineFileName = getInlineFileName(node)
    if (inlineFileName && !insidePre && !insideCode) {
      return `[${inlineFileName}](slack://file)`
    }

    if (node.tagName === "HR" || node.getAttribute("data-qa") === DATA_QA_RICH_TEXT_DIVIDER) {
      return "\n---\n"
    }

    if (
      node.tagName === "BR" ||
      node.classList.contains(CLASS_MRKDWN_BR) ||
      node.dataset.stringifyType === STRINGIFY_PARAGRAPH_BREAK ||
      node.dataset.stringifyType === STRINGIFY_LINE_BREAK
    ) {
      return "\n"
    }

    if (node.tagName === "IMG") {
      const src = node.getAttribute("src") ?? ""
      if (
        src.includes("files.slack.com") ||
        src.includes("/files-pri/") ||
        src.includes("/files-tmb/") ||
        node.closest(MEDIA_AND_FILES_SELECTOR)
      ) {
        return ""
      }
      const alt = node.getAttribute("alt")
      const emoji = node.dataset.stringifyEmoji
      return alt || emoji || ""
    }

    const tagName = node.tagName
    const isPre =
      tagName === "PRE" ||
      node.classList.contains(CLASS_MRKDWN_PRE) ||
      node.dataset.stringifyType === "pre"
    const isCode = !isPre && (tagName === "CODE" || node.dataset.stringifyType === "code")
    const isBold = tagName === "B" || tagName === "STRONG" || node.dataset.stringifyType === "bold"
    const isItalic = tagName === "I" || tagName === "EM" || node.dataset.stringifyType === "italic"
    const isStrike =
      tagName === "S" ||
      tagName === "DEL" ||
      tagName === "STRIKE" ||
      node.dataset.stringifyType === "strike"
    const isQuote =
      tagName === "BLOCKQUOTE" ||
      node.classList.contains(CLASS_MRKDWN_QUOTE) ||
      node.dataset.stringifyType === "quote"
    const isListItem = tagName === "LI"
    const isClickable =
      tagName === "A" ||
      node.classList.contains(CLASS_MEMBER_SLUG) ||
      node.classList.contains(CLASS_USER_GROUP) ||
      node.classList.contains(CLASS_BROADCAST) ||
      node.classList.contains(CLASS_CHANNEL_NAME) ||
      node.classList.contains(CLASS_MRKDWN_CHANNEL) ||
      node.classList.contains(CLASS_INTERNAL_CHANNEL_LINK) ||
      node.dataset.stringifyType === "mention" ||
      node.dataset.stringifyType === "channel" ||
      node.getAttribute("data-qa") === DATA_QA_CHANNEL_LINK ||
      Boolean(node.getAttribute(ATTR_DATA_MEMBER_ID)) ||
      Boolean(node.getAttribute(ATTR_DATA_CHANNEL_ID)) ||
      Boolean(node.getAttribute(ATTR_DATA_CHANNEL_NAME))

    // Ignore non-link UI buttons (e.g. "Copy code", "See more", expand toggles)
    if (tagName === "BUTTON" && !isClickable) {
      return ""
    }

    let childrenText = ""
    for (const child of Array.from(node.childNodes)) {
      childrenText += visit(
        child,
        insidePre || isPre,
        insideCode || isCode,
        quoteDepth + (isQuote ? 1 : 0),
      )
    }

    if (isPre) {
      if (insidePre) return childrenText
      return `\n\`\`\`\n${childrenText.trim()}\n\`\`\`\n`
    }
    if (isCode && !insidePre && !insideCode) {
      return wrapInline(childrenText, "`")
    }
    if (isBold && !insidePre && !insideCode) {
      const trimmed = childrenText.trim()
      if (trimmed.startsWith("`") && trimmed.endsWith("`") && !trimmed.slice(1, -1).includes("`")) {
        return childrenText
      }
      return wrapInline(childrenText, "*")
    }
    if (isItalic && !insidePre && !insideCode) {
      const trimmed = childrenText.trim()
      if (trimmed.startsWith("`") && trimmed.endsWith("`") && !trimmed.slice(1, -1).includes("`")) {
        return childrenText
      }
      return wrapInline(childrenText, "_")
    }
    if (isStrike && !insidePre && !insideCode) {
      const trimmed = childrenText.trim()
      if (trimmed.startsWith("`") && trimmed.endsWith("`") && !trimmed.slice(1, -1).includes("`")) {
        return childrenText
      }
      return wrapInline(childrenText, "~")
    }
    if (isClickable && !insidePre && !insideCode) {
      const href = node.getAttribute("href") ?? ""
      if (
        href.includes("files.slack.com") ||
        href.includes("/files-pri/") ||
        href.includes("/files-tmb/") ||
        node.closest(MEDIA_AND_FILES_SELECTOR)
      ) {
        return ""
      }
      if (node.classList.contains(CLASS_TIMESTAMP)) return childrenText

      const trimmed = childrenText.trim()
      const isChannel =
        node.dataset.stringifyType === "channel" ||
        node.classList.contains(CLASS_CHANNEL_NAME) ||
        node.classList.contains(CLASS_MRKDWN_CHANNEL) ||
        node.classList.contains(CLASS_INTERNAL_CHANNEL_LINK) ||
        node.getAttribute("data-qa") === DATA_QA_CHANNEL_LINK ||
        Boolean(node.getAttribute(ATTR_DATA_CHANNEL_ID)) ||
        Boolean(node.getAttribute(ATTR_DATA_CHANNEL_NAME)) ||
        href.includes("/archives/")
      if (isChannel) {
        const rawName = node.getAttribute(ATTR_DATA_CHANNEL_NAME) || trimmed
        const cleanName = rawName.replace(/^[#@]/, "").trim()
        return `[#${cleanName}](slack://channel)`
      }

      const isMention =
        node.dataset.stringifyType === "mention" ||
        node.classList.contains(CLASS_MEMBER_SLUG) ||
        node.classList.contains(CLASS_USER_GROUP) ||
        node.classList.contains(CLASS_BROADCAST) ||
        href.includes("/team/") ||
        href.includes("/user/") ||
        href.startsWith("slack://user") ||
        Boolean(node.getAttribute(ATTR_DATA_MEMBER_ID))
      if (isMention) {
        const mentionText = trimmed.startsWith("@") ? trimmed : `@${trimmed}`
        return `[${mentionText}](slack://mention)`
      }

      if (href.startsWith("mailto:")) {
        const email = trimmed.replace(/^mailto:/i, "") || href.replace(/^mailto:/i, "")
        return `[${email}](slack://email)`
      }

      // Encode standard web links with a compact semantic protocol instead of
      // full 200-character destination URLs to prevent token waste and translation leakage.
      const linkText = trimmed || href
      return `[${linkText}](slack://link)`
    }
    if (isQuote) {
      const quoted = childrenText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => (line.startsWith(">") ? `>${line}` : `> ${line}`))
        .join("\n")
      return `\n${quoted}\n`
    }
    if (isListItem) {
      const prefix = getListItemPrefix(node)
      return `${prefix}${childrenText.trimStart()}\n`
    }

    const isList = tagName === "UL" || tagName === "OL" || node.classList.contains(CLASS_LIST)
    if (isList) {
      const isNestedList = Boolean(node.parentElement?.closest(NESTED_LIST_PARENT_SELECTOR))
      if (isNestedList) {
        const trimmed = childrenText.trimEnd()
        return trimmed ? `\n${trimmed}` : ""
      }
      const trimmed = childrenText.replace(/^\n+|\s+$/g, "")
      return trimmed ? `\n${trimmed}\n` : ""
    }

    const isBlock =
      LINE_BREAK_ELEMENTS.has(tagName) ||
      node.getAttribute("data-qa") === DATA_QA_RICH_TEXT_HEADER ||
      (node !== root && node.classList.contains(CLASS_RICH_TEXT_SECTION))
    if (isBlock) {
      let trimmed = childrenText.replace(/^\n+|\s+$/g, "")
      const hasQuoteChild = Boolean(
        node.querySelector?.(`blockquote, .${CLASS_MRKDWN_QUOTE}, [data-stringify-type='quote']`),
      )
      if (quoteDepth === 0 && !hasQuoteChild) {
        trimmed = escapeLeadingPlainQuotes(trimmed)
      }
      return trimmed ? `\n${trimmed}\n` : ""
    }

    return childrenText
  }

  const raw = visit(root)
  const hasQuoteInRoot = Boolean(
    root.querySelector?.(`blockquote, .${CLASS_MRKDWN_QUOTE}, [data-stringify-type='quote']`),
  )
  const textWithQuotes = !hasQuoteInRoot ? escapeLeadingPlainQuotes(raw) : raw
  let collapsedLists = textWithQuotes
    .replace(/[ \t\u00A0]+\n/g, "\n")
    .replace(/\n[ \t\u00A0]+(?=\[|https?:\/\/)/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
  let prev = ""
  while (prev !== collapsedLists) {
    prev = collapsedLists
    collapsedLists = collapsedLists.replace(
      /((?:^|\n)[ \t]*(?:[-*+•]|\d+[.)])[ \t]+[^\n]*)\n\n+(?=[ \t]*(?:[-*+•]|\d+[.)])[ \t]+)/g,
      "$1\n",
    )
  }
  return stripEditedBadge(collapsedLists.replace(/^\n+|\s+$/g, ""))
}

export function getTranslationAnchor(node: HTMLElement): HTMLElement | undefined {
  // 1. If the message has an attachments container, place the translation inside/after it
  // (never inside the clickable [data-qa='forwarded_message_card'] box itself).
  const attachments = node.querySelector<HTMLElement>(TRANSLATION_ANCHOR_ATTACHMENTS_SELECTOR)
  if (attachments) {
    return attachments
  }

  const forwardedCard = node.querySelector<HTMLElement>(FORWARDED_CARD_SELECTOR)
  if (forwardedCard) {
    return forwardedCard.parentElement ?? forwardedCard
  }

  // 2. Main message body block (prefer outer block container over individual rich_text_section)
  const textNode = getMainTextNode(node)
  if (textNode) {
    if (textNode.classList.contains(CLASS_RICH_TEXT_SECTION)) {
      return (
        textNode.closest<HTMLElement>(
          `${MESSAGE_TEXT_SELECTOR}, .${CLASS_MESSAGE_KIT_BLOCKS}, .p-rich_text_block, ${CONVERSATION_BUBBLE_SELECTOR}`,
        ) ?? textNode
      )
    }
    return textNode
  }

  const bubble = node.querySelector<HTMLElement>(CONVERSATION_BUBBLE_SELECTOR)
  if (bubble) return bubble

  return undefined
}

export function isMessageCandidate(node: HTMLElement): boolean {
  return (
    node.matches(MESSAGE_CONTAINER_SELECTOR) ||
    (!node.closest<HTMLElement>(MESSAGE_CONTAINER_SELECTOR) &&
      node.matches(FALLBACK_MESSAGE_SELECTOR))
  )
}

export function findClosestMessageNode(node: HTMLElement): HTMLElement | undefined {
  return node.closest<HTMLElement>(MESSAGE_SELECTOR) ?? undefined
}

// Element whose computed text color reflects Slack's active light/dark theme.
// Message text is the most reliable signal; body is the fallback before any
// message has rendered.
export function getSlackThemeProbeElement(): HTMLElement | undefined {
  return (
    document.querySelector<HTMLElement>(MESSAGE_CONTAINER_SELECTOR) ?? document.body ?? undefined
  )
}

function findMessageId(node: HTMLElement): string | undefined {
  const directId = node.dataset.messageId ?? node.dataset.ts
  if (directId) return directId

  const nested = node.querySelector<HTMLElement>(MESSAGE_ID_DATA_SELECTOR)
  const nestedId = nested?.dataset.messageId ?? nested?.dataset.ts
  if (nestedId) return nestedId

  const permalink = node.querySelector<HTMLAnchorElement>(PERMALINK_MESSAGE_SELECTOR)?.href
  if (permalink) {
    const match = permalink.match(PERMALINK_TS_REGEX)
    if (match) return `${match[1]}.${match[2]}`
  }

  return undefined
}

function findMessageTimestamp(node: HTMLElement): string | undefined {
  const permalink = node.querySelector<HTMLAnchorElement>(PERMALINK_MESSAGE_SELECTOR)?.href
  if (permalink) {
    try {
      const match = new URL(permalink, window.location.origin).pathname.match(
        PERMALINK_PATHNAME_TS_REGEX,
      )
      if (match) return `${match[1]}.${match[2]}`
    } catch {
      const match = permalink.match(PERMALINK_TS_REGEX)
      if (match) return `${match[1]}.${match[2]}`
    }
  }

  const direct = node.dataset.msgTs ?? node.dataset.ts
  if (direct) return normalizeSlackTimestamp(direct)

  // Thread wrappers can contain data-ts values for the thread root. Only use
  // this broad fallback when the message's own timestamp permalink is absent.
  const nested = node.querySelector<HTMLElement>(MESSAGE_TS_DATA_SELECTOR)
  const nestedTimestamp = nested?.dataset.msgTs ?? nested?.dataset.ts
  return nestedTimestamp ? normalizeSlackTimestamp(nestedTimestamp) : undefined
}

function findConversationId(node: HTMLElement): string | undefined {
  const direct = node.dataset.msgChannelId ?? node.dataset.channelId
  if (direct) return direct

  const blockChannel = node.querySelector<HTMLElement>(MESSAGE_CHANNEL_DATA_SELECTOR)?.dataset
    .messageChannel
  if (blockChannel) return blockChannel

  const permalink = node.querySelector<HTMLAnchorElement>(PERMALINK_ARCHIVES_SELECTOR)?.href
  if (permalink) {
    const archivesMatch = permalink.match(PERMALINK_ARCHIVES_CID_REGEX)
    if (archivesMatch) return archivesMatch[1]
    const cidMatch = permalink.match(PERMALINK_CID_PARAM_REGEX)
    if (cidMatch) return cidMatch[1]
  }

  try {
    const pageMatch = window.location.pathname.match(CHANNEL_CLIENT_ROUTE_REGEX)
    if (pageMatch) return pageMatch[1]
  } catch {}

  return undefined
}

function normalizeSlackTimestamp(value: string): string {
  const permalinkMatch = value.match(NORMALIZED_SLACK_TS_REGEX)
  return permalinkMatch ? `${permalinkMatch[1]}.${permalinkMatch[2]}` : value
}

function extractThreadRootFromPermalink(node: HTMLElement): string | undefined {
  // 1. Check message timestamp permalink
  const timestampHref = node.querySelector<HTMLAnchorElement>(PERMALINK_THREAD_ROOT_SELECTOR)?.href
  if (timestampHref) {
    const threadTs = parseThreadTsFromHref(timestampHref)
    if (threadTs) return threadTs
  }

  // 2. Check broadcast preamble ("Also send to channel" / "Replied to a thread:")
  const broadcastLink = node.querySelector<HTMLAnchorElement>(
    BROADCAST_PREAMBLE_LINK_SELECTOR,
  )?.href
  if (broadcastLink) {
    const threadTs = parseThreadTsFromHref(broadcastLink)
    if (threadTs) return threadTs
  }

  // 3. Fallback: Any link with thread_ts in message header/chrome, excluding user text and forward cards
  const candidateLinks = Array.from(
    node.querySelectorAll<HTMLAnchorElement>(ANY_THREAD_TS_LINK_SELECTOR),
  )
  for (const link of candidateLinks) {
    if (link.closest(THREAD_LINK_EXCLUDE_CONTAINERS_SELECTOR)) {
      continue
    }
    const threadTs = parseThreadTsFromHref(link.href)
    if (threadTs) return threadTs
  }

  return undefined
}

function parseThreadTsFromHref(href: string): string | undefined {
  try {
    const match = href.match(THREAD_TS_PARAM_REGEX)
    return match
      ? match[1]
      : (new URL(href, window.location.origin).searchParams.get("thread_ts") ?? undefined)
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
    const routeMatch = url.pathname.match(THREAD_PANEL_ROUTE_REGEX)
    if (routeMatch?.[1] && routeMatch[1] !== messageId) return routeMatch[1]
  } catch {
    // Keep the no-context fallback when Slack has an unexpected URL shape.
  }
  return undefined
}

function isIgnoredDisplayNode(node: HTMLElement): boolean {
  if (
    node.dataset.qa?.toLowerCase().includes(DATA_QA_DATE_DIVIDER) ||
    node.querySelector(DATE_DIVIDER_SELECTOR)
  ) {
    return true
  }
  if (node.querySelector(TOMBSTONE_SELECTOR)) {
    return true
  }
  if (
    node.matches(MESSAGE_TRANSIENT_STATE_SELECTOR) ||
    Boolean(node.querySelector(MESSAGE_TRANSIENT_STATE_SELECTOR))
  ) {
    return true
  }
  if (
    node.getAttribute("data-qa-placeholder") === "true" ||
    node.getAttribute("data-qa-unprocessed") === "true" ||
    Boolean(node.closest("[data-qa-placeholder='true'], [data-qa-unprocessed='true']"))
  ) {
    return true
  }
  return false
}

function isSystemMessageNode(node: HTMLElement): boolean {
  if (node.matches(SYSTEM_SELECTOR) || node.querySelector(SYSTEM_SELECTOR)) return true
  const ariaLabel = node.getAttribute("aria-label")?.toLowerCase() ?? ""
  if (ariaLabel.includes("system message") || ariaLabel.includes("channel activity")) return true
  const qa = node.dataset.qa?.toLowerCase() ?? ""
  if (qa.includes("system") || qa.includes("notification")) return true
  if (node.querySelector(AUTOMATED_MESSAGE_BODY_SELECTOR)) {
    return true
  }
  return false
}

function isAdjacentMessageNode(node: HTMLElement): boolean {
  if (
    node.querySelector(
      `.c-message__sender, [data-qa='message_sender'], ${PARTICIPANT_SENDER_SELECTOR}`,
    )
  ) {
    return false
  }
  if (node.querySelector(ADJACENT_MESSAGE_INDICATOR_SELECTOR)) return true
  if (node.matches(".c-message--adjacent, [class*='conversationGrouped__']")) {
    return true
  }
  return false
}

function findPrecedingMessageNode(node: HTMLElement): HTMLElement | undefined {
  const wrapper = node.closest<HTMLElement>(VIRTUAL_LIST_ITEM_SELECTOR) ?? node

  let current = wrapper.previousElementSibling
  while (current) {
    if (current instanceof HTMLElement) {
      if (current.querySelector(TOMBSTONE_SELECTOR)) {
        break
      }
      // Skip date dividers while searching up an adjacent cluster
      if (
        current.dataset.qa?.toLowerCase().includes(DATA_QA_DATE_DIVIDER) ||
        current.querySelector(DATE_DIVIDER_SELECTOR)
      ) {
        current = current.previousElementSibling
        continue
      }

      if (current.matches(MESSAGE_CONTAINER_SELECTOR)) return current
      const container = current.querySelector<HTMLElement>(MESSAGE_CONTAINER_SELECTOR)
      if (container) return container

      if (current.matches(FALLBACK_MESSAGE_SELECTOR)) return current
      const fallback = current.querySelector<HTMLElement>(FALLBACK_MESSAGE_SELECTOR)
      if (fallback) return fallback
    }
    current = current.previousElementSibling
  }
  return undefined
}

function findClusterRootMessageNode(node: HTMLElement): HTMLElement | undefined {
  let current: HTMLElement | undefined = node
  let depth = 0
  const maxDepth = 40
  while (current && isAdjacentMessageNode(current) && depth < maxDepth) {
    const prev = findPrecedingMessageNode(current)
    if (!prev || prev === current) break
    current = prev
    depth++
  }
  return current !== node ? current : undefined
}

// Cache the most recently resolved cluster author per conversation so that if Slack's
// virtual list unmounts the top message of a long adjacent message run (>20-40 items),
// subsequent adjacent messages in the same cluster still resolve their author & bot status.
const lastKnownClusterByConversation = new Map<
  string,
  {
    timestamp: number
    author: AuthorIdentity
    isBot: boolean
  }
>()
const CLUSTER_CACHE_MAX_GAP_SECONDS = 600

function isDirectBotNode(node: HTMLElement): boolean {
  if (node.dataset.botId !== undefined) return true
  if (node.querySelector(BOT_BADGE_SELECTOR)) return true
  if (node.querySelector(BOT_AVATAR_SERVICE_SELECTOR)) return true
  if (node.matches(SLACKBOT_DOM_SELECTOR) || node.querySelector(SLACKBOT_DOM_SELECTOR)) return true

  const senderId =
    node.dataset.memberId ??
    node.querySelector<HTMLElement>(SENDER_DATA_SELECTOR)?.dataset.messageSender
  if (senderId === SLACKBOT_MEMBER_ID || (senderId && BOT_ID_REGEX.test(senderId))) {
    return true
  }

  return false
}

function isBotNode(node: HTMLElement, conversationId?: string, timestampStr?: string): boolean {
  if (isDirectBotNode(node)) return true

  if (isAdjacentMessageNode(node)) {
    const root = findClusterRootMessageNode(node)
    if (root && root !== node) {
      return isBotNode(root, conversationId, timestampStr)
    }
    if (conversationId && timestampStr) {
      const ts = Number.parseFloat(timestampStr)
      const cached = lastKnownClusterByConversation.get(conversationId)
      if (
        cached &&
        Number.isFinite(ts) &&
        Math.abs(ts - cached.timestamp) <= CLUSTER_CACHE_MAX_GAP_SECONDS
      ) {
        return cached.isBot
      }
    }
  }

  return false
}

function getMessageSkipReason(
  node: HTMLElement,
  sourceText: string,
  isSystem: boolean,
  isBot: boolean,
): string | undefined {
  if (isSystem) {
    return SKIP_REASON_SYSTEM
  }
  if (isBot) {
    return SKIP_REASON_BOT
  }

  const trimmed = sourceText.trim()
  if (!trimmed) {
    return SKIP_REASON_EMPTY
  }

  // If message has a forwarded message card, it contains forwarded content
  const hasForwardedCard = Boolean(node.querySelector(FORWARDED_CARD_SELECTOR))
  if (hasForwardedCard) {
    return undefined
  }

  // Inspect the main message text element in DOM to accurately detect mentions, emojis, URLs
  const textContainer = getMainTextNode(node)
  if (textContainer) {
    const clone = textContainer.cloneNode(true) as HTMLElement
    const mentions = Array.from(clone.querySelectorAll(MENTION_SELECTOR))
    const emojis = Array.from(clone.querySelectorAll(EMOJI_SELECTOR))
    const links = Array.from(clone.querySelectorAll(LINK_SELECTOR))
    const ignored = Array.from(clone.querySelectorAll(IGNORED_TEXT_IN_SKIP_CHECK_SELECTOR))

    for (const el of [...mentions, ...emojis, ...links, ...ignored]) {
      el.remove()
    }

    const remainingText = clone.textContent ?? ""
    const remainingLetters = remainingText.replace(/[\s\p{P}\p{S}\p{N}]/gu, "").trim()

    if (remainingLetters.length === 0) {
      return SKIP_REASON_NO_TEXT
    }
  } else {
    // Fallback regex check if textContainer is absent
    const noUrls = trimmed
      .replace(/\[((?:\[[^\]\n]*\]|[^\]\n])+)\]\((?:https?:\/\/|slack:\/\/)[^\s)]+\)/g, "")
      .replace(/https?:\/\/\S+/gi, "")
      .trim()
    const noMentions = noUrls
      .replace(/\[((?:\[[^\]\n]*\]|[^\]\n])+)\]\(slack:\/\/mention\)/g, "")
      .replace(/@[a-zA-Z0-9._-]+/g, "")
      .replace(/<![a-zA-Z0-9._-]+>/g, "")
      .trim()
    const noEmojis = noMentions
      .replace(/:[a-zA-Z0-9_+:-]+:/g, "")
      .replace(/\p{Extended_Pictographic}/gu, "")
      .trim()
    const remainingLetters = noEmojis.replace(/[\s\p{P}\p{S}\p{N}]/gu, "").trim()

    if (remainingLetters.length === 0) {
      return SKIP_REASON_NO_TEXT
    }
  }

  return undefined
}

function extractAuthor(
  node: HTMLElement,
  conversationId?: string,
  timestampStr?: string,
): AuthorIdentity {
  const memberId =
    node.dataset.memberId ??
    node.querySelector<HTMLElement>(SENDER_DATA_SELECTOR)?.dataset.messageSender
  const displayName =
    node.querySelector<HTMLElement>(SENDER_QA_SELECTOR)?.dataset.stringifyText ??
    node.querySelector<HTMLElement>("[data-qa='message_sender_name']")?.textContent?.trim() ??
    node.querySelector<HTMLElement>(PARTICIPANT_SENDER_SELECTOR)?.textContent?.trim()
  const serviceBotId = node
    .querySelector<HTMLAnchorElement>(BOT_AVATAR_SERVICE_SELECTOR)
    ?.href.match(/\/services\/([A-Z0-9]+)/)?.[1]

  const resolvedMemberId = (memberId && memberId.trim()) || serviceBotId || displayName
  if (resolvedMemberId) {
    const identity: AuthorIdentity = {
      status: "resolved",
      memberId: resolvedMemberId,
      displayName: displayName || resolvedMemberId,
    }
    if (conversationId && timestampStr) {
      const ts = Number.parseFloat(timestampStr)
      if (Number.isFinite(ts)) {
        lastKnownClusterByConversation.set(conversationId, {
          timestamp: ts,
          author: identity,
          isBot: isDirectBotNode(node),
        })
        if (lastKnownClusterByConversation.size > 200) {
          const oldestKey = lastKnownClusterByConversation.keys().next().value
          if (oldestKey) lastKnownClusterByConversation.delete(oldestKey)
        }
      }
    }
    return identity
  }

  if (isAdjacentMessageNode(node)) {
    const root = findClusterRootMessageNode(node)
    if (root && root !== node) {
      return extractAuthor(root, conversationId, timestampStr)
    }
    if (conversationId && timestampStr) {
      const ts = Number.parseFloat(timestampStr)
      const cached = lastKnownClusterByConversation.get(conversationId)
      if (
        cached &&
        Number.isFinite(ts) &&
        Math.abs(ts - cached.timestamp) <= CLUSTER_CACHE_MAX_GAP_SECONDS
      ) {
        return cached.author
      }
    }
  }

  return { status: "unknown", reason: "not-present-in-dom" }
}
