import { mkdir } from "node:fs/promises"

import sharp from "sharp"

const ICON_CANVAS_SIZE = 128
const ICON_CENTER = ICON_CANVAS_SIZE / 2

// Ring + accent arc from the design reference (27x27 artboard). The ring is not
// centered on that artboard (center ~13.967, 13.846), so it is re-centered on the
// canvas. The scale leaves room for the accent arc, which sits just outside the ring.
const RING_CENTER_X = 13.967
const RING_CENTER_Y = 13.846
const RING_SCALE = ICON_CANVAS_SIZE / 29.2

// Slack logo from a 127x127 artboard (content centered at 63.5, 63.5). Scaled so
// the logo box is ~76px, matching the proportion of the previous raster icon.
const SLACK_LOGO_CENTER = 63.5
const SLACK_LOGO_SCALE = 0.6

const ICON_SHAPES = `
  <g transform="translate(${ICON_CENTER} ${ICON_CENTER}) scale(${RING_SCALE}) translate(${-RING_CENTER_X} ${-RING_CENTER_Y})">
    <path d="M0.81189 13.8229C0.8756 6.53501 6.66111 0.67826 13.9861 0.691582C21.2653 0.704324 27.1284 6.45276 27.1221 13.8403C27.1157 21.3437 21.1877 27.0168 13.9658 27C6.5221 26.9821 0.872704 21.0854 0.81189 13.8229ZM14.0463 2.78361C7.89883 2.71411 2.98153 7.71076 2.96126 13.7615C2.9404 19.8893 7.9747 24.8009 13.989 24.8107C19.8701 24.82 25.1204 19.9548 24.9994 13.549C24.8899 7.73277 20.0867 2.76449 14.0463 2.78361Z" fill="#F7E4F0"/>
    <path d="M16.0701 0.51835C11.2906 -0.152349 7.12047 1.08306 3.86601 4.69545C0.613869 8.30553 -0.202207 12.577 0.981074 17.2638C-0.534082 13.9891 -0.465159 9.08512 2.39893 5.15707C5.358 1.09986 10.6761 -1.05936 16.0701 0.51835Z" fill="#A612A2"/>
  </g>
  <g transform="translate(${ICON_CENTER} ${ICON_CENTER}) scale(${SLACK_LOGO_SCALE}) translate(${-SLACK_LOGO_CENTER} ${-SLACK_LOGO_CENTER})">
    <path d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2C6.7 93.2.8 87.3.8 80c0-7.3 5.9-13.2 13.2-13.2h13.2V80zm6.6 0c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v33c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V80z" fill="#E01E5A"/>
    <path d="M47 27c-7.3 0-13.2-5.9-13.2-13.2C33.8 6.5 39.7.6 47 .6c7.3 0 13.2 5.9 13.2 13.2V27H47zm0 6.7c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H13.9C6.6 60.1.7 54.2.7 46.9c0-7.3 5.9-13.2 13.2-13.2H47z" fill="#36C5F0"/>
    <path d="M99.9 46.9c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H99.9V46.9zm-6.6 0c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V13.8C66.9 6.5 72.8.6 80.1.6c7.3 0 13.2 5.9 13.2 13.2v33.1z" fill="#2EB67D"/>
    <path d="M80.1 99.8c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V99.8h13.2zm0-6.6c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33.1c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H80.1z" fill="#ECB22E"/>
  </g>`

// Rendered as vector at each target size instead of downscaling one bitmap, so
// small toolbar icons stay crisp.
function renderIconSvg(size) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${ICON_CANVAS_SIZE} ${ICON_CANVAS_SIZE}" fill="none">${ICON_SHAPES}</svg>`,
  )
}

await mkdir("public/icons", { recursive: true })
await mkdir("store-assets", { recursive: true })

for (const size of [16, 32, 48, 128]) {
  await sharp(renderIconSvg(size)).png().toFile(`public/icons/icon-${size}.png`)
}

const PROMO_WIDTH = 440
const PROMO_HEIGHT = 280
const PROMO_ICON_SIZE = 128

// Same gradient as --brand-gradient in src/popup/index.css. The glow reuses the
// logo's accent arc color, and the faint concentric rings echo the logo ring.
const PROMO_BACKGROUND_SVG = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${PROMO_WIDTH}" height="${PROMO_HEIGHT}" viewBox="0 0 ${PROMO_WIDTH} ${PROMO_HEIGHT}">
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#872ada"/><stop offset="1" stop-color="#5f309f"/></linearGradient>
    <radialGradient id="accent-glow" cx="0.22" cy="0.18" r="0.6"><stop stop-color="#A612A2" stop-opacity=".55"/><stop offset="1" stop-color="#A612A2" stop-opacity="0"/></radialGradient>
    <radialGradient id="corner-shade" cx="0.85" cy="1" r="0.7"><stop stop-color="#2a0f4f" stop-opacity=".45"/><stop offset="1" stop-color="#2a0f4f" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${PROMO_WIDTH}" height="${PROMO_HEIGHT}" fill="url(#brand)"/>
  <rect width="${PROMO_WIDTH}" height="${PROMO_HEIGHT}" fill="url(#accent-glow)"/>
  <rect width="${PROMO_WIDTH}" height="${PROMO_HEIGHT}" fill="url(#corner-shade)"/>
  <circle cx="${PROMO_WIDTH / 2}" cy="${PROMO_HEIGHT / 2}" r="104" fill="none" stroke="#F7E4F0" stroke-opacity=".10" stroke-width="2"/>
  <circle cx="${PROMO_WIDTH / 2}" cy="${PROMO_HEIGHT / 2}" r="132" fill="none" stroke="#F7E4F0" stroke-opacity=".06" stroke-width="2"/>
</svg>`)

await sharp(PROMO_BACKGROUND_SVG)
  .composite([
    {
      input: renderIconSvg(PROMO_ICON_SIZE),
      left: (PROMO_WIDTH - PROMO_ICON_SIZE) / 2,
      top: (PROMO_HEIGHT - PROMO_ICON_SIZE) / 2,
    },
  ])
  .png()
  .toFile("store-assets/promo-440x280.png")
