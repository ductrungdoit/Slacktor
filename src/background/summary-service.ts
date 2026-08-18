import type { ThreadContextMessage } from "../shared/types"
import { getProviderSettings } from "../shared/settings"

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
  const response = await fetch(endpoint, {
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
  if (!response.ok) throw new Error(`Thread summary failed (${response.status}).`)
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  const summary = data.choices?.[0]?.message?.content?.trim()
  if (!summary) throw new Error("AI provider returned no thread summary.")
  return summary
}
