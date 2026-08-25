import { getProviderSettings, saveProviderSettings } from "../shared/settings"
import type { QuickTranslateResponse } from "../shared/messages"
import type { SlacktorLogEntry } from "../background/log-store"

const form = document.querySelector<HTMLFormElement>("#quick-settings")!
const connectionStatus = document.querySelector<HTMLElement>("#connection-status")!
const saveStatus = document.querySelector<HTMLElement>("#save-status")!
const baseUrl = document.querySelector<HTMLInputElement>("#base-url")!
const model = document.querySelector<HTMLInputElement>("#model")!
const apiKey = document.querySelector<HTMLInputElement>("#api-key")!
const targetLanguage = document.querySelector<HTMLInputElement>("#target-language")!
const autoTranslate = document.querySelector<HTMLInputElement>("#auto-translate")!
const toggleKey = document.querySelector<HTMLButtonElement>("#toggle-key")!
const quickSource = document.querySelector<HTMLTextAreaElement>("#quick-source")!
const quickTranslateButton = document.querySelector<HTMLButtonElement>("#quick-translate")!
const quickResults = document.querySelector<HTMLElement>("#quick-results")!
const quickJapanese = document.querySelector<HTMLElement>("#quick-japanese")!
const quickEnglish = document.querySelector<HTMLElement>("#quick-english")!
const mainView = document.querySelector<HTMLElement>("#main-view")!
const settingsView = document.querySelector<HTMLElement>("#settings-view")!
const historyList = document.querySelector<HTMLElement>("#history-list")!
const historyEmpty = document.querySelector<HTMLElement>("#history-empty")!
const logsModal = document.querySelector<HTMLDialogElement>("#logs-modal")!
const logsList = document.querySelector<HTMLElement>("#logs-list")!
const logsEmpty = document.querySelector<HTMLElement>("#logs-empty")!
const slackQueueStats = document.querySelector<HTMLElement>("#slack-queue-stats")!
const slackProgressStats = document.querySelector<HTMLElement>("#slack-progress-stats")!
const showLogsButton = document.querySelector<HTMLButtonElement>("#show-logs")!
const privacyConsentModal = document.querySelector<HTMLDialogElement>("#privacy-consent-modal")!
const privacyConsentCheck = document.querySelector<HTMLInputElement>("#privacy-consent-check")!
const acceptPrivacyConsent = document.querySelector<HTMLButtonElement>("#accept-privacy-consent")!
let privacyConsent = false
let currentLogs: SlacktorLogEntry[] = []

type QuickHistoryEntry = {
  id: string
  source: string
  japanese: string
  english: string
  createdAt: number
}
type QuickUiState = {
  draft: string
  clearAfterClose: boolean
  lastTranslatedSource?: string
  history: QuickHistoryEntry[]
}
const QUICK_UI_KEY = "quick-translator-ui"
let quickUiState: QuickUiState = { draft: "", clearAfterClose: false, history: [] }

void Promise.all([load(), loadQuickUiState()])
void refreshSlackApiStats()
void refreshProviderRuntimeStatus()
window.setInterval(() => {
  void refreshSlackApiStats()
  void refreshProviderRuntimeStatus()
}, 500)

async function load(): Promise<void> {
  const settings = await getProviderSettings()
  baseUrl.value = settings.baseUrl
  model.value = settings.model
  apiKey.value = settings.apiKey
  targetLanguage.value = settings.targetLanguage
  autoTranslate.checked = settings.autoTranslate
  privacyConsent = settings.privacyConsent
  updateConnectionStatus()
  if (!privacyConsent) privacyConsentModal.showModal()
}

async function loadQuickUiState(): Promise<void> {
  const stored = await chrome.storage.local.get(QUICK_UI_KEY)
  quickUiState = { ...quickUiState, ...stored[QUICK_UI_KEY] }
  if (
    quickUiState.clearAfterClose &&
    quickUiState.lastTranslatedSource !== undefined &&
    quickUiState.draft === quickUiState.lastTranslatedSource
  ) {
    quickUiState.draft = ""
    quickUiState.clearAfterClose = false
    quickUiState.lastTranslatedSource = undefined
    await saveQuickUiState()
  }
  quickSource.value = quickUiState.draft
  renderHistory()
}

