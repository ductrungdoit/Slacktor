// Builds the documentation site (site/) into dist/site/ for GitHub Pages.
// For local builds (when SLACKTOR_RELEASE !== "1"), also outputs an embedded
// copy into dist/extension/site/ so the unpacked extension can open the site
// locally without running a web server.
//
// 1. Client build: processes site/index.html and the Tailwind stylesheet.
// 2. SSR build: bundles site/src/entry-server.tsx for Node.
// 3. Prerender: renders every page to static HTML. No client JavaScript ships.
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { build } from "vite"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const configFile = path.join(rootDir, "apps/site/vite.config.ts")
const outDir = path.join(rootDir, "dist/site")
const extensionSiteDir = path.join(rootDir, "dist/extension/site")
const serverOutDir = path.join(outDir, ".server")
const isReleaseBuild = process.env.SLACKTOR_RELEASE === "1"

await build({ configFile, logLevel: "warn" })

await build({
  configFile,
  logLevel: "warn",
  publicDir: false,
  build: {
    ssr: "src/entry-server.tsx",
    outDir: serverOutDir,
    emptyOutDir: true,
    copyPublicDir: false,
  },
})

const template = await readFile(path.join(outDir, "index.html"), "utf8")
const { SITE_PAGES, renderDocument } = await import(
  pathToFileURL(path.join(serverOutDir, "entry-server.js")).href
)

const renderedPages = new Map()
for (const page of SITE_PAGES) {
  const html = renderDocument(template, page.id)
  renderedPages.set(page.fileName, html)
  await writeFile(path.join(outDir, page.fileName), html)
  console.log(`dist/site/${page.fileName}`)
}

await rm(serverOutDir, { recursive: true, force: true })

if (isReleaseBuild) {
  await rm(extensionSiteDir, { recursive: true, force: true })
} else {
  await rm(extensionSiteDir, { recursive: true, force: true })
  const assetsOutDir = path.join(extensionSiteDir, "assets")
  await mkdir(assetsOutDir, { recursive: true })
  await cp(path.join(outDir, "assets"), assetsOutDir, { recursive: true })

  for (const assetName of await readdir(assetsOutDir)) {
    if (!assetName.endsWith(".css")) continue
    const cssPath = path.join(assetsOutDir, assetName)
    const cssContent = await readFile(cssPath, "utf8")
    await writeFile(cssPath, cssContent.replaceAll("url(/Slacktor/assets/", "url(/site/assets/"))
  }

  for (const [fileName, html] of renderedPages.entries()) {
    const localHtml = html
      .replaceAll('href="/Slacktor/"', 'href="/site/index.html"')
      .replaceAll('href="/Slacktor/icons/', 'href="/icons/')
      .replaceAll('src="/Slacktor/icons/', 'src="/icons/')
      .replaceAll('href="/Slacktor/', 'href="/site/')
      .replaceAll('src="/Slacktor/', 'src="/site/')
    await writeFile(path.join(extensionSiteDir, fileName), localHtml)
  }
}
