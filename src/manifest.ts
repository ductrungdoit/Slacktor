import type { ManifestV3Export } from "@crxjs/vite-plugin"

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: "Slacktor",
  version: "0.1.4",
  description: "AI translation overlay for Slack Web.",
  permissions: ["storage"],
  host_permissions: ["https://app.slack.com/*"],
  optional_host_permissions: [
    "https://*/*",
    "http://localhost/*",
    "http://127.0.0.1/*",
  ],
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["https://app.slack.com/*"],
      js: ["src/content/content-script.ts"],
      run_at: "document_idle",
    },
  ],
  action: {
    default_title: "Slacktor",
    default_popup: "src/popup/popup.html",
    default_icon: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
  },
  icons: {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  },
}

export default manifest
