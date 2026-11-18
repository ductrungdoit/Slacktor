import "./index.css"

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "./App"
import { applyThemeMode, readCachedThemeMode } from "./lib/theme-mode"

applyThemeMode(readCachedThemeMode())

const root = document.getElementById("root")
if (!root) throw new Error("Popup root element not found.")

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
