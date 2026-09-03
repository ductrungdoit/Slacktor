import type { RawSlackMessage } from "../shared/types"
import type { ThreadContextPlan } from "../shared/types"
import type { TranslateResponse } from "../shared/messages"

const ROOT_ATTRIBUTE = "data-slacktor-translation"
const RENDERED_ATTRIBUTE = "data-slacktor-rendered"
const RETRANSLATE_ACTION_ATTRIBUTE = "data-slacktor-retranslate-action"
const LIGHTNING_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.2 2.4 5.6 13.2a1 1 0 0 0 .82 1.58h4.46l-.82 6.16a1 1 0 0 0 1.8.72l7.6-10.8a1 1 0 0 0-.82-1.58h-4.46l.82-6.16a1 1 0 0 0-1.8-.72Z"/></svg>'

export type TranslationController = {
  run: (priority?: boolean) => Promise<string | undefined>
  runUrgent: () => Promise<string | undefined>
  markQueued: (prioritize: () => void) => void
  markPrioritized: () => void
  retranslate: () => Promise<string | undefined>
  applyTranslation: (translation: string) => void
  markStopped: () => void
  isConnected: () => boolean
  cancel: () => void
}

type ContextLoader = () => Promise<ThreadContextPlan>

export function renderPlaceholder(
  messageNode: HTMLElement,
  anchor: HTMLElement,
  message: RawSlackMessage,
  loadContext: ContextLoader,
): TranslationController | undefined {
  const existingHost = messageNode.querySelector<HTMLElement>(`[${ROOT_ATTRIBUTE}]`)
  if (messageNode.hasAttribute(RENDERED_ATTRIBUTE) && existingHost?.isConnected) return undefined
  // Slack can replace only the message body when actions such as Save for later
  // update its state. Remove the stale marker so the translation UI can recover.
  messageNode.removeAttribute(RENDERED_ATTRIBUTE)
  existingHost?.remove()

  const host = document.createElement("div")
  host.setAttribute(ROOT_ATTRIBUTE, "")
  host.dataset.sourceMessageId = message.messageId
  host.className = "notranslate slacktor-translation"
  host.lang = "vi"
  host.style.cssText = "display:block;margin-top:6px"

  const translation = document.createElement("div")
  translation.className = "notranslate slacktor-translation__text"
  const button = document.createElement("button")
  button.type = "button"
  button.setAttribute("aria-label", "Translate message")
  button.title = "Translate message"
  button.innerHTML = "&#9654;"
  button.style.cssText = "border:0;background:transparent;color:#1264a3;cursor:pointer;font:inherit;padding:0 4px 0 0"

  const result = document.createElement("span")
  result.style.marginLeft = "4px"
  // AI output can preserve paragraphs, lists, and line breaks from Slack block
  // messages. Render those breaks instead of collapsing them into spaces.
  result.style.whiteSpace = "pre-wrap"
  result.style.overflowWrap = "anywhere"
  result.textContent = "Slacktor"

  let translating = false
  let requestGeneration = 0
  let activeRequestId: string | undefined
  let prioritize: (() => void) | undefined
  const retranslateButton = createRetranslateButton(() => void translate(true))
  const showSpinner = (prioritizable = false) => {
    button.style.display = prioritizable ? "inline" : "none"
    button.disabled = false
    result.style.display = "inline"
    if (prioritizable) {
      setLightningIcon(button)
      button.title = "Translate now"
      button.setAttribute("aria-label", "Translate now")
    }
    result.textContent = ""
    result.append(createSpinner())
  }

  const applyTranslation = (text: string) => {
    prioritize = undefined
    button.remove()
    result.style.marginLeft = "0"
    result.textContent = text
    result.style.display = text ? "inline" : "none"
    retranslateButton.style.display = "inline"
  }

  const translate = (forceRefresh = false, urgent = false, priority = false): Promise<string | undefined> => {
    if (translating && !urgent) return Promise.resolve(undefined)
    translating = true
    const generation = ++requestGeneration
    button.disabled = true
    showSpinner(!urgent && Boolean(prioritize))

    return loadContext()
      .catch(() => ({ recentMessages: [] }))
      .then((context) => {
        activeRequestId = crypto.randomUUID()
        return sendTranslationRequest(message, context, forceRefresh, urgent, priority, activeRequestId)
      })
      .then((response) => {
        if (generation !== requestGeneration) return undefined
        if (!response?.ok) {
          showRetry(response?.error ?? "Translation failed.")
          return undefined
        }

        applyTranslation(response.translation)
        return response.translation
      })
      .catch((error: unknown) => {
        // Reloading the extension destroys an in-flight content-script context.
        // Avoid emitting an uncaught error from the old renderer instance.
        if (generation === requestGeneration && !isContextInvalidated(error)) showRetry("Translation failed.")
        return undefined
      })
      .finally(() => {
        if (generation === requestGeneration) {
          translating = false
          activeRequestId = undefined
        }
      })
  }

  const showRetry = (error: string) => {
    result.style.display = "inline"
    result.textContent = error
    button.disabled = false
    button.style.display = "inline"
    button.innerHTML = "&#8635;"
    button.title = "Retry translation"
    button.setAttribute("aria-label", "Retry translation")
  }

  button.addEventListener("click", () => {
    if (prioritize) {
      prioritize()
      return
    }
    void translate()
  })

  translation.append(button, result, retranslateButton)
  translation.style.cssText = [
    "display:block",
    "padding:3px 7px",
    "border-left:2px solid #7c5cff",
    "color:#616061",
    "font:inherit",
    "line-height:inherit",
    "color:#616061",
  ].join(";")
  host.append(translation)

  // Keep the translation inside Slack's message-text block, but as its final
  // block child. This prevents it from being inserted between paragraphs or
  // list blocks in multi-section messages.
  anchor.append(host)
  messageNode.setAttribute(RENDERED_ATTRIBUTE, "")
  return {
    run: (priority = false) => translate(false, false, priority),
    runUrgent: () => translate(true, true),
    markQueued(onPrioritize) {
      prioritize = onPrioritize
      result.style.display = "inline"
      setLightningIcon(button)
      button.title = "Translate next"
      button.setAttribute("aria-label", "Translate next")
      result.textContent = "Translation queued"
    },
    markPrioritized() {
      showSpinner(false)
    },
    retranslate: () => translate(true),
    applyTranslation,
    markStopped() {
      prioritize = undefined
      result.style.display = "inline"
      result.textContent = "Translation stopped."
      button.disabled = false
      button.style.display = "inline"
      button.innerHTML = "&#8635;"
      button.title = "Retranslate message"
      button.setAttribute("aria-label", "Retranslate message")
    },
    isConnected: () => messageNode.isConnected,
    cancel() {
      requestGeneration += 1
      translating = false
      if (activeRequestId) {
        void chrome.runtime.sendMessage({ type: "cancel-translation", requestId: activeRequestId })
        activeRequestId = undefined
      }
    },
  }
}

