import { readFile } from "node:fs/promises"
import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

const SITE_BASE = "/Slacktor/"
const SITE_ROOT = __dirname
const SERVER_ENTRY = "/src/entry-server.tsx"

type SiteServerEntry = typeof import("./src/entry-server")

function siteDevRenderer(): Plugin {
  return {
    name: "slacktor-site-dev-renderer",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const requestPath = (req.url ?? "/").split("?")[0] ?? "/"
          const pagePath = requestPath.startsWith(SITE_BASE)
            ? `/${requestPath.slice(SITE_BASE.length)}`
            : requestPath
          const entry = (await server.ssrLoadModule(SERVER_ENTRY)) as SiteServerEntry
          const page = entry.findPageByPath(pagePath)
          if (!page) return next()

          const template = await server.transformIndexHtml(
            req.url ?? "/",
            await readFile(path.join(SITE_ROOT, "index.html"), "utf8"),
          )
          res.setHeader("Content-Type", "text/html; charset=utf-8")
          res.end(entry.renderDocument(template, page.id))
        } catch (error) {
          next(error)
        }
      })
    },
  }
}

export default defineConfig({
  root: SITE_ROOT,
  base: SITE_BASE,
  appType: "custom",
  publicDir: path.resolve(__dirname, "../../public"),
  plugins: [react(), tailwindcss(), siteDevRenderer()],
  resolve: {
    alias: {
      "@slacktor/ui": path.resolve(__dirname, "../../packages/ui/src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../../dist/site"),
    emptyOutDir: true,
  },
})
