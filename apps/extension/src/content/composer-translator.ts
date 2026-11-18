import type {
  ComposerTranslateRequest,
  ComposerTranslateResponse,
  ContentRequest,
  PublicSettings,
} from "../shared/messages"
import { SLACKTOR_COLORS } from "../shared/theme"
import { lucideIcon } from "./lucide-icons"
import { THREAD_PANEL_SELECTOR } from "./message-observer"
import { extractMessage, findMessageNodes, MESSAGE_EDITOR_SELECTOR } from "./slack-adapter"

const COMPOSER_SELECTOR = [
  "[data-qa='message_input'] [contenteditable='true']",
  "[data-qa='message_input'][contenteditable='true']",
  "[data-qa='message_input'] [contenteditable='plaintext-only']",
  "[data-qa='message_input'] [role='textbox'][contenteditable='true']",
  "div[role='textbox'][contenteditable='true'][data-slate-editor='true']",
].join(", ")
const COMPOSER_CONTAINER_SELECTOR = "[data-qa='message_input']"
const SETTINGS_REFRESH_MS = 3000
const TICK_MS = 500
const BUTTON_SIZE = 28
const PANEL_GAP = 6

const ICONS = {
  RotateCw: lucideIcon("RotateCw"),
  Copy: lucideIcon("Copy"),
  Check: lucideIcon("Check"),
  TextCursorInput: lucideIcon("TextCursorInput"),
  X: lucideIcon("X"),
  LoaderCircle: lucideIcon("LoaderCircle", { className: "spin" }),
  // Slacktor app logo (same artwork as the extension icon, see scripts/generate-icons.mjs).
  SlacktorLogo: `<svg viewBox="0 0 128 128" fill="none" aria-hidden="true"><g transform="translate(64 64) scale(4.3836) translate(-13.967 -13.846)"><path d="M0.81189 13.8229C0.8756 6.53501 6.66111 0.67826 13.9861 0.691582C21.2653 0.704324 27.1284 6.45276 27.1221 13.8403C27.1157 21.3437 21.1877 27.0168 13.9658 27C6.5221 26.9821 0.872704 21.0854 0.81189 13.8229ZM14.0463 2.78361C7.89883 2.71411 2.98153 7.71076 2.96126 13.7615C2.9404 19.8893 7.9747 24.8009 13.989 24.8107C19.8701 24.82 25.1204 19.9548 24.9994 13.549C24.8899 7.73277 20.0867 2.76449 14.0463 2.78361Z" fill="#F7E4F0"/><path d="M16.0701 0.51835C11.2906 -0.152349 7.12047 1.08306 3.86601 4.69545C0.613869 8.30553 -0.202207 12.577 0.981074 17.2638C-0.534082 13.9891 -0.465159 9.08512 2.39893 5.15707C5.358 1.09986 10.6761 -1.05936 16.0701 0.51835Z" fill="#A612A2"/></g><g transform="translate(64 64) scale(0.6) translate(-63.5 -63.5)"><path d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2C6.7 93.2.8 87.3.8 80c0-7.3 5.9-13.2 13.2-13.2h13.2V80zm6.6 0c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v33c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V80z" fill="#E01E5A"/><path d="M47 27c-7.3 0-13.2-5.9-13.2-13.2C33.8 6.5 39.7.6 47 .6c7.3 0 13.2 5.9 13.2 13.2V27H47zm0 6.7c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H13.9C6.6 60.1.7 54.2.7 46.9c0-7.3 5.9-13.2 13.2-13.2H47z" fill="#36C5F0"/><path d="M99.9 46.9c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H99.9V46.9zm-6.6 0c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V13.8C66.9 6.5 72.8.6 80.1.6c7.3 0 13.2 5.9 13.2 13.2v33.1z" fill="#2EB67D"/><path d="M80.1 99.8c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V99.8h13.2zm0-6.6c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33.1c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H80.1z" fill="#ECB22E"/></g></svg>`,
}

const STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  button {
    border: 0; background: transparent; color: ${SLACKTOR_COLORS.primary}; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; padding: 0; border-radius: 6px; font: inherit;
  }
  button:hover:not(:disabled) { background: ${SLACKTOR_COLORS.accent}; }
  button:focus-visible { outline: 2px solid ${SLACKTOR_COLORS.primary}; outline-offset: 1px; }
  button:disabled { cursor: default; opacity: 0.45; }
  svg { width: 14px; height: 14px; display: block; }
  .spin { animation: spin 0.75s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .trigger {
    position: fixed; z-index: 2147483000; width: ${BUTTON_SIZE}px; height: ${BUTTON_SIZE}px;
    border: 1px solid ${SLACKTOR_COLORS.border}; background: ${SLACKTOR_COLORS.muted};
    box-shadow: 0 1px 4px rgba(0,0,0,0.2); border-radius: 8px;
  }
  .trigger svg { width: 20px; height: 20px; }
  .panel {
    position: fixed; z-index: 2147483000; display: flex; flex-direction: column;
    background: ${SLACKTOR_COLORS.muted}; color: ${SLACKTOR_COLORS.foreground};
    border: 1px solid ${SLACKTOR_COLORS.border}; border-radius: 10px;
    box-shadow: 0 6px 24px rgba(0,0,0,0.28);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px; line-height: 1.45; overflow: hidden;
  }
  .head { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px 6px 12px; border-bottom: 1px solid ${SLACKTOR_COLORS.border}; }
  .brand { font-size: 11px; font-weight: 700; color: ${SLACKTOR_COLORS.primary}; letter-spacing: 0.02em; }
  .actions { display: inline-flex; gap: 2px; }
  .body { overflow: auto; padding: 10px 12px 10px; display: grid; gap: 10px; }
  .body.stale .text { opacity: 0.55; }
  .section-head { display: flex; align-items: center; justify-content: space-between; min-height: 24px; }
  .label { font-size: 11px; font-weight: 600; color: ${SLACKTOR_COLORS.mutedForeground}; }
  .text { white-space: pre-wrap; overflow-wrap: anywhere; }
  .divider { border-top: 1px solid ${SLACKTOR_COLORS.border}; }
  .status { display: flex; align-items: center; gap: 8px; color: ${SLACKTOR_COLORS.mutedForeground}; padding: 6px 0; }
  .error { color: ${SLACKTOR_COLORS.destructive}; padding: 2px 0; }
  .notice { font-size: 11px; color: ${SLACKTOR_COLORS.warning}; }
  .saved { display: flex; align-items: flex-start; gap: 6px; font-size: 11px; color: ${SLACKTOR_COLORS.success}; }
  .saved svg { width: 12px; height: 12px; flex: none; margin-top: 2px; }
  .saved.warn { color: ${SLACKTOR_COLORS.warning}; }
  .tip {
    position: fixed; z-index: 2147483001; display: none; pointer-events: none;
    max-width: 220px; padding: 4px 8px; border-radius: 6px; white-space: nowrap;
    background: ${SLACKTOR_COLORS.foreground}; color: ${SLACKTOR_COLORS.muted};
    font: 500 11px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  }
`

type TranslationResult = Extract<ComposerTranslateResponse, { ok: true }>

type ViewState = {
  /** Draft text the current result (or request) was made for. */
  source: string
  result?: TranslationResult
  loading: boolean
  error?: { message: string; retryable: boolean }
  applyError?: string
}

let settings: PublicSettings | undefined
let settingsFetchedAt = 0
let activeComposer: HTMLElement | undefined
let view: ViewState | undefined
let currentRequestId: string | undefined
let applying = false
let copiedKey: string | undefined
let copiedTimer: number | undefined

let host: HTMLElement | undefined
let shadow: ShadowRoot | undefined
let triggerEl: HTMLButtonElement | undefined
let panelEl: HTMLElement | undefined
let tipEl: HTMLElement | undefined
let renderQueued = false

export function startComposerTranslator(): void {
  document.addEventListener("focusin", handleFocusIn, true)
  document.addEventListener("input", handleInput, true)
  document.addEventListener("keydown", handleKeyDown, true)
  window.addEventListener("resize", scheduleRender)
  window.addEventListener("scroll", scheduleRender, { capture: true, passive: true })
  window.setInterval(tick, TICK_MS)

  chrome.runtime.onMessage.addListener((request: ContentRequest) => {
    if (request.type === "public-settings-changed") void refreshSettings(true)
    if (request.type === "set-extension-enabled") {
      if (settings) settings = { ...settings, extensionEnabled: request.enabled }
      if (!request.enabled) closePanel()
      scheduleRender()
    }
  })
}

function handleFocusIn(event: FocusEvent): void {
  const target = event.target
  if (!(target instanceof HTMLElement) || isOwnElement(target)) return
  const composer = findComposer(target)
  if (!composer) return
  if (composer !== activeComposer) {
    closePanel()
    activeComposer = composer
  }
  void refreshSettings(false)
  scheduleRender()
}

function handleInput(event: Event): void {
  if (activeComposer && event.target instanceof Node && activeComposer.contains(event.target)) {
    scheduleRender()
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape" && view) closePanel()
}

function tick(): void {
  if (!activeComposer) return
  if (!activeComposer.isConnected) {
    closePanel()
    activeComposer = undefined
    scheduleRender()
    return
  }
  // An emptied composer means the draft was sent or cleared. The result (or
  // pending request) no longer applies to anything.
  if (!applying && view?.source && !readComposerText(activeComposer)) closePanel()
  scheduleRender()
}

async function refreshSettings(force: boolean): Promise<void> {
  if (!force && Date.now() - settingsFetchedAt < SETTINGS_REFRESH_MS) return
  settingsFetchedAt = Date.now()
  try {
    settings = (await chrome.runtime.sendMessage({ type: "get-public-settings" })) as
      PublicSettings | undefined
  } catch {
    settings = undefined
  }
  if (!isUsable()) closePanel()
  scheduleRender()
}

function isUsable(): boolean {
  return Boolean(settings?.extensionEnabled && settings.privacyConsent && settings.configured)
}

function findComposer(target: HTMLElement): HTMLElement | undefined {
  const composer = target.matches(COMPOSER_SELECTOR)
    ? target
    : target.closest<HTMLElement>(COMPOSER_SELECTOR)
  if (!composer || composer.closest(MESSAGE_EDITOR_SELECTOR)) return undefined
  return composer
}

function isOwnElement(element: HTMLElement): boolean {
  return element === host
}

function readComposerText(composer: HTMLElement): string {
  return (composer.innerText ?? composer.textContent ?? "").replace(/\u200b/g, "").trim()
}

function scheduleRender(): void {
  if (renderQueued) return
  renderQueued = true
  requestAnimationFrame(() => {
    renderQueued = false
    render()
  })
}

function handleTipEnter(event: Event): void {
  if (!tipEl || !(event.target instanceof Element)) return
  // The target can be the svg inside the button, so resolve the button itself.
  const target = event.target.closest<HTMLElement>("[data-tip]")
  const text = target?.dataset.tip
  if (!target || !text || (target instanceof HTMLButtonElement && target.disabled)) {
    hideTip()
    return
  }
  tipEl.textContent = text
  tipEl.style.display = "block"
  const anchor = target.getBoundingClientRect()
  const tip = tipEl.getBoundingClientRect()
  const above = anchor.top - tip.height - 6
  const top = above >= 4 ? above : anchor.bottom + 6
  const left = Math.min(
    Math.max(4, anchor.left + anchor.width / 2 - tip.width / 2),
    window.innerWidth - tip.width - 4,
  )
  tipEl.style.top = `${top}px`
  tipEl.style.left = `${left}px`
}

function hideTip(event?: Event): void {
  // Moving from a button onto its own icon fires mouseout; keep the tooltip then.
  if (event instanceof MouseEvent && event.relatedTarget instanceof Element) {
    const from = event.target instanceof Element ? event.target.closest("[data-tip]") : null
    if (from && from.contains(event.relatedTarget)) return
  }
  if (tipEl) tipEl.style.display = "none"
}

function ensureHost(): ShadowRoot {
  if (shadow && host?.isConnected) return shadow
  host = document.createElement("div")
  host.setAttribute("data-slacktor-composer-ui", "")
  host.className = "notranslate"
  shadow = host.attachShadow({ mode: "open" })
  const style = document.createElement("style")
  style.textContent = STYLES
  shadow.append(style)
  tipEl = document.createElement("div")
  tipEl.className = "tip"
  tipEl.setAttribute("aria-hidden", "true")
  shadow.append(tipEl)
  shadow.addEventListener("mouseover", handleTipEnter)
  shadow.addEventListener("mouseout", hideTip)
  shadow.addEventListener("focusin", handleTipEnter)
  shadow.addEventListener("focusout", hideTip)
  shadow.addEventListener("click", hideTip)
  document.body.append(host)
  triggerEl = undefined
  panelEl = undefined
  return shadow
}

function render(): void {
  const composer = activeComposer
  const rect = composer ? getAnchorRect(composer) : undefined
  const hasText = composer ? Boolean(readComposerText(composer)) : false
  const visible = Boolean(composer && rect && isUsable() && (hasText || view))
  if (!visible || !composer || !rect) {
    if (host) {
      hideTip()
      triggerEl?.remove()
      panelEl?.remove()
      triggerEl = undefined
      panelEl = undefined
    }
    return
  }

  const root = ensureHost()
  const triggerTop = Math.max(4, rect.top - BUTTON_SIZE - 4)
  const triggerLeft = Math.max(4, rect.right - BUTTON_SIZE - 4)

  if (!triggerEl) {
    triggerEl = document.createElement("button")
    triggerEl.type = "button"
    triggerEl.className = "trigger"
    triggerEl.innerHTML = ICONS.SlacktorLogo
    triggerEl.dataset.tip = "Translate draft"
    triggerEl.setAttribute("aria-label", "Translate the Slack draft with Slacktor")
    triggerEl.addEventListener("mousedown", (event) => event.preventDefault())
    triggerEl.addEventListener("click", () => void translateDraft())
    root.append(triggerEl)
  }
  triggerEl.style.top = `${triggerTop}px`
  triggerEl.style.left = `${triggerLeft}px`
  triggerEl.disabled = Boolean(view?.loading)

  if (!view) {
    panelEl?.remove()
    panelEl = undefined
    return
  }

  const width = Math.min(440, Math.max(280, rect.width))
  const edge = triggerTop - PANEL_GAP
  if (!panelEl) {
    panelEl = document.createElement("section")
    panelEl.className = "panel"
    panelEl.setAttribute("role", "dialog")
    panelEl.setAttribute("aria-label", "Slacktor translation")
    root.append(panelEl)
  }
  panelEl.style.width = `${width}px`
  panelEl.style.left = `${Math.max(4, rect.right - width)}px`
  panelEl.style.bottom = `${Math.max(0, window.innerHeight - edge)}px`
  panelEl.style.maxHeight = `${Math.max(120, edge - 8)}px`
  renderPanel(panelEl, composer)
}

function getAnchorRect(composer: HTMLElement): DOMRect | undefined {
  const container = composer.closest<HTMLElement>(COMPOSER_CONTAINER_SELECTOR) ?? composer
  const rect = container.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0 ? rect : undefined
}

function renderPanel(panel: HTMLElement, composer: HTMLElement): void {
  if (!view) return
  const current = view
  const outdated = Boolean(
    current.result && !current.loading && readComposerText(composer) !== current.source,
  )
  const signature = JSON.stringify([current, outdated, copiedKey])
  // Rebuilding on every tick would drop hover state and hide tooltips.
  if (panel.dataset.signature === signature) return
  panel.dataset.signature = signature
  hideTip()
  const scrollTop = panel.querySelector<HTMLElement>(".body")?.scrollTop ?? 0
  panel.replaceChildren()

  const head = document.createElement("div")
  head.className = "head"
  const brand = document.createElement("span")
  brand.className = "brand"
  brand.textContent = "Slacktor"
  const actions = document.createElement("div")
  actions.className = "actions"
  actions.append(
    iconButton({
      icon: current.loading ? ICONS.LoaderCircle : ICONS.RotateCw,
      title: "Translate again",
      label: "Translate the current draft again",
      disabled: current.loading,
      onClick: () => void translateDraft(),
    }),
    iconButton({
      icon: ICONS.X,
      title: "Close",
      label: "Close the Slacktor translation",
      onClick: closePanel,
    }),
  )
  head.append(brand, actions)

  const body = document.createElement("div")
  body.className = `body${outdated || current.loading ? " stale" : ""}`

  const result = current.result
  if (current.loading && !result) {
    body.append(statusRow("Translating…", true))
  }
  if (result) {
    body.append(
      section({
        key: "translation",
        label: `Translate to · ${result.targetLanguage}`,
        text: result.translation,
        copyLabel: `Copy ${result.targetLanguage} translation`,
        apply: {
          label: `Replace Slack draft with ${result.targetLanguage} translation`,
          disabled: current.loading,
          onClick: () => void applyTranslation(composer, result),
        },
        copyDisabled: current.loading,
      }),
      divider(),
      section({
        key: "back",
        label: `Then translate back to · ${result.backTranslationLanguage}`,
        text: result.backTranslation,
        copyLabel: `Copy ${result.backTranslationLanguage} translation`,
        copyDisabled: current.loading,
      }),
    )
    if (outdated) body.append(noticeRow("Draft changed since this translation. Translate again."))
    else if (!current.loading && !current.error) body.append(savedRow(result.historySaved))
  }
  if (current.error) body.append(errorRow(current.error, Boolean(result)))
  if (current.applyError)
    body.append(errorRow({ message: current.applyError, retryable: false }, true))

  panel.append(head, body)
  body.scrollTop = scrollTop
}

function iconButton(options: {
  icon: string
  title: string
  label: string
  disabled?: boolean
  onClick: () => void
}): HTMLButtonElement {
  const button = document.createElement("button")
  button.type = "button"
  button.innerHTML = options.icon
  button.dataset.tip = options.title
  button.setAttribute("aria-label", options.label)
  button.disabled = Boolean(options.disabled)
  button.addEventListener("click", options.onClick)
  return button
}

function section(options: {
  key: string
  label: string
  text: string
  copyLabel: string
  copyDisabled?: boolean
  apply?: { label: string; disabled?: boolean; onClick: () => void }
}): HTMLElement {
  const wrapper = document.createElement("div")
  const head = document.createElement("div")
  head.className = "section-head"
  const label = document.createElement("span")
  label.className = "label"
  label.textContent = options.label
  const actions = document.createElement("div")
  actions.className = "actions"
  actions.append(
    iconButton({
      icon: copiedKey === options.key ? ICONS.Check : ICONS.Copy,
      title: "Copy",
      label: options.copyLabel,
      disabled: options.copyDisabled,
      onClick: () => void copyText(options.key, options.text),
    }),
  )
  if (options.apply) {
    actions.append(
      iconButton({
        icon: ICONS.TextCursorInput,
        title: "Replace draft with translation",
        label: options.apply.label,
        disabled: options.apply.disabled,
        onClick: options.apply.onClick,
      }),
    )
  }
  head.append(label, actions)
  const text = document.createElement("div")
  text.className = "text"
  text.textContent = options.text
  wrapper.append(head, text)
  return wrapper
}

function divider(): HTMLElement {
  const element = document.createElement("div")
  element.className = "divider"
  return element
}

function statusRow(message: string, spinner: boolean): HTMLElement {
  const row = document.createElement("div")
  row.className = "status"
  row.setAttribute("role", "status")
  if (spinner) row.insertAdjacentHTML("beforeend", ICONS.LoaderCircle)
  row.append(document.createTextNode(message))
  return row
}

function savedRow(historySaved: boolean): HTMLElement {
  const row = document.createElement("div")
  row.className = historySaved ? "saved" : "saved warn"
  row.setAttribute("role", "status")
  if (historySaved) row.insertAdjacentHTML("beforeend", ICONS.Check)
  row.append(
    document.createTextNode(
      historySaved
        ? "Translated successfully and saved to History. Open the Slacktor popup to review it."
        : "Translated successfully, but it could not be saved to History.",
    ),
  )
  return row
}

function noticeRow(message: string): HTMLElement {
  const row = document.createElement("div")
  row.className = "notice"
  row.textContent = message
  return row
}

function errorRow(error: { message: string; retryable: boolean }, hasResult: boolean): HTMLElement {
  const row = document.createElement("div")
  row.className = "error"
  row.setAttribute("role", "alert")
  row.textContent =
    error.retryable && !hasResult
      ? `${error.message} Use the refresh icon to retry.`
      : error.message
  return row
}

async function translateDraft(): Promise<void> {
  const composer = activeComposer
  if (!composer || view?.loading) return
  const text = readComposerText(composer)
  if (!text) return

  const requestId = crypto.randomUUID()
  currentRequestId = requestId
  view = { source: text, result: view?.result, loading: true }
  scheduleRender()

  const request: ComposerTranslateRequest = {
    type: "composer-translate",
    requestId,
    text,
    thread: findThreadInfo(composer),
  }
  try {
    const response = (await chrome.runtime.sendMessage(request)) as
      ComposerTranslateResponse | undefined
    if (currentRequestId !== requestId) return
    if (!response) {
      failRequest(text, "Slacktor did not respond. Try again.", true)
    } else if (response.ok) {
      view = { source: text, result: response, loading: false }
    } else if (response.cancelled) {
      closePanel()
      return
    } else {
      failRequest(text, response.error, true)
    }
  } catch (error) {
    if (currentRequestId !== requestId) return
    const invalidated = error instanceof Error && error.message.includes("context invalidated")
    failRequest(
      text,
      invalidated
        ? "Slacktor was updated. Reload Slack to continue."
        : "Could not reach Slacktor. Try again.",
      !invalidated,
    )
  }
  scheduleRender()
}

function failRequest(source: string, message: string, retryable: boolean): void {
  // A failed refresh keeps the previous result so it can still be copied or applied.
  view = { source, result: view?.result, loading: false, error: { message, retryable } }
}

function findThreadInfo(composer: HTMLElement): ComposerTranslateRequest["thread"] {
  const panel = composer.closest<HTMLElement>(THREAD_PANEL_SELECTOR)
  if (panel) {
    // Read the thread from the messages shown in the panel, not from the URL:
    // the URL describes the open channel, which can differ from the thread's.
    const messages = findMessageNodes(panel).flatMap((node) => extractMessage(node) ?? [])
    const conversationId = messages.find((message) => message.conversationId)?.conversationId
    const threadRootTs =
      messages.find((message) => message.threadRootTs)?.threadRootTs ?? messages[0]?.timestamp
    if (conversationId && threadRootTs) {
      return {
        workspaceId: messages.find((message) => message.workspaceId)?.workspaceId,
        conversationId,
        threadRootTs,
      }
    }
  }

  // Main channel or DM composer: resolve conversationId and workspaceId from
  // visible main-pane messages first, falling back to the Slack client URL route.
  const channelMessages = findMessageNodes(document)
    .filter((node) => !node.closest(THREAD_PANEL_SELECTOR))
    .slice(-5)
    .flatMap((node) => extractMessage(node) ?? [])
  const routeMatch = window.location.pathname.match(/\/client\/([A-Z0-9]+)\/([A-Z0-9]+)/i)
  const workspaceId =
    channelMessages.find((message) => message.workspaceId)?.workspaceId ?? routeMatch?.[1]
  const conversationId =
    channelMessages.find((message) => message.conversationId)?.conversationId ?? routeMatch?.[2]
  if (!conversationId) return undefined
  return {
    workspaceId,
    conversationId,
  }
}

async function applyTranslation(composer: HTMLElement, result: TranslationResult): Promise<void> {
  if (!composer.isConnected) {
    closePanel()
    return
  }
  applying = true
  try {
    const outcome = await replaceComposerText(composer, result.translation)
    if (outcome.ok) {
      closePanel()
      return
    }
    if (view) view = { ...view, applyError: outcome.error }
  } finally {
    applying = false
  }
  scheduleRender()
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 30)))
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function selectComposerContents(composer: HTMLElement): boolean {
  composer.focus()
  const selection = window.getSelection()
  if (!selection) return false
  const range = document.createRange()
  range.selectNodeContents(composer)
  selection.removeAllRanges()
  selection.addRange(range)
  return true
}

async function replaceComposerText(
  composer: HTMLElement,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const previousText = readComposerText(composer)
  const expected = normalizeText(text)
  const matches = () => normalizeText(readComposerText(composer)) === expected

  const insertions: Array<() => void> = [
    // insertText keeps the editor undo stack, so Cmd+Z restores the draft.
    () => void document.execCommand("insertText", false, text),
    () => {
      const data = new DataTransfer()
      data.setData("text/plain", text)
      composer.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
      )
    },
  ]

  for (const insert of insertions) {
    if (!selectComposerContents(composer)) {
      return { ok: false, error: "Slack composer could not receive focus." }
    }
    // Rich editors sync their own selection model asynchronously. Inserting
    // before that happens replaces the wrong range or nothing at all.
    await nextFrame()
    insert()
    await nextFrame()
    if (matches()) return { ok: true }
    // A failed attempt may have cleared the draft. Restore it before retrying.
    if (normalizeText(readComposerText(composer)) !== normalizeText(previousText)) {
      document.execCommand("undo")
      await nextFrame()
    }
  }
  return { ok: false, error: "Slack rejected the inserted text. Copy the translation instead." }
}

async function copyText(key: string, text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    fallbackCopy(text)
  }
  copiedKey = key
  if (copiedTimer !== undefined) window.clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => {
    copiedKey = undefined
    scheduleRender()
  }, 1500)
  scheduleRender()
}

function fallbackCopy(text: string): void {
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.append(textarea)
  textarea.select()
  try {
    document.execCommand("copy")
  } catch {
    // Copy is best effort.
  }
  textarea.remove()
}

function closePanel(): void {
  const requestId = currentRequestId
  if (view?.loading && requestId) {
    // Stop the provider request so a closed popover does not keep spending tokens.
    try {
      void Promise.resolve(
        chrome.runtime.sendMessage({ type: "cancel-translation", requestId }),
      ).catch(() => undefined)
    } catch {
      // The extension was reloaded; the background request is already gone.
    }
  }
  currentRequestId = undefined
  view = undefined
  scheduleRender()
}
