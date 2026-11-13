// Icon shapes are taken verbatim from lucide-react v1.48.0 node data so that the
// content-script overlays and the popup share an identical visual language.
// Content scripts render into Slack's DOM and cannot use the React components, so
// the nodes are kept here once, keyed by the lucide component name.
const LUCIDE_NODES = {
  Check: '<path d="M20 6 9 17l-5-5"/>',
  Copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  Link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  LoaderCircle: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  Paperclip:
    '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  Play: '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
  RotateCw: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  TextCursorInput:
    '<path d="M12 20h-1a2 2 0 0 1-2-2 2 2 0 0 1-2 2H6"/><path d="M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7"/><path d="M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1"/><path d="M6 4h1a2 2 0 0 1 2 2 2 2 0 0 1 2-2h1"/><path d="M9 6v12"/>',
  X: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  Zap: '<path d="M15.914 4a1.5 1.5 0 0 0-2.474-1.561l-9 9A1.5 1.5 0 0 0 5.5 14h4.002a.5.5 0 0 1 .471.666L8.086 20a1.5 1.5 0 0 0 2.475 1.56l9-9A1.5 1.5 0 0 0 18.5 10h-3.997a.5.5 0 0 1-.472-.667z"/>',
} as const

export type LucideIconName = keyof typeof LUCIDE_NODES

const STROKE_ATTRIBUTES =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'

type LucideIconOptions = {
  /** Render as a solid shape instead of an outline. */
  filled?: boolean
  className?: string
  style?: string
  /** When set the icon is announced as a status; otherwise it is decorative. */
  accessibleLabel?: string
}

/** Returns an inline `<svg>` string for the lucide icon with the given component name. */
export function lucideIcon(name: LucideIconName, options: LucideIconOptions = {}): string {
  const paint = options.filled ? 'fill="currentColor"' : STROKE_ATTRIBUTES
  const accessibility = options.accessibleLabel
    ? `aria-label="${options.accessibleLabel}" role="status"`
    : 'aria-hidden="true"'
  const className = options.className ? ` class="${options.className}"` : ""
  const style = options.style ? ` style="${options.style}"` : ""
  return `<svg viewBox="0 0 24 24" ${paint} ${accessibility}${className}${style}>${LUCIDE_NODES[name]}</svg>`
}
