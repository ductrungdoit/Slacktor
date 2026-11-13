import { SAME_LANGUAGE_SENTINEL } from "../background/translation-service"
import { DEFAULT_SETTINGS_TARGET_LANGUAGE, getLanguageCode } from "../shared/languages"
import type { TranslateResponse } from "../shared/messages"
import { SLACKTOR_COLORS } from "../shared/theme"
import type { RawSlackMessage } from "../shared/types"
import { lucideIcon } from "./lucide-icons"
import { stripMediaAndFileLinks, TRANSLATION_ANCHOR_ATTACHMENTS_SELECTOR } from "./slack-adapter"

const ROOT_ATTRIBUTE = "data-slacktor-translation"
const RENDERED_ATTRIBUTE = "data-slacktor-rendered"
const RETRANSLATE_ACTION_ATTRIBUTE = "data-slacktor-retranslate-action"
// Play is rendered filled because lucide's default stroke outline is too faint
// to read as a "translate" affordance at 14 px.
const PLAY_ICON = lucideIcon("Play", { filled: true })
const LIGHTNING_ICON = lucideIcon("Zap")
const RETRANSLATE_ICON = lucideIcon("RotateCw")
const COPY_ICON = lucideIcon("Copy")
const CHECK_ICON = lucideIcon("Check")
// Animated via the slacktor-spin keyframes injected in setSpinnerIcon()
const SPINNER_ICON = lucideIcon("LoaderCircle", {
  accessibleLabel: "Translating",
  style: `display:block;width:14px;height:14px;color:${SLACKTOR_COLORS.mutedForeground};animation:slacktor-spin 0.75s linear infinite`,
})
// Fast amber variant for urgent translation
const URGENT_SPINNER_ICON = lucideIcon("LoaderCircle", {
  accessibleLabel: "Translating fast",
  style: `display:block;width:14px;height:14px;color:${SLACKTOR_COLORS.urgent};animation:slacktor-spin 0.45s linear infinite`,
})

export type TranslationCallbacks = {
  onTranslationComplete?: (translation: string) => void
  onTranslationStart?: (
    forceRefresh: boolean,
    urgent?: boolean,
    manual?: boolean,
    requestId?: string,
  ) => void
  onTranslationError?: (error: string) => void
  onTranslationEnd?: (requestId?: string) => void
}

export type TranslationController = {
  run: (priority?: boolean) => Promise<string | undefined>
  runUrgent: (forceRefresh?: boolean) => Promise<string | undefined>
  markQueued: (prioritize: () => void) => void
  markPrioritized: (urgent?: boolean, apiStarted?: boolean, forceRefresh?: boolean) => void
  markApiStarted: () => void
  retranslate: (priority?: boolean) => Promise<string | undefined>
  applyTranslation: (translation: string) => void
  markStopped: () => void
  markSkipped: (reason: string) => void
  markSameLanguage: () => void
  isConnected: () => boolean
  cancel: () => void
  isTranslated?: () => boolean
  getSourceText: () => string
  updateMessage: (updatedMessage: RawSlackMessage, waitForPersist?: () => Promise<void>) => void
  markOutdated?: () => void
  isQueued?: () => boolean
  isTranslating?: () => boolean
  isUrgent?: () => boolean
  isApiStarted?: () => boolean
  showRetry?: (error: string) => void
  setCallbacks?: (callbacks: TranslationCallbacks, waitForPersist?: () => Promise<void>) => void
}

type PersistWaiter = () => Promise<void>

const nodeControllers = new WeakMap<HTMLElement, TranslationController>()

// Language code of the translations, so Chrome picks matching glyph variants,
// hyphenation and speech. Undefined (attribute omitted) for an unknown language.
let translationLanguageCode = getLanguageCode(DEFAULT_SETTINGS_TARGET_LANGUAGE)

function applyHostLanguage(host: HTMLElement): void {
  if (translationLanguageCode) host.lang = translationLanguageCode
  else host.removeAttribute("lang")
}

/** Sets the language of rendered translations, including those already on the page. */
export function setTranslationLanguage(language: string): void {
  translationLanguageCode = getLanguageCode(language)
  document.querySelectorAll<HTMLElement>(`[${ROOT_ATTRIBUTE}]`).forEach(applyHostLanguage)
}

function isolateInteractiveControl(element: HTMLElement): void {
  const stop = (event: Event) => {
    event.stopPropagation()
  }
  element.addEventListener("mousedown", stop)
  element.addEventListener("dblclick", stop)
}

function mountHost(anchor: HTMLElement, host: HTMLElement): void {
  const isAttachmentLike =
    anchor.classList.contains("c-message_kit__attachments") ||
    anchor.classList.contains("c-message_kit__attachment") ||
    anchor.matches(TRANSLATION_ANCHOR_ATTACHMENTS_SELECTOR) ||
    Boolean(anchor.closest(TRANSLATION_ANCHOR_ATTACHMENTS_SELECTOR)) ||
    Boolean(anchor.closest("[data-qa='forwarded_message_card']"))

  if (isAttachmentLike) {
    const target = anchor.closest<HTMLElement>(TRANSLATION_ANCHOR_ATTACHMENTS_SELECTOR) ?? anchor
    if (target.nextElementSibling !== host) {
      target.after(host)
    }
  } else {
    if (anchor.lastElementChild !== host) {
      anchor.append(host)
    }
  }
}

