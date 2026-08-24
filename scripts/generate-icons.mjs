import sharp from "sharp"
import { mkdir } from "node:fs/promises"

const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect x="16" y="16" width="96" height="96" rx="23" fill="#4A154B"/>
  <path fill="#fff" d="M43 38h31c10 0 17 7 17 15 0 6-3 11-9 14 7 3 11 8 11 16 0 10-8 17-19 17H43V88h30c5 0 8-3 8-7s-3-6-8-6H52V63h21c4 0 7-2 7-6 0-3-3-6-7-6H43V38Z"/>
  <path fill="#36C5F0" d="M34 38h9v62h-9z"/>
</svg>`

await mkdir("public/icons", { recursive: true })
await mkdir("store-assets", { recursive: true })

for (const size of [16, 32, 48, 128]) {
  await sharp(Buffer.from(iconSvg)).resize(size, size).png().toFile(`public/icons/icon-${size}.png`)
}

const promoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#4A154B"/><stop offset="1" stop-color="#1264A3"/></linearGradient></defs>
  <rect width="440" height="280" fill="url(#g)"/>
  <circle cx="354" cy="54" r="86" fill="#36C5F0" opacity=".18"/>
  <circle cx="74" cy="252" r="98" fill="#2EB67D" opacity=".16"/>
  <rect x="156" y="60" width="128" height="128" rx="30" fill="#fff" opacity=".98"/>
  <rect x="172" y="76" width="96" height="96" rx="23" fill="#4A154B"/>
  <path fill="#fff" d="M199 98h31c10 0 17 7 17 15 0 6-3 11-9 14 7 3 11 8 11 16 0 10-8 17-19 17h-31v-12h30c5 0 8-3 8-7s-3-6-8-6h-21v-12h21c4 0 7-2 7-6 0-3-3-6-7-6h-30V98Z"/>
  <path fill="#36C5F0" d="M190 98h9v62h-9z"/>
  <path d="M112 214h216" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".9"/>
  <path d="M148 230h144" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>
</svg>`
await sharp(Buffer.from(promoSvg)).png().toFile("store-assets/promo-440x280.png")
