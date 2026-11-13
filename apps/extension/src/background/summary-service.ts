import { getProviderSettings } from "../shared/settings"
import type { ThreadContextMessage } from "../shared/types"
import { safeEndpoint, writeLog } from "./log-store"
import { providerRequest } from "./provider-request"

export type SummarizeContextOptions = {
  previousSummary?: string
  scopeType?: "thread" | "channel"
}

export async function summarizeThread(
  messages: ThreadContextMessage[],
  options: SummarizeContextOptions = {},
): Promise<string> {
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
  const scopeLabel = options.scopeType === "channel" ? "channel conversation" : "thread"
  const systemContent = options.previousSummary
    ? `Update the existing Slack ${scopeLabel} summary by folding in the new messages concisely (2-4 sentences). Preserve key decisions, unresolved questions, names, identifiers, and recurring technical/domain terms. Do not translate it and do not invent facts.`
    : `Summarize this older Slack ${scopeLabel} context concisely (2-4 sentences). Preserve decisions, unresolved questions, names, identifiers, and technical terms. Do not translate it and do not invent facts.`
  const userContent = options.previousSummary
    ? `Existing summary:\n${options.previousSummary}\n\nNew messages to fold in:\n${transcript}`
    : transcript

  let response: Response
  try {
    response = await providerRequest(endpoint, settings.apiKey, {
      model: settings.model,
      messages: [
        {
          role: "system",
          content: systemContent,
        },
        { role: "user", content: userContent },
      ],
      temperature: 0.1,
    })
  } catch (error) {
    await writeLog({
      level: "error",
      scope: "summary",
      message: error instanceof Error ? error.message : "Thread summary network request failed",
      details: { endpoint: safeEndpoint(endpoint), model: settings.model },
    })
    throw error
  }
  if (!response.ok) {
    const error = `Thread summary failed (${response.status}).`
    await writeLog({
      level: "error",
      scope: "summary",
      message: error,
      details: { endpoint: safeEndpoint(endpoint), model: settings.model, status: response.status },
    })
    throw new Error(error)
  }
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const summary = data.choices?.[0]?.message?.content?.trim()
  if (!summary) throw new Error("AI provider returned no thread summary.")
  await writeLog({
    level: "info",
    scope: "summary",
    message: "Thread summary completed",
    details: { endpoint: safeEndpoint(endpoint), model: settings.model, status: response.status },
  })
  return summary
}