export function renderPlaceholder(
  messageNode: HTMLElement,
  anchor: HTMLElement,
  message: RawSlackMessage,
  waitForPersist: PersistWaiter,
  onTranslationComplete?: (translation: string) => void,
  onTranslationStart?: (
    forceRefresh: boolean,
    urgent?: boolean,
    manual?: boolean,
    requestId?: string,
  ) => void,
  onTranslationError?: (error: string) => void,
  onTranslationEnd?: (requestId?: string) => void,
): TranslationController | undefined {
  harvestEmojis(messageNode)
  ensureSlacktorStyles()
  const existingHost = messageNode.querySelector<HTMLElement>(`[${ROOT_ATTRIBUTE}]`)
  if (messageNode.hasAttribute(RENDERED_ATTRIBUTE) && existingHost?.isConnected) {
    const existingController = nodeControllers.get(messageNode)
    if (
      existingController &&
      (!existingHost.dataset.sourceMessageId ||
        existingHost.dataset.sourceMessageId === message.messageId)
    ) {
      mountHost(anchor, existingHost)
      existingController.setCallbacks?.(
        {
          onTranslationComplete,
          onTranslationStart,
          onTranslationError,
          onTranslationEnd,
        },
        waitForPersist,
      )
      return existingController
    }
    existingController?.cancel()
  }
  // Slack can replace only the message body when actions such as Save for later
  // update its state. Remove the stale marker so the translation UI can recover.
  messageNode.removeAttribute(RENDERED_ATTRIBUTE)
  existingHost?.remove()

  const host = document.createElement("div")
  host.setAttribute(ROOT_ATTRIBUTE, "")
  host.setAttribute("data-stringify-ignore", "true")
  host.dataset.sourceMessageId = message.messageId
  host.className = "notranslate slacktor-translation"
  applyHostLanguage(host)
  host.style.cssText = "display:block;width:100%;margin-top:6px;padding-bottom:6px"

  const translation = document.createElement("div")
  translation.className = "notranslate slacktor-translation__text"
  const button = document.createElement("button")
  button.type = "button"
  button.setAttribute("data-stringify-ignore", "true")
  button.setAttribute("aria-label", "Translate message")
  button.title = "Translate message"
  setPlayIcon(button)
  button.style.cssText = `border:0;background:transparent;color:${SLACKTOR_COLORS.primary};cursor:pointer;font:inherit;padding:0;line-height:0;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;`
  isolateInteractiveControl(button)

  const result = document.createElement("div")
  result.className = "slacktor-translation__content"
  result.setAttribute("data-stringify-ignore", "true")
  result.style.cssText =
    "display:inline-flex;align-items:center;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.45;"
  result.textContent = "Slacktor"

  const actions = document.createElement("div")
  actions.className = "slacktor-translation__actions"
  actions.setAttribute("data-stringify-ignore", "true")
  actions.style.cssText = "display:none;align-items:center;gap:8px;margin-top:6px;user-select:none;"

  let currentMessage = message
  let currentWaitForPersist = waitForPersist
  let latestTranslationText = ""
  let translating = false
  let urgentTranslating = false
  let apiStarted = false
  let currentForceRefresh = false
  let mirroredTranslating = false
  let mirroredUrgent = false
  let mirroredApiStarted = false
  let requestGeneration = 0
  let activeRequestId: string | undefined
  let prioritize: (() => void) | undefined
  let currentOnTranslationComplete = onTranslationComplete
  let currentOnTranslationStart = onTranslationStart
  let currentOnTranslationError = onTranslationError
  let currentOnTranslationEnd = onTranslationEnd

  const retranslateButton = createRetranslateButton(() => void translate(true, false, false, true))
  const copyButton = createCopyButton(() => latestTranslationText || result.innerText.trim())
  actions.append(retranslateButton, copyButton)
  attachInstantTooltip(
    button,
    () => button.getAttribute("aria-label") || button.dataset.slacktorTitle || "Translate",
  )

  const showSpinner = (showLightning = false, urgent = false) => {
    host.setAttribute("data-stringify-ignore", "true")
    result.setAttribute("data-stringify-ignore", "true")
    translation.style.borderLeft = `2px solid ${urgent ? SLACKTOR_COLORS.urgent : SLACKTOR_COLORS.primary}`
    translation.style.padding = "3px 7px"
    translation.style.display = "flex"
    translation.style.alignItems = "center"
    translation.style.gap = "6px"
    button.style.display = showLightning ? "inline-flex" : "none"
    button.disabled = !showLightning
    result.style.display = "inline-flex"
    result.style.alignItems = "center"
    result.style.marginLeft = "0"
    if (showLightning) {
      setLightningIcon(button)
      button.title = "Translate now"
      button.setAttribute("aria-label", "Translate now")
    } else {
      hideInstantTooltip()
    }
    actions.style.display = "none"
    setSpinnerIcon(result, urgent)
  }

  const markSameLanguage = () => {
    mirroredTranslating = false
    mirroredUrgent = false
    mirroredApiStarted = false
    host.setAttribute("data-stringify-ignore", "true")
    result.setAttribute("data-stringify-ignore", "true")
    translation.style.borderLeft = `2px solid ${SLACKTOR_COLORS.primary}`
    translation.style.padding = "3px 7px"
    translation.style.display = "flex"
    translation.style.alignItems = "center"
    translation.style.gap = "6px"
    prioritize = undefined
    actions.style.display = "none"
    button.style.display = "inline-flex"
    button.disabled = false
    setRetranslateIcon(button)
    button.title = "Translate message manually"
    button.setAttribute("aria-label", "Translate message manually")
    result.style.color = ""
    result.style.display = "inline-flex"
    result.style.alignItems = "center"
    result.style.marginLeft = "0"
    result.style.fontSize = "12px"
    result.style.fontStyle = "italic"
    result.style.opacity = "0.75"
    result.textContent = "Already in target language"
  }

  const applyTranslation = (text: string) => {
    mirroredTranslating = false
    mirroredUrgent = false
    mirroredApiStarted = false
    if (text === SAME_LANGUAGE_SENTINEL) {
      markSameLanguage()
      return
    }
    // Restore the border-left bar (may have been cleared by markSameLanguage)
    translation.style.borderLeft = `2px solid ${SLACKTOR_COLORS.primary}`
    translation.style.padding = "3px 7px"
    translation.style.display = "block"
    translation.style.alignItems = ""
    translation.style.gap = ""
    prioritize = undefined
    button.style.display = "none"
    result.style.color = ""
    result.style.marginLeft = "0"
    result.style.fontSize = ""
    result.style.fontStyle = ""
    result.style.opacity = ""
    result.style.alignItems = ""
    latestTranslationText = text
    if (text) {
      host.removeAttribute("data-stringify-ignore")
      result.removeAttribute("data-stringify-ignore")
      result.innerHTML = formatTranslationHtml(text)
      result.style.display = "block"
      actions.style.display = "flex"
      retranslateButton.style.display = "inline-flex"
      copyButton.style.display = "inline-flex"
    } else {
      host.setAttribute("data-stringify-ignore", "true")
      result.setAttribute("data-stringify-ignore", "true")
      result.textContent = ""
      result.style.display = "none"
      actions.style.display = "none"
    }
  }

  const translate = async (
    forceRefresh = false,
    urgent = false,
    priority = false,
    manual = false,
  ): Promise<string | undefined> => {
    if (translating || mirroredTranslating) {
      if (!urgent || apiStarted || mirroredApiStarted) return undefined
    }
    translating = true
    urgentTranslating = urgent
    apiStarted = urgent
    currentForceRefresh = forceRefresh
    mirroredTranslating = false
    mirroredUrgent = false
    mirroredApiStarted = false
    prioritize = undefined
    if (forceRefresh) {
      latestTranslationText = ""
    }
    if (activeRequestId) {
      const previousRequestId = activeRequestId
      activeRequestId = undefined
      if (typeof chrome.runtime?.sendMessage === "function") {
        void chrome.runtime
          .sendMessage({ type: "cancel-translation", requestId: previousRequestId })
          .catch(() => undefined)
      }
      currentOnTranslationEnd?.(previousRequestId)
    }
    translation.style.borderLeft = `2px solid ${urgent ? SLACKTOR_COLORS.urgent : SLACKTOR_COLORS.primary}`
    const generation = ++requestGeneration
    const requestId = crypto.randomUUID()
    activeRequestId = requestId
    showSpinner(!urgent, urgent)
    currentOnTranslationStart?.(forceRefresh, urgent, manual, requestId)

    try {
      await currentWaitForPersist().catch(() => undefined)
      if (generation !== requestGeneration) return undefined
      const response = await sendTranslationRequest(
        currentMessage,
        forceRefresh,
        urgent,
        priority,
        requestId,
      )

      if (generation !== requestGeneration) return undefined
      translating = false
      urgentTranslating = false
      apiStarted = false
      activeRequestId = undefined

      if (!response?.ok) {
        if (response?.cancelled) return undefined
        const errorMsg = response?.error ?? "Translation failed."
        showRetry(errorMsg)
        currentOnTranslationError?.(errorMsg)
        return undefined
      }

      applyTranslation(response.translation)
      currentOnTranslationComplete?.(response.translation)
      return response.translation
    } catch (error: unknown) {
      // Reloading the extension destroys an in-flight content-script context.
      // Avoid emitting an uncaught error from the old renderer instance.
      if (generation === requestGeneration) {
        translating = false
        urgentTranslating = false
        apiStarted = false
        activeRequestId = undefined
        if (!isContextInvalidated(error) && !isAbortError(error)) {
          const errorMsg = "Translation failed."
          showRetry(errorMsg)
          currentOnTranslationError?.(errorMsg)
        } else if (isContextInvalidated(error)) {
          showRetry("Extension reloaded. Please refresh Slack (F5).")
        }
      }
      return undefined
    } finally {
      if (generation === requestGeneration) {
        translating = false
        urgentTranslating = false
        apiStarted = false
        activeRequestId = undefined
      }
      currentOnTranslationEnd?.(requestId)
    }
  }

  const showRetry = (error: string) => {
    mirroredTranslating = false
    mirroredUrgent = false
    mirroredApiStarted = false
    prioritize = undefined
    host.setAttribute("data-stringify-ignore", "true")
    result.setAttribute("data-stringify-ignore", "true")
    translation.style.borderLeft = `2px solid ${SLACKTOR_COLORS.destructive}`
    translation.style.display = "flex"
    translation.style.alignItems = "center"
    translation.style.gap = "6px"
    actions.style.display = "none"
    result.style.display = "inline-flex"
    result.style.alignItems = "center"
    result.style.marginLeft = "0"
    result.style.fontSize = ""
    result.style.fontStyle = ""
    result.style.opacity = ""
    result.textContent = error
    button.disabled = false
    button.style.display = "inline-flex"
    setRetranslateIcon(button)
    button.title = "Retry translation"
    button.setAttribute("aria-label", "Retry translation")
    latestTranslationText = ""
  }

  button.addEventListener("click", (event) => {
    event.stopPropagation()
    if (prioritize) {
      prioritize()
      return
    }
    const label = button.getAttribute("aria-label") || button.dataset.slacktorTitle || button.title
    if (translating || mirroredTranslating || label === "Translate now") {
      if (apiStarted || mirroredApiStarted) return
      void translate(currentForceRefresh, true, false, true)
      return
    }
    const isRetryOrRetranslate = label === "Retry translation" || label === "Retranslate message"
    void translate(isRetryOrRetranslate, false, false, true)
  })

  translation.append(button, result, actions)
  translation.style.cssText = [
    "display:flex",
    "align-items:center",
    "gap:6px",
    "padding:3px 7px",
    `border-left:2px solid ${SLACKTOR_COLORS.primary}`,
    `color:${SLACKTOR_COLORS.mutedForeground}`,
    "font:inherit",
    "line-height:inherit",
  ].join(";")
  host.append(translation)

  // Keep the translation inside Slack's message-text block, but as its final
  // block child. This prevents it from being inserted between paragraphs or
  // list blocks in multi-section messages.
  mountHost(anchor, host)
  messageNode.setAttribute(RENDERED_ATTRIBUTE, "")
  const controller: TranslationController = {
    run: (priority = false) => translate(false, false, priority, false),
    runUrgent: (forceRefresh = currentForceRefresh) => translate(forceRefresh, true, false, true),
    markQueued(onPrioritize) {
      mirroredTranslating = false
      mirroredUrgent = false
      mirroredApiStarted = false
      host.setAttribute("data-stringify-ignore", "true")
      result.setAttribute("data-stringify-ignore", "true")
      translation.style.borderLeft = `2px solid ${SLACKTOR_COLORS.primary}`
      translation.style.display = "flex"
      translation.style.alignItems = "center"
      translation.style.gap = "6px"
      prioritize = onPrioritize
      actions.style.display = "none"
      button.style.display = "inline-flex"
      button.disabled = false
      result.style.display = "inline-flex"
      result.style.alignItems = "center"
      result.style.marginLeft = "0"
      setLightningIcon(button)
      button.title = "Translate next"
      button.setAttribute("aria-label", "Translate next")
      result.textContent = "Translation queued"
    },
    markPrioritized(urgent = false, hasApiStarted = false, forceRefresh = false) {
      prioritize = undefined
      currentForceRefresh = forceRefresh
      const started = urgent || hasApiStarted
      if (!translating) {
        mirroredTranslating = true
        mirroredUrgent = urgent
        mirroredApiStarted = started
      }
      translation.style.borderLeft = `2px solid ${urgent ? SLACKTOR_COLORS.urgent : SLACKTOR_COLORS.primary}`
      showSpinner(!started, urgent)
    },
    markApiStarted() {
      if (!translating && !mirroredTranslating) return
      if (translating) apiStarted = true
      if (mirroredTranslating) mirroredApiStarted = true
      showSpinner(false, urgentTranslating || mirroredUrgent)
    },
    retranslate: (priority = false) => translate(true, false, priority, true),
    applyTranslation,
    markStopped() {
      mirroredTranslating = false
      mirroredUrgent = false
      mirroredApiStarted = false
      host.setAttribute("data-stringify-ignore", "true")
      result.setAttribute("data-stringify-ignore", "true")
      translation.style.borderLeft = `2px solid ${SLACKTOR_COLORS.primary}`
      translation.style.display = "flex"
      translation.style.alignItems = "center"
      translation.style.gap = "6px"
      prioritize = undefined
      actions.style.display = "none"
      result.style.display = "inline-flex"
      result.style.alignItems = "center"
      result.style.marginLeft = "0"
      result.textContent = "Translation stopped."
      button.disabled = false
      button.style.display = "inline-flex"
      setRetranslateIcon(button)
      button.title = "Retranslate message"
      button.setAttribute("aria-label", "Retranslate message")
    },
    markSkipped(reason: string) {
      mirroredTranslating = false
      mirroredUrgent = false
      mirroredApiStarted = false
      host.setAttribute("data-stringify-ignore", "true")
      result.setAttribute("data-stringify-ignore", "true")
      translation.style.borderLeft = `2px solid ${SLACKTOR_COLORS.primary}`
      translation.style.display = "flex"
      translation.style.alignItems = "center"
      translation.style.gap = "6px"
      prioritize = undefined
      actions.style.display = "none"
      button.style.display = "inline-flex"
      button.disabled = false
      setRetranslateIcon(button)
      button.title = "Translate message manually"
      button.setAttribute("aria-label", "Translate message manually")
      result.style.display = "inline-flex"
      result.style.alignItems = "center"
      result.style.marginLeft = "0"
      result.style.fontSize = "12px"
      result.style.fontStyle = "italic"
      result.style.opacity = "0.75"
      result.textContent = reason
      latestTranslationText = ""
    },
    markSameLanguage,
    isConnected: () => messageNode.isConnected,
    isTranslated: () => Boolean(latestTranslationText),
    cancel() {
      const cancelledRequestId = activeRequestId
      prioritize = undefined
      requestGeneration += 1
      translating = false
      urgentTranslating = false
      apiStarted = false
      mirroredTranslating = false
      mirroredUrgent = false
      mirroredApiStarted = false
      if (activeRequestId) {
        if (typeof chrome.runtime?.sendMessage === "function") {
          void chrome.runtime
            .sendMessage({ type: "cancel-translation", requestId: activeRequestId })
            .catch(() => undefined)
        }
        activeRequestId = undefined
      }
      if (cancelledRequestId) {
        currentOnTranslationEnd?.(cancelledRequestId)
      }
    },
    getSourceText: () => currentMessage.sourceText,
    updateMessage(updatedMessage: RawSlackMessage, nextWaitForPersist?: PersistWaiter) {
      currentMessage = updatedMessage
      if (nextWaitForPersist) currentWaitForPersist = nextWaitForPersist
      host.dataset.sourceMessageId = updatedMessage.messageId
    },
    markOutdated() {
      mirroredTranslating = false
      mirroredUrgent = false
      mirroredApiStarted = false
      host.setAttribute("data-stringify-ignore", "true")
      result.setAttribute("data-stringify-ignore", "true")
      translation.style.borderLeft = `2px solid ${SLACKTOR_COLORS.primary}`
      translation.style.padding = "3px 7px"
      translation.style.display = "flex"
      translation.style.alignItems = "center"
      translation.style.gap = "6px"
      prioritize = undefined
      actions.style.display = "none"
      button.style.display = "inline-flex"
      button.disabled = false
      setRetranslateIcon(button)
      button.title = "Retranslate message"
      button.setAttribute("aria-label", "Retranslate message")
      result.style.color = ""
      result.style.display = "inline-flex"
      result.style.alignItems = "center"
      result.style.marginLeft = "0"
      result.style.fontSize = "12px"
      result.style.fontStyle = "italic"
      result.style.opacity = "0.75"
      result.textContent = "Message edited"
      latestTranslationText = ""
    },
    isQueued: () => Boolean(prioritize),
    isTranslating: () => translating || mirroredTranslating,
    isUrgent: () => (translating && urgentTranslating) || (mirroredTranslating && mirroredUrgent),
    isApiStarted: () => (translating && apiStarted) || (mirroredTranslating && mirroredApiStarted),
    showRetry,
    setCallbacks(callbacks: TranslationCallbacks, nextWaitForPersist?: PersistWaiter) {
      currentOnTranslationComplete = callbacks.onTranslationComplete
      currentOnTranslationStart = callbacks.onTranslationStart
      currentOnTranslationError = callbacks.onTranslationError
      currentOnTranslationEnd = callbacks.onTranslationEnd
      if (nextWaitForPersist) currentWaitForPersist = nextWaitForPersist
    },
  }

  nodeControllers.set(messageNode, controller)
  return controller
}

