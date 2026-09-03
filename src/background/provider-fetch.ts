const MIN_REQUEST_INTERVAL_MS = 500

let nextRequestAt = 0
let scheduling = Promise.resolve()

export async function providerFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let release: (() => void) | undefined
  const previous = scheduling
  scheduling = new Promise<void>((resolve) => {
    release = resolve
  })

  await previous
  try {
    const waitMs = Math.max(0, nextRequestAt - Date.now())
    if (waitMs > 0) await delay(waitMs, init?.signal)
    nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS
  } finally {
    release?.()
  }

  await countLlmRequest()
  return fetch(input, init)
}

function delay(milliseconds: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds)
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout)
      reject(signal.reason ?? new DOMException("Request aborted.", "AbortError"))
    }, { once: true })
  })
}
import { countLlmRequest } from "./usage-stats"
