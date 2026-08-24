import { getProviderSettings } from "../shared/settings"
import { safeEndpoint, writeLog } from "./log-store"

export async function quickTranslate(text: string): Promise<{ japanese: string; english: string }> {
  const settings = await getProviderSettings()
  if (!settings.baseUrl || !settings.apiKey || !settings.model) {
    throw new Error("Configure the AI provider first.")
  }

  const japanese = await translate(text, "Japanese", settings)
  const english = await translate(japanese, "English", settings)
  return { japanese, english }
}

export async function testProvider(): Promise<void> {
  const settings = await getProviderSettings()
  if (!settings.baseUrl || !settings.apiKey || !settings.model) {
    throw new Error("Configure endpoint, model, and API key first.")
  }
  await translate("Reply with exactly OK.", "English", settings)
}

async function translate(
  text: string,
  targetLanguage: string,
  settings: Awaited<ReturnType<typeof getProviderSettings>>,
): Promise<string> {
  const baseUrl = settings.baseUrl.replace(/\/+$/, "")
  const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: "system",
            content: "Translate the provided text accurately. Preserve names, URLs, code, formatting, and tone. Return only the translation.",
          },
          {
            role: "user",
            content: `Target language: ${targetLanguage}\n\nText:\n${text}`,
          },
        ],
        temperature: 0.2,
      }),
    })
  } catch (error) {
    await writeLog({ level: "error", scope: "quick-translation", message: error instanceof Error ? error.message : "Quick translation network request failed", details: { endpoint: safeEndpoint(endpoint), model: settings.model, targetLanguage } })
    throw error
  }

  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 240)
    const error = `AI request failed (${response.status})${detail ? `: ${detail}` : ""}`
    await writeLog({ level: "error", scope: "quick-translation", message: error, details: { endpoint: safeEndpoint(endpoint), model: settings.model, targetLanguage, status: response.status } })
    throw new Error(error)
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  const translation = data.choices?.[0]?.message?.content?.trim()
  if (!translation) throw new Error(`AI provider returned no ${targetLanguage} translation.`)
  await writeLog({ level: "info", scope: "quick-translation", message: "Quick translation step completed", details: { endpoint: safeEndpoint(endpoint), model: settings.model, targetLanguage, status: response.status } })
  return translation
}