function setPlayIcon(button: HTMLButtonElement): void {
  button.innerHTML = PLAY_ICON
  const icon = button.querySelector("svg")
  if (icon instanceof SVGElement)
    icon.style.cssText = "display:block;fill:currentColor;height:14px;width:14px;"
}

function setLightningIcon(button: HTMLButtonElement): void {
  button.innerHTML = LIGHTNING_ICON
  const icon = button.querySelector("svg")
  // Lightning/retranslate are stroke-only lucide glyphs (fill: none already
  // set as an SVG attribute); only size them here, don't force a CSS fill
  // that would override the outline look.
  if (icon instanceof SVGElement) icon.style.cssText = "display:block;height:14px;width:14px;"
}

function setRetranslateIcon(button: HTMLButtonElement): void {
  button.innerHTML = RETRANSLATE_ICON
  const icon = button.querySelector("svg")
  if (icon instanceof SVGElement) icon.style.cssText = "display:block;height:14px;width:14px;"
}

function setCopyIcon(button: HTMLButtonElement): void {
  button.innerHTML = COPY_ICON
  const icon = button.querySelector("svg")
  if (icon instanceof SVGElement) icon.style.cssText = "display:block;height:14px;width:14px;"
}

function setCheckIcon(button: HTMLButtonElement): void {
  button.innerHTML = CHECK_ICON
  const icon = button.querySelector("svg")
  // Green is intentional here (distinct from the primary purple used for the
  // idle action icons) so the "copied" confirmation reads as a clear success
  // state. Uses the shared success token instead of an ad-hoc hex so it
  // matches the popup's own "Copied!" checkmark (QuickResultCard's
  // text-success class).
  if (icon instanceof SVGElement)
    icon.style.cssText = `display:block;height:14px;width:14px;color:${SLACKTOR_COLORS.success}`
}

