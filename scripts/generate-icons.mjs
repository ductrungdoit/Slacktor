import sharp from "sharp"
import { mkdir } from "node:fs/promises"

const sourceIcon = "store-assets/slacktor-source-icon.png"

await mkdir("public/icons", { recursive: true })
await mkdir("store-assets", { recursive: true })

for (const size of [16, 32, 48, 128]) {
  await sharp(sourceIcon)
    .resize(size, size, { fit: "contain" })
    .png()
    .toFile(`public/icons/icon-${size}.png`)
}

const promoBackground = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#14151a"/><stop offset="1" stop-color="#393d48"/></linearGradient></defs>
  <rect width="440" height="280" fill="url(#g)"/>
  <circle cx="354" cy="54" r="86" fill="#fff" opacity=".06"/>
  <circle cx="74" cy="252" r="98" fill="#fff" opacity=".04"/>
  <rect x="150" y="55" width="140" height="140" rx="30" fill="#fff" opacity=".96"/>
  <path d="M112 220h216" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".9"/>
  <path d="M148 236h144" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5"/>
</svg>`)

const promoIcon = await sharp(sourceIcon).resize(112, 112).png().toBuffer()
await sharp(promoBackground)
  .composite([{ input: promoIcon, left: 164, top: 69 }])
  .png()
  .toFile("store-assets/promo-440x280.png")
