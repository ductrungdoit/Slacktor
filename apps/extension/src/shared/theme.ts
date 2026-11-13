// Color palette for the vanilla DOM translation overlay injected into Slack
// (src/content/translation-renderer.ts). The content script cannot use
// Tailwind, so it applies these values through CSS custom properties.
//
// The popup and docs site use the Tailwind tokens in src/shared/theme.css.
// Keep the purple primary and status colors aligned with that file.
//
// The overlay follows Slack's own light/dark theme (detected in
// src/content/slack-theme.ts), not the popup's theme preference, so it always
// blends with the page it is rendered in.

type SlacktorPalette = {
  primary: string
  primaryForeground: string
  success: string
  destructive: string
  warning: string
  urgent: string
  foreground: string
  mutedForeground: string
  muted: string
  border: string
  accent: string
  slackLink: string
  tooltipBackground: string
  tooltipForeground: string
}

export type SlacktorColorToken = keyof SlacktorPalette

export type SlacktorThemeName = "light" | "dark"

export const SLACKTOR_PALETTES: Record<SlacktorThemeName, SlacktorPalette> = {
  light: {
    primary: "#7B2FD0",
    primaryForeground: "#FFFFFF",
    success: "#007A5A",
    destructive: "#C4314B",
    warning: "#9B6A00",
    urgent: "#B45309",
    foreground: "#1D1C1D",
    mutedForeground: "#616061",
    muted: "#F8F8F8",
    border: "#E2E2E2",
    accent: "#F3EDFD",
    // Fallback for Slack's own link/mention color so translated mentions keep
    // Slack's native look instead of switching to Slacktor purple.
    slackLink: "#1264A3",
    tooltipBackground: "rgba(26,29,33,0.95)",
    tooltipForeground: "#FFFFFF",
  },
  dark: {
    primary: "#B794F6",
    primaryForeground: "#17141C",
    success: "#34D399",
    destructive: "#F87171",
    warning: "#FBBF24",
    urgent: "#F59E0B",
    foreground: "#D1D2D3",
    mutedForeground: "#ABABAD",
    muted: "#222529",
    border: "#35373B",
    accent: "#2A2233",
    slackLink: "#1D9BD1",
    tooltipBackground: "rgba(232,232,232,0.96)",
    tooltipForeground: "#1D1C1D",
  },
}

export const SLACKTOR_THEME_ATTRIBUTE = "data-slacktor-theme"

const TOKENS = Object.keys(SLACKTOR_PALETTES.light) as SlacktorColorToken[]

function toCssVariableName(token: SlacktorColorToken): string {
  return `--slacktor-${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
}

// Each value is a CSS var() reference with the light color as fallback, so it
// can be dropped into any inline style string or CSSOM property and resolves
// to the active Slack theme without re-rendering existing translations.
export const SLACKTOR_COLORS = Object.fromEntries(
  TOKENS.map((token) => [
    token,
    `var(${toCssVariableName(token)}, ${SLACKTOR_PALETTES.light[token]})`,
  ]),
) as Record<SlacktorColorToken, string>

function toDeclarations(palette: SlacktorPalette): string {
  return TOKENS.map((token) => `${toCssVariableName(token)}: ${palette[token]};`).join(" ")
}

export function buildSlacktorThemeCss(): string {
  return [
    `:root { ${toDeclarations(SLACKTOR_PALETTES.light)} }`,
    `:root[${SLACKTOR_THEME_ATTRIBUTE}="dark"] { ${toDeclarations(SLACKTOR_PALETTES.dark)} }`,
  ].join("\n")
}