function ensureSlacktorStyles(): void {
  if (typeof document === "undefined" || document.getElementById("slacktor-shared-styles")) return
  const style = document.createElement("style")
  style.id = "slacktor-shared-styles"
  style.textContent = `@keyframes slacktor-spin { to { transform: rotate(360deg); } }
.slacktor-translation__content {
  line-height: 1.45;
}
.slacktor-translation__content .c-mrkdwn__quote:before,
.slacktor-translation__content .c-mrkdwn__quote:after,
.slacktor-translation__content .c-mrkdwn__pre:before,
.slacktor-translation__content .p-rich_text_list:before {
  top: 0 !important;
  height: 100% !important;
}`
  ;(document.head || document.documentElement).appendChild(style)
}

function setSpinnerIcon(container: HTMLElement, urgent = false): void {
  ensureSlacktorStyles()
  container.innerHTML = urgent ? URGENT_SPINNER_ICON : SPINNER_ICON
}

let activeTooltipEl: HTMLDivElement | null = null

function showInstantTooltip(target: HTMLElement, text: string): void {
  hideInstantTooltip()
  if (!text) return

  const tooltip = document.createElement("div")
  tooltip.className = "notranslate slacktor-tooltip"
  tooltip.textContent = text
  tooltip.style.cssText = [
    "position:fixed",
    "z-index:99999",
    `background:${SLACKTOR_COLORS.tooltipBackground}`,
    `color:${SLACKTOR_COLORS.tooltipForeground}`,
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
    "font-size:11px",
    "font-weight:500",
    "line-height:1.3",
    "padding:3px 7px",
    "border-radius:4px",
    "box-shadow:0 2px 8px rgba(0,0,0,0.35)",
    "pointer-events:none",
    "white-space:nowrap",
    "opacity:0",
    "transform:translateY(2px)",
    "transition:opacity 0.1s ease, transform 0.1s ease",
  ].join(";")

  document.body.appendChild(tooltip)
  activeTooltipEl = tooltip

  const rect = target.getBoundingClientRect()
  const tooltipRect = tooltip.getBoundingClientRect()

  let top = rect.top - tooltipRect.height - 6
  let left = rect.left + rect.width / 2 - tooltipRect.width / 2

  if (top < 4) {
    top = rect.bottom + 6
  }
  if (left < 6) left = 6
  if (left + tooltipRect.width > window.innerWidth - 6) {
    left = window.innerWidth - tooltipRect.width - 6
  }

  tooltip.style.top = `${Math.round(top)}px`
  tooltip.style.left = `${Math.round(left)}px`

  requestAnimationFrame(() => {
    if (activeTooltipEl === tooltip) {
      tooltip.style.opacity = "1"
      tooltip.style.transform = "translateY(0)"
    }
  })
}

function hideInstantTooltip(): void {
  if (activeTooltipEl) {
    activeTooltipEl.remove()
    activeTooltipEl = null
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("scroll", hideInstantTooltip, { capture: true, passive: true })
}

function attachInstantTooltip(button: HTMLElement, getTooltipText: () => string): void {
  button.addEventListener("mouseenter", () => {
    if (button.hasAttribute("title")) {
      button.dataset.slacktorTitle = button.getAttribute("title") || ""
      button.removeAttribute("title")
    }
    showInstantTooltip(button, getTooltipText())
  })
  button.addEventListener("mouseleave", () => {
    if (button.dataset.slacktorTitle !== undefined) {
      button.setAttribute("title", button.dataset.slacktorTitle)
    }
    hideInstantTooltip()
  })
}

function fallbackCopy(text: string): void {
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand("copy")
  } catch {
    // Ignore copy error
  }
  textarea.remove()
}

function createRetranslateButton(onTranslate: () => void): HTMLButtonElement {
  const button = document.createElement("button")
  button.type = "button"
  button.setAttribute(RETRANSLATE_ACTION_ATTRIBUTE, "")
  button.setAttribute("data-stringify-ignore", "true")
  isolateInteractiveControl(button)
  setRetranslateIcon(button)
  button.title = "Retranslate message"
  button.setAttribute("aria-label", "Retranslate message")
  button.style.cssText = [
    "border:0",
    "background:transparent",
    `color:${SLACKTOR_COLORS.primary}`,
    "cursor:pointer",
    "display:none",
    "font:inherit",
    "padding:2px",
    "vertical-align:middle",
    "line-height:0",
    "opacity:0.75",
    "transition:opacity 0.15s ease",
  ].join(";")
  button.addEventListener("mouseenter", () => {
    button.style.opacity = "1"
  })
  button.addEventListener("mouseleave", () => {
    button.style.opacity = "0.75"
  })
  button.addEventListener("click", (event) => {
    event.stopPropagation()
    onTranslate()
  })
  attachInstantTooltip(button, () => "Retranslate message")
  return button
}

