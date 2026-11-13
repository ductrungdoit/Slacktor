// Thin typed wrapper around chrome.runtime.sendMessage so hooks/components can
// `await` a response and get chrome.runtime.lastError surfaced as a rejection,
// instead of repeating this boilerplate at every call site.
export function sendExtensionMessage<TResponse>(message: unknown): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response?: TResponse) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        resolve(response as TResponse)
      })
    } catch (error) {
      reject(
        error instanceof Error ? error : new Error("Could not reach the extension background."),
      )
    }
  })
}
