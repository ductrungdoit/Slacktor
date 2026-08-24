import type { RawSlackMessage } from "../shared/types"
import type { ThreadContextPlan } from "../shared/types"
import type { TranslateResponse } from "../shared/messages"

const ROOT_ATTRIBUTE = "data-slacktor-translation"
const RENDERED_ATTRIBUTE = "data-slacktor-rendered"

export type TranslationController = {
  run: () => Promise<void>
  markQueued: (prioritize: () => void) => void
  markPrioritized: () => void
  retranslate: () => Promise<void>
  cancel: () => void
}

type ContextLoader = () => Promise<ThreadContextPlan>

export function renderPlaceholder(
  messageNode: HTMLElement,
  anchor: HTMLElement,
  message: RawSlackMessage,
  loadContext: ContextLoader,
): TranslationController | undefined {
  if (messageNode.hasAttribute(RENDERED_ATTRIBUTE)) return undefined

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
  let prioritize: (() => void) | undefined
  const showSpinner = () => {
    button.style.display = "none"
    result.textContent = ""
    result.append(createSpinner())
  }

  const translate = (forceRefresh = false): Promise<void> => {
    if (translating) return Promise.resolve()
    translating = true
    button.disabled = true
    showSpinner()

    return loadContext()
      .catch(() => ({ recentMessages: [] }))
      .then((context) => sendTranslationRequest(message, context, forceRefresh))
      .then((response) => {
        if (!response?.ok) {
          showRetry(response?.error ?? "Translation failed.")
          return
        }

        button.remove()
        result.style.marginLeft = "0"
        result.textContent = response.translation
        result.append(createReloadButton(() => void translate(true)))
      })
      .catch((error: unknown) => {
        // Reloading the extension destroys an in-flight content-script context.
        // Avoid emitting an uncaught error from the old renderer instance.
        if (!isContextInvalidated(error)) showRetry("Translation failed.")
      })
      .finally(() => {
        translating = false
      })
  }

  const showRetry = (error: string) => {
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

  translation.append(button, result)
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
    run: () => translate(),
    markQueued(onPrioritize) {
      prioritize = onPrioritize
      button.innerHTML = "&#8593;"
      button.title = "Translate next"
      button.setAttribute("aria-label", "Translate next")
      result.textContent = "Translation queued"
    },
    markPrioritized() {
      showSpinner()
    },
    retranslate: () => translate(true),
    cancel() {
      translating = false
      showRetry("Translation stopped.")
    },
  }
}

function sendTranslationRequest(
  message: RawSlackMessage,
  context: ThreadContextPlan,
  forceRefresh: boolean,
): Promise<TranslateResponse | undefined> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ type: "translate", message, context, forceRefresh }, (response: TranslateResponse | undefined) => {
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

function createReloadButton(onReload: () => void): HTMLButtonElement {
  const button = document.createElement("button")
  button.type = "button"
  button.innerHTML = "&#8635;"
  button.title = "Retranslate message"
  button.setAttribute("aria-label", "Retranslate message")
  button.style.cssText = "border:0;background:transparent;color:#1264a3;cursor:pointer;font:inherit;margin-left:6px;padding:0"
  button.addEventListener("click", onReload)
  return button
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