async function saveQuickUiState(): Promise<void> {
  await chrome.storage.local.set({ [QUICK_UI_KEY]: quickUiState })
}

function renderHistory(): void {
  historyList.replaceChildren()
  for (const entry of quickUiState.history) {
    const item = document.createElement("article")
    item.className = "history-item"
    const time = document.createElement("time")
    time.dateTime = new Date(entry.createdAt).toISOString()
    time.textContent = new Date(entry.createdAt).toLocaleString()
    const text = document.createElement("p")
    text.textContent = entry.english
    item.append(time, text)
    item.addEventListener("click", () => {
      quickSource.value = entry.source ?? ""
      quickJapanese.textContent = entry.japanese ?? ""
      quickEnglish.textContent = entry.english
      quickResults.hidden = false
      quickUiState.draft = quickSource.value
      quickUiState.clearAfterClose = false
      quickUiState.lastTranslatedSource = undefined
      void saveQuickUiState()
    })
    historyList.append(item)
  }
  historyEmpty.hidden = quickUiState.history.length > 0
}

function updateConnectionStatus(): void {
  const configured = Boolean(baseUrl.value.trim() && model.value.trim() && apiKey.value.trim())
  if (!configured) setProviderStatus("unconfigured", "Provider is not configured")
}

toggleKey.addEventListener("click", () => {
  const visible = apiKey.type === "text"
  apiKey.type = visible ? "password" : "text"
  toggleKey.textContent = visible ? "Show" : "Hide"
  toggleKey.setAttribute("aria-label", visible ? "Show API key" : "Hide API key")
})

form.addEventListener("input", updateConnectionStatus)

quickSource.addEventListener("input", () => {
  quickUiState.draft = quickSource.value
  // Any edit after a successful translation means the user is preparing new
  // text. Preserve that draft on the next popup open, even if they later change
  // it back to the same visible value.
  quickUiState.clearAfterClose = false
  quickUiState.lastTranslatedSource = undefined
  void saveQuickUiState()
})

form.addEventListener("submit", (event) => {
  event.preventDefault()
  saveStatus.className = "save-status"
  saveStatus.textContent = "Saving..."

  const endpoint = baseUrl.value.trim()
  let permissionPattern: string
  try {
    const url = new URL(endpoint)
    const isLocalHttp = url.protocol === "http:" && (
      url.hostname === "localhost" || url.hostname === "127.0.0.1"
    )
    if (url.protocol !== "https:" && !isLocalHttp) {
      throw new Error("Remote AI endpoints must use HTTPS.")
    }
    permissionPattern = `${url.protocol}//${url.hostname}/*`
  } catch {
    saveStatus.className = "save-status error"
    saveStatus.textContent = "Use an HTTPS endpoint, or HTTP on localhost only."
    return
  }

  void chrome.permissions.request({ origins: [permissionPattern] }).then((granted) => {
    if (!granted) throw new Error("Permission was not granted for this AI endpoint.")
    return saveProviderSettings({
      baseUrl: endpoint,
      apiKey: apiKey.value.trim(),
      model: model.value.trim(),
      targetLanguage: targetLanguage.value.trim(),
      autoTranslate: autoTranslate.checked,
      privacyConsent,
    })
  })
    .then(() => {
      updateConnectionStatus()
      saveStatus.className = "save-status success"
      saveStatus.textContent = "Configuration saved."
    })
    .catch(() => {
      saveStatus.className = "save-status error"
      saveStatus.textContent = "Could not save configuration or endpoint permission was denied."
    })
})

document.querySelector<HTMLButtonElement>("#clear-translation-cache")!.addEventListener("click", (event) => {
  const button = event.currentTarget
  if (!(button instanceof HTMLButtonElement)) return
  button.disabled = true
  saveStatus.className = "save-status"
  saveStatus.textContent = "Clearing cache..."
  chrome.runtime.sendMessage({ type: "clear-translation-cache" }, (response?: { ok: boolean }) => {
    button.disabled = false
    if (chrome.runtime.lastError || !response?.ok) {
      saveStatus.className = "save-status error"
      saveStatus.textContent = "Could not clear the translation cache."
      return
    }
    saveStatus.className = "save-status success"
    saveStatus.textContent = "Translation cache cleared. Active translations were not stopped."
  })
})

