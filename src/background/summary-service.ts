import type { ThreadContextMessage } from "../shared/types"
import { getProviderSettings } from "../shared/settings"
import { safeEndpoint, writeLog } from "./log-store"
import { providerFetch } from "./provider-fetch"

export async function summarizeThread(messages: ThreadContextMessage[]): Promise<string> {
  const settings = await getProviderSettings()
  if (!settings.baseUrl || !settings.apiKey || !settings.model) {
    throw new Error("Configure the AI provider in Slacktor options first.")
  }

  const endpoint = settings.baseUrl.replace(/\/+$/, "").endsWith("/chat/completions")
    ? settings.baseUrl.replace(/\/+$/, "")
    : `${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`
  const transcript = messages
    .map((message) => `[${message.authorName ?? "Slack member"}]: ${message.sourceText}`)
    .join("\n")
  let response: Response
  try {
    response = await providerFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: "system",
            content: "Summarize this older Slack thread context concisely. Preserve decisions, unresolved questions, names, identifiers, and technical terms. Do not translate it and do not invent facts.",
          },
          { role: "user", content: transcript },
        ],
        temperature: 0.1,
      }),
    })
  } catch (error) {
    await writeLog({ level: "error", scope: "summary", message: error instanceof Error ? error.message : "Thread summary network request failed", details: { endpoint: safeEndpoint(endpoint), model: settings.model } })
    throw error
  }
  if (!response.ok) {
    const error = `Thread summary failed (${response.status}).`
    await writeLog({ level: "error", scope: "summary", message: error, details: { endpoint: safeEndpoint(endpoint), model: settings.model, status: response.status } })
    throw new Error(error)
  }
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  const summary = data.choices?.[0]?.message?.content?.trim()
  if (!summary) throw new Error("AI provider returned no thread summary.")
  await writeLog({ level: "info", scope: "summary", message: "Thread summary completed", details: { endpoint: safeEndpoint(endpoint), model: settings.model, status: response.status } })
  return summary
}
