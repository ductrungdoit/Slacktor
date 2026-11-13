import path from "node:path"

import { crx } from "@crxjs/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

import manifest from "./src/manifest"

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  publicDir: path.resolve(__dirname, "../../public"),
  server: {
    port: 5174,
    fs: {
      allow: [path.resolve(__dirname, "../..")],
    },
  },
  resolve: {
    alias: {
      "@/components/ui": path.resolve(__dirname, "../../packages/ui/src/components/ui"),
      "@": path.resolve(__dirname, "src/popup"),
      "@slacktor/ui": path.resolve(__dirname, "../../packages/ui/src"),
    },
  },
  define: {
    __SLACKTOR_LOCAL_SITE__: JSON.stringify(process.env.SLACKTOR_RELEASE !== "1"),
  },
  build: {
    outDir: path.resolve(__dirname, "../../dist/extension"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        if (warning.code === "INVALID_ANNOTATION") return
        defaultHandler(warning)
      },
    },
  },
})
