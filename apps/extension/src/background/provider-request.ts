import { providerFetch, ProviderTimeoutError } from "./provider-fetch"

const MAX_ATTEMPTS = 2

type ProviderRequestOptions = {
  signal?: AbortSignal
  onRetryStateChange?: (retrying: boolean) => void
  bypassRateLimit?: boolean
}

/** Sends a chat-completions request with the shared timeout and retry policy.
 * Retries once on 429/502/503/504 or a network error. It never retries a
 * timeout (the user would wait several minutes) or a caller abort. */
export async function providerRequest(
  endpoint: string,
  apiKey: string,
  payload: unknown,
  options: ProviderRequestOptions = {},
): Promise<Response> {
  const { signal, onRetryStateChange, bypassRateLimit = false } = options
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await providerFetch(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal,
        },
        { bypassRateLimit },
      )
      if (response.ok || !isRetriableStatus(response.status) || attempt === MAX_ATTEMPTS - 1) {
        return response
      }
      await waitBeforeRetry(attempt, signal, onRetryStateChange)
    } catch (error) {
      lastError = error
      if (error instanceof ProviderTimeoutError) throw error
      if (signal?.aborted || isAbortError(error)) throw signal?.reason ?? error
      if (attempt === MAX_ATTEMPTS - 1) break
      await waitBeforeRetry(attempt, signal, onRetryStateChange)
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI request failed after retries.")
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

async function waitBeforeRetry(
  attempt: number,
  signal: AbortSignal | undefined,
  onRetryStateChange: ((retrying: boolean) => void) | undefined,
): Promise<void> {
  onRetryStateChange?.(true)
  try {
    await delay(retryDelayMs(attempt), signal)
  } finally {
    onRetryStateChange?.(false)
  }
}

function isRetriableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504
}

function retryDelayMs(attempt: number): number {
  return 400 * 2 ** attempt + Math.floor(Math.random() * 200)
}

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds)
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout)
        reject(new DOMException("Translation terminated.", "AbortError"))
      },
      { once: true },
    )
  })
}