document.querySelector<HTMLButtonElement>("#stop-translations")!.addEventListener("click", () => {
  stopSlackTranslations()
})

document.querySelector<HTMLButtonElement>("#test-provider")!.addEventListener("click", (event) => {
  const button = event.currentTarget
  if (!(button instanceof HTMLButtonElement)) return
  button.disabled = true
  const original = button.textContent
  button.textContent = "Testing..."
  chrome.runtime.sendMessage({ type: "test-provider" }, (response?: { ok: boolean; error?: string }) => {
    button.disabled = false
    button.textContent = response?.ok ? "Test succeeded" : "Test failed"
    window.setTimeout(() => { button.textContent = original }, 1400)
    void refreshProviderRuntimeStatus()
  })
})

quickTranslateButton.addEventListener("click", () => {
  const text = quickSource.value.trim()
  if (!text) {
    quickSource.focus()
    return
  }

  setQuickTranslating(true)
  quickResults.hidden = true

  void sendQuickTranslate(text)
    .then(async (response) => {
      if (!response.ok) throw new Error(response.error)
      quickJapanese.textContent = response.japanese
      quickEnglish.textContent = response.english
      quickResults.hidden = false
      quickUiState.history = [
        {
          id: crypto.randomUUID(),
          source: text,
          japanese: response.japanese,
          english: response.english,
          createdAt: Date.now(),
        },
        ...quickUiState.history,
      ].slice(0, 50)
      quickUiState.draft = quickSource.value
      const inputIsUnchanged = quickSource.value.trim() === text
      quickUiState.lastTranslatedSource = inputIsUnchanged ? quickSource.value : undefined
      quickUiState.clearAfterClose = inputIsUnchanged
      // Persist before considering the translation complete. Chrome action
      // popups can be destroyed immediately when the user clicks elsewhere.
      await saveQuickUiState()
      renderHistory()
    })
    .catch(() => {
      // Keep the source text intact and restore the button so retry always works.
    })
    .finally(() => setQuickTranslating(false))
})

function sendQuickTranslate(text: string): Promise<QuickTranslateResponse> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ type: "quick-translate", text }, (response?: QuickTranslateResponse) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        if (!response) {
          reject(new Error("Quick translation returned no response."))
          return
        }
        resolve(response)
      })
    } catch (error) {
      reject(error)
    }
  })
}

function setQuickTranslating(translating: boolean): void {
  quickTranslateButton.disabled = translating
  quickTranslateButton.replaceChildren()
  if (translating) {
    const spinner = document.createElement("span")
    spinner.className = "button-spinner"
    spinner.setAttribute("aria-label", "Translating")
    quickTranslateButton.append(spinner)
  } else {
    const label = document.createElement("span")
    label.className = "button-label"
    label.textContent = "Translate"
    quickTranslateButton.append(label)
  }
}

for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("[data-copy]"))) {
  button.addEventListener("click", () => {
    const text = button.dataset.copy === "japanese" ? quickJapanese.textContent : quickEnglish.textContent
    void navigator.clipboard.writeText(text ?? "").then(() => {
      button.style.color = "#007a5a"
      window.setTimeout(() => { button.style.color = "#1264a3" }, 700)
    })
  })
}

document.querySelector<HTMLButtonElement>("#clear-source")!.addEventListener("click", () => {
  quickSource.value = ""
  quickUiState.draft = ""
  quickUiState.clearAfterClose = false
  quickUiState.lastTranslatedSource = undefined
  quickResults.hidden = true
  void saveQuickUiState()
  quickSource.focus()
})

document.querySelector<HTMLButtonElement>("#clear-history")!.addEventListener("click", () => {
  quickUiState.history = []
  void saveQuickUiState()
  renderHistory()
})

document.querySelector<HTMLButtonElement>("#show-settings")!.addEventListener("click", () => {
  mainView.hidden = true
  settingsView.hidden = false
})

document.querySelector<HTMLButtonElement>("#back-main")!.addEventListener("click", () => {
  settingsView.hidden = true
  mainView.hidden = false
})

showLogsButton.addEventListener("click", () => {
  logsModal.showModal()
  void loadLogs()
})

