import { countLlmRequest } from "./usage-stats"

const MIN_REQUEST_INTERVAL_MS = 500
export const PROVIDER_TIMEOUT_MS = 180_000

let nextRequestAt = 0
let scheduling = Promise.resolve()

export class ProviderTimeoutError extends Error {
  constructor(timeoutMs = PROVIDER_TIMEOUT_MS) {
    super(`AI request timed out after ${Math.round(timeoutMs / 1000)} seconds.`)
    this.name = "ProviderTimeoutError"
  }
}

type ProviderFetchOptions = {
  /** Skips the shared request spacing queue for urgent requests. */
  bypassRateLimit?: boolean
  timeoutMs?: number
}

export async function providerFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: ProviderFetchOptions = {},
): Promise<Response> {
  if (!options.bypassRateLimit) {
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
  }

  await countLlmRequest()
  return fetchWithTimeout(input, init, options.timeoutMs ?? PROVIDER_TIMEOUT_MS)
}

// The timeout starts after the rate-limit queue so queued requests are not
// penalised for waiting. It stays attached to the response body, which means a
// stalled stream is also aborted. A caller abort always wins over the timeout.
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const callerSignal = init?.signal
  let timedOut = false

  const onCallerAbort = () =>
    controller.abort(callerSignal?.reason ?? new DOMException("Request aborted.", "AbortError"))
  if (callerSignal?.aborted) onCallerAbort()
  else callerSignal?.addEventListener("abort", onCallerAbort, { once: true })

  const timer = setTimeout(() => {
    timedOut = true
    controller.abort(new ProviderTimeoutError(timeoutMs))
  }, timeoutMs)
  callerSignal?.addEventListener("abort", () => clearTimeout(timer), { once: true })

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    clearTimeout(timer)
    if (timedOut && !callerSignal?.aborted) throw new ProviderTimeoutError(timeoutMs)
    throw error
  }
}

function delay(milliseconds: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds)
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout)
        reject(signal.reason ?? new DOMException("Request aborted.", "AbortError"))
      },
      { once: true },
    )
  })
}