function createCopyButton(getText: () => string): HTMLButtonElement {
  const button = document.createElement("button")
  button.type = "button"
  button.setAttribute("data-slacktor-copy-action", "")
  button.setAttribute("data-stringify-ignore", "true")
  isolateInteractiveControl(button)
  setCopyIcon(button)
  button.title = "Copy translation"
  button.setAttribute("aria-label", "Copy translation")
  button.style.cssText = [
    "border:0",
    "background:transparent",
    `color:${SLACKTOR_COLORS.primary}`,
    "cursor:pointer",
    "display:none",
    "font:inherit",
    "padding:2px",
    "vertical-align:middle",
    "line-height:0",
    "opacity:0.75",
    "transition:opacity 0.15s ease",
  ].join(";")

  let isCopied = false
  let resetTimeout: ReturnType<typeof setTimeout> | undefined

  button.addEventListener("mouseenter", () => {
    button.style.opacity = "1"
  })
  button.addEventListener("mouseleave", () => {
    button.style.opacity = "0.75"
  })

  button.addEventListener("click", (event) => {
    event.stopPropagation()
    const rawText = getText()
    if (!rawText) return
    const text = rawText
      .replace(/\[((?:\[[^\]\n]*\]|[^\]\n])+)\]\(slack:\/\/[^)]+\)/g, "$1")
      .replace(/\[((?:\[[^\]\n]*\]|[^\]\n])+)\]\((?:https?:\/\/|mailto:)[^)]+\)/g, "$1")
      .replace(/\[(@[^\]\n]+)\]/g, "$1")
      .replace(/\[(#[a-zA-Z0-9_-]+)\]/g, "$1")
      .trim()
    const doCopy = () => {
      isCopied = true
      setCheckIcon(button)
      button.setAttribute("aria-label", "Copied!")
      showInstantTooltip(button, "Copied!")

      if (resetTimeout) clearTimeout(resetTimeout)
      resetTimeout = setTimeout(() => {
        isCopied = false
        setCopyIcon(button)
        button.setAttribute("aria-label", "Copy translation")
        if (button.matches(":hover")) {
          showInstantTooltip(button, "Copy translation")
        } else {
          hideInstantTooltip()
        }
      }, 1500)
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(doCopy)
        .catch(() => {
          fallbackCopy(text)
          doCopy()
        })
    } else {
      fallbackCopy(text)
      doCopy()
    }
  })

  attachInstantTooltip(button, () => (isCopied ? "Copied!" : "Copy translation"))
  return button
}

function sendTranslationRequest(
  message: RawSlackMessage,
  forceRefresh: boolean,
  urgent = false,
  priority = false,
  requestId?: string,
): Promise<TranslateResponse | undefined> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        { type: "translate", message, forceRefresh, urgent, priority, requestId },
        (response: TranslateResponse | undefined) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }
          resolve(response)
        },
      )
    } catch (error) {
      reject(error)
    }
  })
}

function isContextInvalidated(error: unknown): boolean {
  if (!error) return false
  if (typeof error === "string") return error.includes("Extension context invalidated")
  return error instanceof Error && error.message.includes("Extension context invalidated")
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

// Same stroke-style "Link" glyph as lucide-react's <Link />.
const LINK_ICON_SVG = lucideIcon("Link", {
  style: "height:12px;width:12px;display:inline-block;",
})

function createMentionBadge(mention: string): string {
  return `<span class="c-member_slug" style="background:rgba(29,155,209,0.1);color:var(--p-color-accent, ${SLACKTOR_COLORS.slackLink});padding:1px 4px;border-radius:3px;font-weight:500;text-decoration:none;display:inline-block;line-height:1.35;margin:1px 1px;vertical-align:baseline;cursor:default;user-select:text;">${mention}</span>`
}

function createLinkPill(label: string): string {
  return `<span class="c-link_pill" style="background:rgba(29,155,209,0.1);color:var(--p-color-accent, ${SLACKTOR_COLORS.slackLink});padding:1px 5px;border-radius:3px;font-weight:500;text-decoration:none;display:inline-flex;align-items:baseline;line-height:1.35;margin:1px 0;vertical-align:baseline;cursor:default;user-select:text;"><span style="display:inline-flex;align-items:center;height:1.35em;margin-right:3px;flex-shrink:0;">${LINK_ICON_SVG}</span>${label}</span>`
}

// Lucide-style Paperclip icon for files/attachments
const FILE_ICON_SVG = lucideIcon("Paperclip", {
  style: "height:12px;width:12px;display:inline-block;",
})

function createFilePill(fileName: string): string {
  const cleanName = escapeHtml(fileName)
  return `<span class="c-file_pill" style="background:rgba(128,128,128,0.12);color:var(--p-color-accent, ${SLACKTOR_COLORS.slackLink});padding:1px 5px;border-radius:3px;font-weight:500;text-decoration:none;display:inline-flex;align-items:baseline;line-height:1.35;margin:1px 0;vertical-align:baseline;cursor:default;user-select:text;max-width:100%;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-flex;align-items:baseline;"><span style="display:inline-flex;align-items:center;height:1.35em;margin-right:4px;flex-shrink:0;">${FILE_ICON_SVG}</span>${cleanName}</span></span>`
}

function createChannelBadge(channel: string): string {
  return `<span class="c-channel_name" style="background:rgba(29,155,209,0.08);color:var(--p-color-accent, ${SLACKTOR_COLORS.slackLink});padding:1px 4px;border-radius:3px;font-weight:500;text-decoration:none;display:inline-block;line-height:1.35;margin:1px 1px;vertical-align:baseline;cursor:default;user-select:text;">${channel}</span>`
}

const knownEmojiUrls = new Map<string, string>()

export function harvestEmojis(root: ParentNode = document): void {
  try {
    const images = root.querySelectorAll<HTMLImageElement>(
      "img.c-emoji, .c-emoji img, [data-stringify-type='emoji'] img, img[data-stringify-type='emoji'], img[data-stringify-emoji]",
    )
    for (const img of Array.from(images)) {
      const code = img.getAttribute("alt") || img.dataset.stringifyEmoji
      const src = img.getAttribute("src")
      if (code && src && !src.includes("/files-pri/")) {
        const normalized = code.startsWith(":") && code.endsWith(":") ? code : `:${code}:`
        const cleanName = normalized.slice(1, -1)
        knownEmojiUrls.set(normalized, src)
        knownEmojiUrls.set(cleanName, src)
      }
    }
  } catch {
    // Ignore DOM errors if disconnected
  }
}

function parseMarkdownLists(text: string): string {
  const lines = text.split("\n")
  const result: string[] = []
  let inList = false
  const listStack: Array<{ type: "ul" | "ol"; indent: number; marker: string }> = []

  const listLineRegex = /^([ \t]*)(?:([-*+•])|(\d+[.)]))[ \t]+(.*)$/
  let currentListHtml = ""

  const getBulletStyle = (depth: number, isOrdered: boolean): string => {
    if (isOrdered) {
      const types = ["decimal", "lower-alpha", "lower-roman"]
      return types[Math.min(depth, types.length - 1)]
    }
    const types = ["disc", "circle", "square"]
    return types[Math.min(depth, types.length - 1)]
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const match = line.match(listLineRegex)

    if (match) {
      const indentStr = match[1]
      const rawIndent = indentStr.replace(/\t/g, "  ").length
      const isOrdered = Boolean(match[3])
      const marker = isOrdered ? "ordered" : (match[2] ?? "-")
      const type = isOrdered ? "ol" : "ul"
      const content = match[4]
      const startNum = isOrdered ? Number.parseInt(match[3], 10) : undefined
      const startAttr = isOrdered && startNum && startNum > 1 ? ` start="${startNum}"` : ""
      const valueAttr = isOrdered && startNum ? ` value="${startNum}"` : ""

      if (!inList) {
        inList = true
        listStack.push({ type, indent: rawIndent, marker })
        const depth = listStack.length - 1
        const listStyle = getBulletStyle(depth, isOrdered)
        currentListHtml = `<${type}${startAttr} class="slacktor-list ${isOrdered ? "slacktor-list--ordered" : "slacktor-list--bullet"}" data-indent="${depth}" style="white-space:normal;padding-left:${depth > 0 ? 18 : 22}px;margin:${depth > 0 ? "2px 0" : "4px 0"};list-style-type:${listStyle} !important;list-style-position:outside;"><li${valueAttr} data-stringify-indent="${depth}" style="margin:2px 0;white-space:normal;">${content}`
      } else {
        const rootList = listStack[0]
        const indent =
          !isOrdered &&
          rootList.type === "ul" &&
          rawIndent === rootList.indent &&
          marker !== rootList.marker
            ? rootList.indent + 2
            : rawIndent
        const current = listStack[listStack.length - 1]
        if (indent > current.indent) {
          listStack.push({ type, indent, marker })
          const depth = listStack.length - 1
          const listStyle = getBulletStyle(depth, isOrdered)
          currentListHtml += `<${type}${startAttr} class="slacktor-list ${isOrdered ? "slacktor-list--ordered" : "slacktor-list--bullet"} slacktor-list--nested" data-indent="${depth}" style="white-space:normal;padding-left:18px;margin:2px 0;list-style-type:${listStyle} !important;list-style-position:outside;"><li${valueAttr} data-stringify-indent="${depth}" style="margin:2px 0;white-space:normal;">${content}`
        } else if (indent < current.indent) {
          let closing = ""
          while (listStack.length > 1 && indent < listStack[listStack.length - 1].indent) {
            const popped = listStack.pop()
            if (popped) closing += `</li></${popped.type}>`
          }
          const depth = listStack.length - 1
          currentListHtml += `${closing}</li><li${valueAttr} data-stringify-indent="${depth}" style="margin:2px 0;white-space:normal;">${content}`
        } else {
          const depth = listStack.length - 1
          currentListHtml += `</li><li${valueAttr} data-stringify-indent="${depth}" style="margin:2px 0;white-space:normal;">${content}`
        }
      }
    } else {
      if (inList) {
        if (line.trim() === "") {
          let nextIdx = i + 1
          while (nextIdx < lines.length && lines[nextIdx].trim() === "") {
            nextIdx += 1
          }
          if (nextIdx < lines.length && listLineRegex.test(lines[nextIdx])) {
            continue
          }
        }
        let closing = ""
        while (listStack.length > 0) {
          const popped = listStack.pop()
          if (popped) closing += `</li></${popped.type}>`
        }
        currentListHtml += closing
        result.push(currentListHtml)
        currentListHtml = ""
        inList = false
        if (line.trim() === "") {
          continue
        }
      }
      if (line.trim() === "") {
        let nextIdx = i + 1
        while (nextIdx < lines.length && lines[nextIdx].trim() === "") {
          nextIdx += 1
        }
        if (nextIdx < lines.length && listLineRegex.test(lines[nextIdx])) {
          continue
        }
        if (
          result.length > 0 &&
          (result[result.length - 1].endsWith("</ul>") ||
            result[result.length - 1].endsWith("</ol>"))
        ) {
          continue
        }
      }
      result.push(line)
    }
  }

  if (inList) {
    let closing = ""
    while (listStack.length > 0) {
      const popped = listStack.pop()
      if (popped) closing += `</li></${popped.type}>`
    }
    currentListHtml += closing
    result.push(currentListHtml)
  }

  return result.join("\n")
}

