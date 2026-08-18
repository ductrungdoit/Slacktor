import type { ManifestV3Export } from "@crxjs/vite-plugin"

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: "Slacktor",
  version: "0.1.0",
  description: "AI translation overlay for Slack Web.",
  permissions: ["storage", "tabs"],
  host_permissions: ["https://app.slack.com/*"],
  optional_host_permissions: ["http://*/*", "https://*/*"],
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
  web_accessible_resources: [
    {
      resources: ["debug-bridge.js"],
      matches: ["https://app.slack.com/*"],
    },
  ],
  action: {
    default_title: "Slacktor",
    default_popup: "src/popup/popup.html",
  },
  options_page: "src/options/options.html",
}

export default manifest
