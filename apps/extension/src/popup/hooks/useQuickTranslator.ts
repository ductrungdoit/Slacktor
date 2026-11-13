import { useCallback, useEffect, useState } from "react"

import { DEFAULT_QUICK_TARGET_LANGUAGE } from "../../shared/languages"
import type { QuickTranslateResponse } from "../../shared/messages"
import {
  QUICK_HISTORY_LIMIT,
  QUICK_UI_KEY,
  type QuickHistoryEntry,
  type QuickResultKey,
  retainRecentHistory,
} from "../../shared/quick-history"
import { sendExtensionMessage } from "../lib/messaging"

export type { QuickHistoryEntry }

export type QuickResults = {
  translation: string
  backTranslation: string
  /** Languages of the two results. Unknown for entries saved by older versions. */
  targetLanguage?: string
  backTranslationLanguage?: string
}

type QuickUiState = {
  draft: string
  targetLanguage: string
  clearAfterClose: boolean
  lastTranslatedSource?: string
  history: QuickHistoryEntry[]
}

const INITIAL_STATE: QuickUiState = {
  draft: "",
  targetLanguage: DEFAULT_QUICK_TARGET_LANGUAGE,
  clearAfterClose: false,
  history: [],
}

export function useQuickTranslator() {
  const [state, setState] = useState<QuickUiState>(INITIAL_STATE)
  const [loaded, setLoaded] = useState(false)
  const [results, setResults] = useState<QuickResults | undefined>(undefined)
  const [translating, setTranslating] = useState(false)

  useEffect(() => {
    void chrome.storage.local.get(QUICK_UI_KEY).then((stored) => {
      let next: QuickUiState = { ...INITIAL_STATE, ...stored[QUICK_UI_KEY] }
      const retainedHistory = retainRecentHistory(next.history)
      const shouldClearDraft =
        next.clearAfterClose &&
        next.lastTranslatedSource !== undefined &&
        next.draft === next.lastTranslatedSource
      if (shouldClearDraft) {
        next = {
          ...next,
          draft: "",
          clearAfterClose: false,
          lastTranslatedSource: undefined,
          history: retainedHistory,
        }
        void chrome.storage.local.set({ [QUICK_UI_KEY]: next })
      } else if (retainedHistory.length !== next.history.length) {
        next = { ...next, history: retainedHistory }
        void chrome.storage.local.set({ [QUICK_UI_KEY]: next })
      }
      setState(next)
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    // The background also writes history (translations made from the Slack
    // composer). Mirror it so a later popup write does not discard those entries.
    const handleChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local") return
      const change = changes[QUICK_UI_KEY]
      if (!change?.newValue) return
      const history = retainRecentHistory((change.newValue as QuickUiState).history)
      setState((current) => ({ ...current, history }))
    }
    chrome.storage.onChanged.addListener(handleChanged)
    return () => chrome.storage.onChanged.removeListener(handleChanged)
  }, [])

  const persist = useCallback((next: QuickUiState) => {
    setState(next)
    void chrome.storage.local.set({ [QUICK_UI_KEY]: next })
  }, [])

  const setDraft = useCallback(
    (draft: string) => {
      // Any edit after a successful translation means the user is preparing new
      // text. Preserve that draft on next popup open, even if it's later
      // changed back to the same value.
      persist({ ...state, draft, clearAfterClose: false, lastTranslatedSource: undefined })
    },
    [state, persist],
  )

  const setTargetLanguage = useCallback(
    (targetLanguage: string) => persist({ ...state, targetLanguage }),
    [state, persist],
  )

  const clearSource = useCallback(() => {
    persist({ ...state, draft: "", clearAfterClose: false, lastTranslatedSource: undefined })
    setResults(undefined)
  }, [state, persist])

  const clearHistory = useCallback(() => {
    persist({ ...state, history: [] })
  }, [state, persist])

  const deleteHistoryEntry = useCallback(
    (id: string) => {
      persist({ ...state, history: state.history.filter((entry) => entry.id !== id) })
    },
    [state, persist],
  )

  const restoreFromHistory = useCallback(
    (entry: QuickHistoryEntry) => {
      setResults({
        translation: entry.translation,
        backTranslation: entry.backTranslation,
        targetLanguage: entry.targetLanguage,
        backTranslationLanguage: entry.backTranslationLanguage,
      })
      persist({
        ...state,
        draft: entry.source ?? "",
        clearAfterClose: true,
        lastTranslatedSource: entry.source ?? "",
      })
    },
    [state, persist],
  )

  const translate = useCallback(async (): Promise<void> => {
    const text = state.draft.trim()
    const targetLanguage = state.targetLanguage.trim()
    if (!text || !targetLanguage) return

    setTranslating(true)
    setResults(undefined)
    try {
      const response = await sendExtensionMessage<QuickTranslateResponse>({
        type: "quick-translate",
        text,
        targetLanguage,
      })
      if (!response?.ok) throw new Error(response?.error ?? "Quick translation failed.")
      setResults({
        translation: response.translation,
        backTranslation: response.backTranslation,
        targetLanguage: response.targetLanguage,
        backTranslationLanguage: response.backTranslationLanguage,
      })
      const entry: QuickHistoryEntry = {
        id: crypto.randomUUID(),
        source: text,
        translation: response.translation,
        backTranslation: response.backTranslation,
        targetLanguage: response.targetLanguage,
        backTranslationLanguage: response.backTranslationLanguage,
        createdAt: Date.now(),
      }
      const inputIsUnchanged = state.draft.trim() === text
      persist({
        ...state,
        draft: state.draft,
        history: [entry, ...retainRecentHistory(state.history)].slice(0, QUICK_HISTORY_LIMIT),
        lastTranslatedSource: inputIsUnchanged ? state.draft : undefined,
        clearAfterClose: inputIsUnchanged,
      })
    } finally {
      // The source text stays intact on failure so retry always works. The error
      // propagates to the caller, which shows it to the user.
      setTranslating(false)
    }
  }, [state, persist])

  const copyResult = useCallback(
    async (which: QuickResultKey): Promise<void> => {
      const text = results?.[which] ?? ""
      await navigator.clipboard.writeText(text)
    },
    [results],
  )

  return {
    loaded,
    draft: state.draft,
    targetLanguage: state.targetLanguage,
    history: state.history,
    results,
    translating,
    setDraft,
    setTargetLanguage,
    translate,
    clearSource,
    clearHistory,
    deleteHistoryEntry,
    restoreFromHistory,
    copyResult,
  }
}
