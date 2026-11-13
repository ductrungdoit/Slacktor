import {
  buildSlacktorThemeCss,
  SLACKTOR_THEME_ATTRIBUTE,
  type SlacktorThemeName,
} from "../shared/theme"
import { getSlackThemeProbeElement } from "./slack-adapter"

const THEME_STYLE_ID = "slacktor-theme"
const DARK_TEXT_LUMINANCE_THRESHOLD = 0.5

let started = false
let scheduledFrame: number | undefined

// Keeps the overlay palette in sync with Slack's own light/dark theme. Slack
// exposes no theme API, so the theme is inferred from the luminance of the
// page's text color: light text means a dark theme.
export function startSlackThemeSync(): void {
  if (started) return
  started = true

  injectThemeStyle()
  applySlackTheme()

  const observer = new MutationObserver(scheduleThemeCheck)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style"],
  })
  if (document.body) {
    observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] })
  }
  if (document.head) observer.observe(document.head, { childList: true })

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", scheduleThemeCheck)
}

function injectThemeStyle(): void {
  if (document.getElementById(THEME_STYLE_ID)) return
  const style = document.createElement("style")
  style.id = THEME_STYLE_ID
  style.textContent = buildSlacktorThemeCss()
  ;(document.head || document.documentElement).appendChild(style)
}

function scheduleThemeCheck(): void {
  if (scheduledFrame !== undefined) return
  scheduledFrame = requestAnimationFrame(() => {
    scheduledFrame = undefined
    applySlackTheme()
  })
}

function applySlackTheme(): void {
  const theme = detectSlackTheme()
  if (document.documentElement.getAttribute(SLACKTOR_THEME_ATTRIBUTE) !== theme) {
    document.documentElement.setAttribute(SLACKTOR_THEME_ATTRIBUTE, theme)
  }
}

function detectSlackTheme(): SlacktorThemeName {
  const probe = getSlackThemeProbeElement()
  const luminance = probe ? getRelativeLuminance(getComputedStyle(probe).color) : undefined
  if (luminance !== undefined) return luminance > DARK_TEXT_LUMINANCE_THRESHOLD ? "dark" : "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function getRelativeLuminance(cssColor: string): number | undefined {
  const match = cssColor.match(
    /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?/,
  )
  if (!match) return undefined
  const alpha = match[4]
  if (alpha !== undefined && Number.parseFloat(alpha) === 0) return undefined
  const [red, green, blue] = [match[1], match[2], match[3]].map((channel) => {
    const value = Number(channel) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}