function createRetranslateButton(onTranslate: () => void): HTMLButtonElement {
  const button = document.createElement("button")
  button.type = "button"
  button.setAttribute(RETRANSLATE_ACTION_ATTRIBUTE, "")
  button.innerHTML = "&#8635;"
  button.title = "Retranslate message"
  button.setAttribute("aria-label", "Retranslate message")
  button.style.cssText = "border:0;background:transparent;color:#1264a3;cursor:pointer;display:none;font:inherit;margin-left:6px;padding:0"
  button.addEventListener("click", onTranslate)
  return button
}

function setLightningIcon(button: HTMLButtonElement): void {
  button.innerHTML = LIGHTNING_ICON
  const icon = button.querySelector("svg")
  if (icon instanceof SVGElement) icon.style.cssText = "fill:currentColor;height:14px;width:14px;vertical-align:-2px"
}

function sendTranslationRequest(
  message: RawSlackMessage,
  context: ThreadContextPlan,
  forceRefresh: boolean,
  urgent = false,
  priority = false,
  requestId?: string,
): Promise<TranslateResponse | undefined> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ type: "translate", message, context, forceRefresh, urgent, priority, requestId }, (response: TranslateResponse | undefined) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        resolve(response)
      })
    } catch (error) {
      reject(error)
    }
  })
}

function isContextInvalidated(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Extension context invalidated")
}

function createSpinner(): HTMLSpanElement {
  const spinner = document.createElement("span")
  spinner.setAttribute("aria-label", "Translating")
  spinner.setAttribute("role", "status")
  spinner.style.cssText = [
    "display:inline-block",
    "width:0.8em",
    "height:0.8em",
    "border:2px solid #c9c9c9",
    "border-top-color:#616061",
    "border-radius:50%",
    "vertical-align:-0.08em",
    "animation:slacktor-spin 0.7s linear infinite",
  ].join(";")

  const style = document.createElement("style")
  style.textContent = "@keyframes slacktor-spin { to { transform: rotate(360deg); } }"
  spinner.append(style)
  return spinner
}
