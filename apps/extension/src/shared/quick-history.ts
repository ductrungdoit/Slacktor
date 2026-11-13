export type QuickHistoryEntry = {
  id: string
  source: string
  /** Source translated into `targetLanguage`. */
  translation: string
  /** `translation` translated back into `backTranslationLanguage` (the Settings language). */
  backTranslation: string
  /** Absent on entries saved before languages were recorded. */
  targetLanguage?: string
  backTranslationLanguage?: string
  createdAt: number
}

/** Input for a new history entry; id and createdAt are assigned on write. */
export type NewQuickHistoryEntry = Omit<QuickHistoryEntry, "id" | "createdAt">

/** Result fields of a Quick translation. Values are the QuickHistoryEntry property names. */
export enum QuickResultKey {
  Translation = "translation",
  BackTranslation = "backTranslation",
}

export const QUICK_UI_KEY = "quick-translator-ui"
export const QUICK_HISTORY_LIMIT = 50
const QUICK_HISTORY_RETENTION_MS = 2 * 24 * 60 * 60 * 1000

/**
 * Reads a stored history entry. Entries saved by earlier versions used the
 * language-specific fields `japanese` / `english` for translation / backTranslation.
 */
export function normalizeQuickHistoryEntry(raw: unknown): QuickHistoryEntry | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const entry = raw as Record<string, unknown>
  const translation = entry.translation ?? entry.japanese
  const backTranslation = entry.backTranslation ?? entry.english
  if (typeof translation !== "string" || typeof backTranslation !== "string") return undefined
  return {
    id: typeof entry.id === "string" ? entry.id : crypto.randomUUID(),
    source: typeof entry.source === "string" ? entry.source : "",
    translation,
    backTranslation,
    targetLanguage: typeof entry.targetLanguage === "string" ? entry.targetLanguage : undefined,
    backTranslationLanguage:
      typeof entry.backTranslationLanguage === "string" ? entry.backTranslationLanguage : undefined,
    createdAt: typeof entry.createdAt === "number" ? entry.createdAt : Number.NaN,
  }
}

export function retainRecentHistory(history: unknown): QuickHistoryEntry[] {
  if (!Array.isArray(history)) return []
  const cutoff = Date.now() - QUICK_HISTORY_RETENTION_MS
  return history
    .map(normalizeQuickHistoryEntry)
    .filter(
      (entry): entry is QuickHistoryEntry =>
        entry !== undefined && Number.isFinite(entry.createdAt) && entry.createdAt >= cutoff,
    )
}
