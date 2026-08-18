import { getProviderSettings, saveProviderSettings } from "../shared/settings"

const form = document.querySelector<HTMLFormElement>("#settings-form")!
const status = document.querySelector<HTMLElement>("#status")!
const baseUrl = document.querySelector<HTMLInputElement>("#base-url")!
const apiKey = document.querySelector<HTMLInputElement>("#api-key")!
const model = document.querySelector<HTMLInputElement>("#model")!
const targetLanguage = document.querySelector<HTMLInputElement>("#target-language")!
let autoTranslate = false

void getProviderSettings().then((settings) => {
  baseUrl.value = settings.baseUrl
  apiKey.value = settings.apiKey
  model.value = settings.model
  targetLanguage.value = settings.targetLanguage
  autoTranslate = settings.autoTranslate
})

form.addEventListener("submit", (event) => {
  event.preventDefault()
  void saveProviderSettings({
    baseUrl: baseUrl.value.trim(),
    apiKey: apiKey.value.trim(),
    model: model.value.trim(),
    targetLanguage: targetLanguage.value.trim(),
    autoTranslate,
  }).then(() => {
    status.textContent = "Saved."
  })
})
