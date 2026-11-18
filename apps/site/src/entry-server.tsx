import { SITE_URL } from "@slacktor/ui"
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { SiteLayout } from "./components/SiteLayout"
import { SITE_PAGES, type SitePage, type SitePageId } from "./pages"
import { AboutPage } from "./pages/AboutPage"
import { ChangelogPage } from "./pages/ChangelogPage"
import { HomePage } from "./pages/HomePage"
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage"

export { SITE_PAGES }

const PAGE_COMPONENTS: Record<SitePageId, () => ReactNode> = {
  home: () => <HomePage />,
  about: () => <AboutPage />,
  changelog: () => <ChangelogPage />,
  "privacy-policy": () => <PrivacyPolicyPage />,
}

export function findPageByPath(pagePath: string): SitePage | undefined {
  const normalizedPath = pagePath === "/index.html" ? "/" : pagePath
  return SITE_PAGES.find((page) => page.path === normalizedPath)
}

// Fills the site/index.html shell for one page. Used by the static build
// (scripts/build-site.mjs) and by the dev renderer in vite.site.config.ts.
export function renderDocument(template: string, pageId: SitePageId): string {
  const page = SITE_PAGES.find((candidate) => candidate.id === pageId)
  if (!page) throw new Error(`Unknown site page: ${pageId}`)

  const body = renderToStaticMarkup(
    <SiteLayout activePage={page.id}>{PAGE_COMPONENTS[page.id]()}</SiteLayout>,
  )

  return template.replace("<!--site-head-->", renderHead(page)).replace("<!--site-body-->", body)
}

function renderHead(page: SitePage): string {
  const canonicalUrl = page.path === "/" ? SITE_URL : `${SITE_URL}${page.fileName}`
  const title = escapeHtml(page.title)
  const description = escapeHtml(page.description)

  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${canonicalUrl}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Slacktor" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    `<meta property="og:image" content="${SITE_URL}icons/icon-128.png" />`,
  ].join("\n    ")
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}
