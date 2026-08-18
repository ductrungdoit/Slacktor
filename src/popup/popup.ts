import { getProviderSettings, saveProviderSettings } from "../shared/settings"

const form = document.querySelector<HTMLFormElement>("#quick-settings")!
const connectionStatus = document.querySelector<HTMLElement>("#connection-status")!
const saveStatus = document.querySelector<HTMLElement>("#save-status")!
const baseUrl = document.querySelector<HTMLInputElement>("#base-url")!
const model = document.querySelector<HTMLInputElement>("#model")!
const apiKey = document.querySelector<HTMLInputElement>("#api-key")!
const targetLanguage = document.querySelector<HTMLInputElement>("#target-language")!
const autoTranslate = document.querySelector<HTMLInputElement>("#auto-translate")!
const toggleKey = document.querySelector<HTMLButtonElement>("#toggle-key")!

void load()

async function load(): Promise<void> {
  const settings = await getProviderSettings()
  baseUrl.value = settings.baseUrl
  model.value = settings.model
  apiKey.value = settings.apiKey
  targetLanguage.value = settings.targetLanguage
  autoTranslate.checked = settings.autoTranslate
  updateConnectionStatus()
}

function updateConnectionStatus(): void {
  const configured = Boolean(baseUrl.value.trim() && model.value.trim() && apiKey.value.trim())
  connectionStatus.textContent = configured ? "Provider configured" : "Provider needs configuration"
  connectionStatus.className = `status ${configured ? "ready" : "missing"}`
}

toggleKey.addEventListener("click", () => {
  const visible = apiKey.type === "text"
  apiKey.type = visible ? "password" : "text"
  toggleKey.textContent = visible ? "Show" : "Hide"
  toggleKey.setAttribute("aria-label", visible ? "Show API key" : "Hide API key")
})

form.addEventListener("input", updateConnectionStatus)

form.addEventListener("submit", (event) => {
  event.preventDefault()
  saveStatus.className = "save-status"
  saveStatus.textContent = "Saving..."

  const endpoint = baseUrl.value.trim()
  let permissionPattern: string
  try {
    const url = new URL(endpoint)
    permissionPattern = `${url.protocol}//${url.hostname}/*`
  } catch {
    saveStatus.className = "save-status error"
    saveStatus.textContent = "Enter a valid endpoint URL."
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

document.querySelector<HTMLButtonElement>("#open-options")!.addEventListener("click", () => {
  chrome.runtime.openOptionsPage()
})

document.querySelector<HTMLButtonElement>("#retranslate-visible")!.addEventListener("click", (event) => {
  const button = event.currentTarget
  if (!(button instanceof HTMLButtonElement)) return
  button.disabled = true
  saveStatus.className = "save-status"
  saveStatus.textContent = "Clearing cache..."
  chrome.runtime.sendMessage({ type: "clear-cache-and-retranslate" }, (response?: { ok: boolean }) => {
    button.disabled = false
    if (chrome.runtime.lastError || !response?.ok) {
      saveStatus.className = "save-status error"
      saveStatus.textContent = "Could not clear cache or contact the Slack tab."
      return
    }
    saveStatus.className = "save-status success"
    saveStatus.textContent = "Cache cleared. Visible messages are being retranslated."
  })
})
