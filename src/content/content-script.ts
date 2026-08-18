import { startMessageObserver } from "./message-observer"

startMessageObserver()

// Content scripts run in an isolated world, while DevTools Console normally
// evaluates in Slack's page world. Load a small read-only bridge so the user
// can call CheckContext(permalink) directly from Console.
const debugBridge = document.createElement("script")
debugBridge.src = chrome.runtime.getURL("debug-bridge.js")
debugBridge.dataset.slacktorDebugBridge = ""
;(document.head ?? document.documentElement).append(debugBridge)
debugBridge.remove()

// DevTools Console bridge for inspecting persisted thread context. A page-world
// script cannot call chrome.runtime directly, so it requests data through DOM
// events. This is intentionally read-only and requires an explicit console call.
document.addEventListener("slacktor:inspect-thread-context", (event) => {
  const detail = (event as CustomEvent<{ url?: string; requestId?: string }>).detail
  if (!detail?.url) return

  void sendInspectRequest(detail.url)
    .then((response) => {
      document.dispatchEvent(new CustomEvent("slacktor:thread-context-result", {
        detail: { requestId: detail.requestId, response },
      }))
    })
    .catch(() => {
      // The previous content script can be invalidated during an extension
      // reload. Its caller must refresh Slack to receive the new script.
    })
})

function sendInspectRequest(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ type: "inspect-thread-context", url }, (response) => {
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