export function formatTranslationHtml(text: string): string {
  // Strip any trailing edited badges
  let processed = text.replace(/(?:^|\s*)\((?:edited|đã chỉnh sửa|編集済み)\)\s*$/gi, "").trim()

  // 1. Strip Slack files, thumbnails, and media attachment links
  processed = stripMediaAndFileLinks(processed)

  // Collapse redundant blank lines between consecutive list items
  let prev = ""
  while (prev !== processed) {
    prev = processed
    processed = processed.replace(
      /((?:^|\r?\n)[ \t]*(?:[-*+•]|\d+[.)])[^\r\n]*)\r?\n\r?\n+(?=[ \t]*(?:[-*+•]|\d+[.)])[ \t]+)/g,
      "$1\n",
    )
  }

  const tokens: string[] = []
  const createToken = (html: string): string => {
    const id = `\uE000${tokens.length}\uE001`
    tokens.push(html)
    return id
  }

  // 2. Extract and preserve multi-line code blocks before escaping
  processed = processed.replace(
    /(^|\r?\n)([ \t\u00A0]*>+[ \t\u00A0]*)?```(?:[a-zA-Z0-9_-]+)?[ \t]*\r?\n(?:[ \t\u00A0]*>+[ \t\u00A0]*)?```([a-zA-Z0-9_-]+)?[ \t]*\r?\n([\s\S]*?)\r?\n(?:[ \t\u00A0]*>+[ \t\u00A0]*)?```[ \t]*\r?\n(?:[ \t\u00A0]*>+[ \t\u00A0]*)?```(?=[ \t]*(?:\r?\n|$))/g,
    "$1$2```$3\n$4\n$2```",
  )
  processed = processed.replace(
    /(^|\r?\n)?([ \t\u00A0]*>+[ \t\u00A0]*)?```(?:[a-zA-Z0-9_-]+)?[ \t]*\r?\n?([\s\S]*?)```[ \t]*(?=\r?\n|$)/g,
    (
      _match,
      leadingBreak: string | undefined,
      quotePrefix: string | undefined,
      rawCode: string,
      offset: number,
      fullText: string,
    ) => {
      let effectiveQuotePrefix = quotePrefix ?? ""
      if (!effectiveQuotePrefix && leadingBreak !== undefined) {
        const beforeText = fullText.slice(0, offset)
        const prevLines = beforeText.split(/\r?\n/).filter((l) => l.trim().length > 0)
        const prevLine = prevLines[prevLines.length - 1] ?? ""
        const prevQuoteMatch = prevLine.match(/^([ \t\u00A0]*>+[ \t\u00A0]*)/)
        const closingFenceQuoteMatch = rawCode.match(/\r?\n([ \t\u00A0]*>+[ \t\u00A0]*)$/)
        const innerLines = rawCode.split(/\r?\n/).filter((l) => l.trim().length > 0)
        const allInnerLinesQuoted =
          innerLines.length > 0 && innerLines.every((l) => /^[ \t\u00A0]*>+/.test(l))
        if (closingFenceQuoteMatch) {
          effectiveQuotePrefix = closingFenceQuoteMatch[1]
        } else if (prevQuoteMatch && allInnerLinesQuoted) {
          effectiveQuotePrefix = prevQuoteMatch[1]
        }
      }

      let cleanedCode = rawCode
      const quoteDepth = (effectiveQuotePrefix.match(/>/g) ?? []).length
      if (quoteDepth > 0) {
        cleanedCode = cleanedCode.replace(/\r?\n[ \t\u00A0]*>+[ \t\u00A0]*$/, "")
        const lineQuoteRegex = new RegExp(`^[ \\t\\u00A0]*(?:>[ \\t\\u00A0]?){1,${quoteDepth}}`)
        cleanedCode = cleanedCode
          .split(/\r?\n/)
          .map((line) => line.replace(lineQuoteRegex, ""))
          .join("\n")
      }

      const trimmedCode = cleanedCode.trim()
      if (!trimmedCode) return ""
      const escaped = escapeHtml(trimmedCode)
      const token = createToken(
        `<pre class="c-mrkdwn__pre p-rich_text_preformatted" style="background:rgba(128,128,128,0.14);border:1px solid rgba(128,128,128,0.22);color:currentColor;border-radius:4px;padding:6px 8px;margin:6px 0;font-family:Monaco,Menlo,Consolas,Courier,monospace;font-size:12px;line-height:1.4;overflow-x:auto;"><code>${escaped}</code></pre>`,
      )
      return `${leadingBreak ?? ""}${effectiveQuotePrefix}${token}`
    },
  )

  // 3. Escape HTML of the remaining text
  processed = escapeHtml(processed)

  // 4. Inline code: `code`
  processed = processed.replace(/`([^`\n]+)`/g, (_match, rawCode: string) => {
    const code = rawCode
      .replace(/^(\*{1,2})([^*\s\n][^*\n]*?)\1$/, "$2")
      .replace(/^(_+)([^_\s\n][^_\n]*?)\1$/, "$2")
    return createToken(
      `<code class="c-mrkdwn__code" style="background:rgba(128,128,128,0.14);border:1px solid rgba(128,128,128,0.22);color:currentColor;padding:1.5px 5px;border-radius:4px;font-family:Monaco,Menlo,Consolas,Courier,monospace;font-size:12px;">${code}</code>`,
    )
  })

  // 5. Markdown links: [label](url) -> non-clickable styled span
  processed = processed.replace(
    /\[((?:\[[^\]\n]*\]|[^\]\n])+)\]\(((?:https?:\/\/|mailto:|slack:\/\/)[^\s)<>"]+)\)/g,
    (_match, label: string, url: string) => {
      if (url === "slack://file" || url.includes(".slack.com/files/")) {
        let fileName = label
        if (fileName.startsWith("http://") || fileName.startsWith("https://")) {
          const path = fileName.split("?")[0].split("#")[0]
          fileName = decodeURIComponent(path.split("/").pop() || "file")
        }
        return createToken(createFilePill(fileName))
      }
      if (
        url.includes("files.slack.com") ||
        url.includes("/files-pri/") ||
        url.includes("/files-tmb/")
      ) {
        return ""
      }
      const isMention =
        label.startsWith("@") ||
        url === "slack://mention" ||
        url.includes("/team/") ||
        url.includes("/user/")
      if (isMention) {
        return createToken(createMentionBadge(label))
      }
      if (label.startsWith("#") || url === "slack://channel") {
        return createToken(createChannelBadge(label))
      }
      return createToken(createLinkPill(label.replace(/^mailto:/i, "")))
    },
  )

  // 6. Slack mrkdwn links: &lt;url|label&gt; -> non-clickable styled span
  processed = processed.replace(
    /&lt;((?:https?:\/\/|mailto:|slack:\/\/)[^\s|]+)\|([^&]+)&gt;/g,
    (_match, url: string, label: string) => {
      if (url === "slack://file" || url.includes(".slack.com/files/")) {
        let fileName = label
        if (fileName.startsWith("http://") || fileName.startsWith("https://")) {
          const path = fileName.split("?")[0].split("#")[0]
          fileName = decodeURIComponent(path.split("/").pop() || "file")
        }
        return createToken(createFilePill(fileName))
      }
      if (
        url.includes("files.slack.com") ||
        url.includes("/files-pri/") ||
        url.includes("/files-tmb/")
      ) {
        return ""
      }
      const isMention =
        label.startsWith("@") ||
        url === "slack://mention" ||
        url.includes("/team/") ||
        url.includes("/user/")
      if (isMention) {
        return createToken(createMentionBadge(label))
      }
      if (label.startsWith("#") || url === "slack://channel") {
        return createToken(createChannelBadge(label))
      }
      return createToken(createLinkPill(label.replace(/^mailto:/i, "")))
    },
  )

  // 7. Slack mrkdwn channel links: &lt;#C123|channel-name&gt;
  processed = processed.replace(
    /&lt;#[A-Z0-9]+(?:\|([^&]+))?&gt;/g,
    (_match, channelName?: string) => {
      const name = channelName ? `#${channelName}` : "#channel"
      return createToken(createChannelBadge(name))
    },
  )

  // 8. Raw URLs: https://... or http://... -> non-clickable styled span
  processed = processed.replace(
    /(^|[\s(])(https?:\/\/[^\s)<>"'`]+)/g,
    (_match, prefix: string, url: string) => {
      if (url.includes(".slack.com/files/")) {
        const path = url.split("?")[0].split("#")[0]
        const fileName = decodeURIComponent(path.split("/").pop() || "file")
        const token = createToken(createFilePill(fileName))
        return `${prefix}${token}`
      }
      if (
        url.includes("files.slack.com") ||
        url.includes("/files-pri/") ||
        url.includes("/files-tmb/")
      ) {
        return prefix
      }
      const token = createToken(createLinkPill(url))
      return `${prefix}${token}`
    },
  )

  // 8b. Explicit mailto: URIs -> non-clickable styled span
  // Plain-text email addresses (not wrapped in [email](slack://email) by slack-adapter)
  // were not links in the original Slack message and must remain plain text.
  processed = processed.replace(
    /(^|[\s(])mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?=[.,!?;:\s)]|$)/g,
    (_match, prefix: string, email: string) => {
      const token = createToken(createLinkPill(email))
      return `${prefix}${token}`
    },
  )

  // 9a. Bracketed mentions: [@user]
  processed = processed.replace(/\[(@[^\]\n]+)\]/g, (_match, mention: string) => {
    return createToken(createMentionBadge(mention))
  })

  // 9b. Broadcast mentions: @channel, @here, @everyone
  processed = processed.replace(
    /(^|[\s(])(@(?:channel|here|everyone))(?=[.,!?;:\s)]|$)/gi,
    (_match, prefix: string, mention: string) => {
      const token = createToken(createMentionBadge(mention))
      return `${prefix}${token}`
    },
  )

  // 10. Bracketed channels: [#channel-name]
  processed = processed.replace(/\[(#[a-zA-Z0-9_-]+)\]/g, (_match, channel: string) => {
    return createToken(createChannelBadge(channel))
  })

  // 11. Emojis: :emoji_name: or :emoji_name::skin-tone-X:
  processed = processed.replace(
    /(?<!\d):([a-zA-Z0-9_+-]+(?:::skin-tone-[1-6])?):(?!\d)/g,
    (fullMatch, emojiName: string) => {
      const normalizedCode = `:${emojiName}:`
      let src = knownEmojiUrls.get(normalizedCode) || knownEmojiUrls.get(emojiName)
      if (!src && typeof document !== "undefined") {
        harvestEmojis(document)
        src = knownEmojiUrls.get(normalizedCode) || knownEmojiUrls.get(emojiName)
      }
      if (src) {
        return createToken(
          `<span class="c-emoji c-emoji__medium c-emoji--inline" style="display:inline-block;vertical-align:middle;line-height:1;"><img src="${src}" alt="${normalizedCode}" title="${normalizedCode}" style="width:20px;height:20px;vertical-align:-3px;object-fit:contain;display:inline-block;" /></span>`,
        )
      }

      return fullMatch
    },
  )

  // 12. Bold: *text* or **text**
  processed = processed.replace(
    /(?:\*\*([^*\n]+)\*\*|\*([^*\n]+)\*)/g,
    (_match, g1?: string, g2?: string) => {
      return `<strong>${g1 || g2}</strong>`
    },
  )

  // 13. Italic: _text_
  processed = processed.replace(/_([^_\n]+)_/g, (_match, italic: string) => {
    return `<em>${italic}</em>`
  })

  // 14. Strikethrough: ~text~
  processed = processed.replace(/~([^~\n]+)~/g, (_match, strike: string) => {
    return `<del>${strike}</del>`
  })

  // 15. Lists: parse markdown lists into native Slack ul/ol/li structure with multi-level nesting
  processed = parseMarkdownLists(processed)

  // 15b. Markdown headers (#, ##, ###) from Block Kit rich_text_header
  processed = processed.replace(
    /(^|\r?\n)[ \t]*(#{1,3})[ \t]+([^\r\n]+)/g,
    (_match, prefix: string, hashes: string, headingText: string) => {
      const level = hashes.length
      const fontSize = level === 1 ? "16px" : level === 2 ? "15px" : "14px"
      return `${prefix}<div class="p-rich_text_header" style="font-size:${fontSize};font-weight:700;line-height:1.35;margin:4px 0 2px;">${headingText.trim()}</div>`
    },
  )

  // 16. Blockquotes: group consecutive lines starting with &gt; or &gt;&gt;
  // Runs after inline formatting so blockquote HTML classes/styles are not scanned by markdown regexes.
  // Forwarded message cards (starting with ↳) use a card background without border-left to avoid double lines.
  // Regular blockquotes preserve Slack's standard quote style with border-left and transparent background.
  // Nested quotes (starting with &gt;&gt;) preserve Slack's native c-mrkdwn__quote_group and inner c-mrkdwn__quote structure.
  processed = processed.replace(
    /(^|\r?\n)((?:[ \t\u00A0]*(?<!\\)(?:&gt;)+(?:[ \t\u00A0]?[^\r\n]*)?(?:\r?\n|$)(?:[ \t\u00A0]*\r?\n(?=[ \t\u00A0]*(?<!\\)(?:&gt;)+))?)+)/g,
    (_match, prefix: string, block: string) => {
      const rawLines = block
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)

      const hasNested = rawLines.some((l) => /^[ \t\u00A0]*(?<!\\)(?:&gt;[ \t\u00A0]*){2,}/.test(l))
      const isForwarded = rawLines.some((l) => /^\s*(?:<[^>]+>)*\s*↳/.test(l) || l.includes("↳"))

      if (isForwarded) {
        let headerHtml = ""
        const bodyLines: string[] = []

        for (const line of rawLines) {
          if (!headerHtml && (/^\s*(?:<[^>]+>)*\s*↳/.test(line) || line.includes("↳"))) {
            const stripped = line.replace(/^[ \t\u00A0]*(?<!\\)(?:&gt;[ \t\u00A0]*)+/, "")
            headerHtml = stripped.replace(
              /^((?:<[^>]+>)*\s*↳\s*)([^\n:]+)(:?(?:<\/[^>]+>)*)\r?\n*/m,
              (_m, p1: string, name: string, p3: string) => {
                const cleanName = name.replace(/<\/?(?:strong|b)>/gi, "").trim()
                return `<div class="slacktor-forwarded-header" style="font-weight:600;margin-bottom:4px;opacity:0.95;">${p1}<strong style="font-weight:700;">${cleanName}</strong>${p3}</div>`
              },
            )
          } else {
            bodyLines.push(line)
          }
        }

        const hasNestedInCard = bodyLines.some((l) =>
          /^[ \t\u00A0]*(?<!\\)(?:&gt;[ \t\u00A0]*){2,}/.test(l),
        )

        if (!hasNestedInCard) {
          const lines = bodyLines
            .map((l) => l.replace(/^[ \t\u00A0]*(?<!\\)(?:&gt;[ \t\u00A0]*)+/, ""))
            .join("\n")
            .trim()
          const formattedContent = parseMarkdownLists(lines)
          const inner = [headerHtml, formattedContent].filter(Boolean).join("\n")
          return `${prefix}<div class="slacktor-forwarded-card" style="border:1px solid rgba(128,128,128,0.25);background:rgba(128,128,128,0.06);border-radius:6px;padding:8px 12px;margin:6px 0;display:block;">${inner}</div>`
        }

        type ParsedLine = { isQuote: boolean; content: string }
        const parsedLines: ParsedLine[] = bodyLines.map((line) => {
          const match = line.match(/^[ \t\u00A0]*(?<!\\)((?:&gt;[ \t\u00A0]*)+)[ \t\u00A0]?(.*)$/)
          const count = match ? match[1].match(/&gt;/g)?.length || 1 : 1
          return {
            isQuote: count >= 2,
            content: match ? match[2] : line,
          }
        })

        for (let i = 1; i < parsedLines.length - 1; i++) {
          if (
            !parsedLines[i].content.trim() &&
            parsedLines[i - 1].isQuote &&
            parsedLines[i + 1].isQuote
          ) {
            parsedLines[i].isQuote = true
          }
        }

        type CardSegment = { isQuote: boolean; lines: string[] }
        const segments: CardSegment[] = []
        let currentSeg: CardSegment | null = null

        for (const item of parsedLines) {
          if (!currentSeg || currentSeg.isQuote !== item.isQuote) {
            currentSeg = { isQuote: item.isQuote, lines: [item.content] }
            segments.push(currentSeg)
          } else {
            currentSeg.lines.push(item.content)
          }
        }

        let bodyHtml = ""
        for (const seg of segments) {
          const text = seg.lines.join("\n").trim()
          if (!text) continue
          const formatted = parseMarkdownLists(text)
          if (seg.isQuote) {
            bodyHtml += `<blockquote type="cite" class="c-mrkdwn__quote" data-stringify-type="quote" style="margin:4px 0;display:block;">${formatted}</blockquote>`
          } else {
            bodyHtml += (bodyHtml ? "\n" : "") + formatted
          }
        }

        const inner = [headerHtml, bodyHtml].filter(Boolean).join("\n")
        return `${prefix}<div class="slacktor-forwarded-card" style="border:1px solid rgba(128,128,128,0.25);background:rgba(128,128,128,0.06);border-radius:6px;padding:8px 12px;margin:6px 0;display:block;">${inner}</div>`
      }

      if (!hasNested) {
        const lines = rawLines
          .map((l) => l.replace(/^[ \t\u00A0]*(?<!\\)&gt;[ \t\u00A0]?/, ""))
          .join("\n")
          .trim()
        const formattedLines = parseMarkdownLists(lines)
        return `${prefix}<blockquote type="cite" class="c-mrkdwn__quote" data-stringify-type="quote" style="margin:4px 0;display:block;">${formattedLines}</blockquote>`
      }

      type Segment = { depth: number; lines: string[] }
      const segments: Segment[] = []
      let currentSeg: Segment | null = null

      for (const line of rawLines) {
        const match = line.match(/^[ \t\u00A0]*(?<!\\)((?:&gt;[ \t\u00A0]*)+)[ \t\u00A0]?(.*)$/)
        if (!match) continue
        const count = match[1].match(/&gt;/g)?.length || 1
        const depth = Math.min(count, 2)
        const content = match[2]

        if (!currentSeg || currentSeg.depth !== depth) {
          currentSeg = { depth, lines: [content] }
          segments.push(currentSeg)
        } else {
          currentSeg.lines.push(content)
        }
      }

      let innerHtml = ""
      for (const seg of segments) {
        const content = parseMarkdownLists(seg.lines.join("\n").trim())
        if (seg.depth === 2) {
          innerHtml += `<blockquote type="cite" class="c-mrkdwn__quote" data-stringify-type="quote" data-stringify-border="1" style="margin:4px 0;display:block;">${content}</blockquote>`
        } else {
          innerHtml += `<div class="p-rich_text_section">${content}</div>`
        }
      }

      return `${prefix}<blockquote class="c-mrkdwn__quote_group" data-stringify-type="quote" style="margin:4px 0;display:block;">${innerHtml}</blockquote>`
    },
  )

  // 17. Restore all tokens in one pass
  processed = processed.replace(/\uE000(\d+)\uE001/g, (_match, index: string) => {
    return tokens[Number.parseInt(index, 10)] ?? ""
  })

  // 18. Restore escaped quotes (e.g. \> or \>> from plain text at line start)
  processed = processed.replace(/\\((?:&gt;[ \t\u00A0]*)+)/g, "$1")

  // Strip any trailing edited badges that may have persisted
  processed = processed.replace(/(?:^|\s*)\((?:edited|đã chỉnh sửa|編集済み)\)\s*$/gi, "").trim()

  // Remove redundant newlines adjacent to block elements (lists, cards, blockquotes, pre).
  // Because these are display: block elements, they already establish their own line breaks;
  // in white-space: pre-wrap, any trailing or leading newline creates an extra visible blank line.
  processed = processed
    .replace(/(<\/(?:ul|ol|blockquote|pre|div)>|<hr[^>]*>)[ \t]*\n+/g, "$1")
    .replace(/\n+[ \t]*(<(?:ul|ol|blockquote|pre|div\b|hr\b))/g, "$1")
    .replace(
      /(?<=\r?\n)[ \t\u00A0]+(?=<span class="(?:c-link_pill|c-file_pill|c-member_slug|c-channel_name)")/g,
      "",
    )
    .trim()

  return processed
}