document.querySelector<HTMLButtonElement>("#retranslate-all")!.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "retranslate-visible-from-popup" })
})

document.querySelector<HTMLButtonElement>("#terminate-all")!.addEventListener("click", () => {
  stopSlackTranslations()
})

function stopSlackTranslations(): void {
  chrome.runtime.sendMessage({ type: "terminate-slack-translations" }, (response?: { ok: boolean }) => {
    saveStatus.className = response?.ok ? "save-status success" : "save-status error"
    saveStatus.textContent = response?.ok
      ? "Queued translations stopped. Active translations will finish. Cache kept."
      : "Could not stop translations on the active Slack tab."
  })
}

document.querySelector<HTMLButtonElement>("#close-logs")!.addEventListener("click", () => logsModal.close())
document.querySelector<HTMLButtonElement>("#refresh-logs")!.addEventListener("click", () => void loadLogs())
document.querySelector<HTMLButtonElement>("#clear-logs")!.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "clear-logs" }, () => void loadLogs())
})
document.querySelector<HTMLButtonElement>("#copy-logs")!.addEventListener("click", () => {
  void navigator.clipboard.writeText(JSON.stringify(currentLogs, null, 2))
})

async function loadLogs(): Promise<void> {
  currentLogs = await chrome.runtime.sendMessage({ type: "get-logs" }) as SlacktorLogEntry[]
  logsList.replaceChildren()
  for (const entry of currentLogs) {
    const item = document.createElement("article")
    item.className = `log-entry ${entry.level}`
    const heading = document.createElement("header")
    heading.innerHTML = `<strong>${entry.scope}</strong><time>${new Date(entry.createdAt).toLocaleTimeString()}</time>`
    const message = document.createElement("p")
    message.textContent = entry.message
    item.append(heading, message)
    if (entry.details) {
      const details = document.createElement("pre")
      details.textContent = JSON.stringify(entry.details, null, 2)
      item.append(details)
    }
    logsList.append(item)
  }
  logsEmpty.hidden = currentLogs.length > 0
}

async function refreshSlackApiStats(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const stats = await chrome.runtime.sendMessage({
      type: "get-slack-translation-stats",
      tabId: tab?.id,
    }) as {
      waiting: number
      active: number
      concurrency: number
      retrying: number
      completed: number
      total: number
    }
    const retrying = stats.retrying > 0 ? ` · ${stats.retrying} retrying` : ""
    const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
    slackQueueStats.textContent = `${stats.waiting} waiting · ${stats.active}/${stats.concurrency} active${retrying}`
    slackProgressStats.textContent = `${stats.completed}/${stats.total} translated - ${progress}%`
    slackQueueStats.className = `api-stats ${stats.waiting > 0 ? "busy" : stats.active > 0 ? "active" : ""}`
  } catch {
    slackQueueStats.textContent = "Stats unavailable"
    slackProgressStats.textContent = ""
    slackQueueStats.className = "api-stats"
  }
}

async function refreshProviderRuntimeStatus(): Promise<void> {
  try {
    const status = await chrome.runtime.sendMessage({ type: "get-provider-runtime-status" }) as {
      state: "unconfigured" | "ready" | "error"
      message: string
    }
    setProviderStatus(status.state, status.message)
  } catch {
    setProviderStatus("error", "Could not read provider status")
  }
}

function setProviderStatus(
  state: "unconfigured" | "ready" | "error",
  message: string,
): void {
  connectionStatus.className = `status-dot ${state}`
  connectionStatus.title = message
  connectionStatus.setAttribute("aria-label", message)
  showLogsButton.classList.toggle("provider-error", state === "error")
}

privacyConsentCheck.addEventListener("change", () => {
  acceptPrivacyConsent.disabled = !privacyConsentCheck.checked
})

acceptPrivacyConsent.addEventListener("click", () => {
  if (!privacyConsentCheck.checked) return
  void getProviderSettings().then((settings) => saveProviderSettings({
    ...settings,
    privacyConsent: true,
  })).then(() => {
    privacyConsent = true
    privacyConsentModal.close()
    saveStatus.className = "save-status success"
    saveStatus.textContent = "Slack translation enabled. Refresh an open Slack tab once."
  })
})
