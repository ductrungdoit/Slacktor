import { startComposerTranslator } from "./composer-translator"
import { startMessageObserver } from "./message-observer"

const observerKey = "__slacktorMessageObserverStarted__"
const pageState = globalThis as typeof globalThis & Record<string, unknown>
if (!pageState[observerKey]) {
  pageState[observerKey] = true
  startMessageObserver()
  startComposerTranslator()
}
