export type SitePageId = "home" | "about" | "changelog" | "privacy-policy"

export type SitePage = {
  id: SitePageId
  /** Output file inside site-dist/. */
  fileName: string
  /** Path relative to the site base, used for links and dev routing. */
  path: string
  navLabel: string
  title: string
  description: string
}

export const SITE_PAGES: SitePage[] = [
  {
    id: "home",
    fileName: "index.html",
    path: "/",
    navLabel: "Home",
    title: "Slacktor: translate Slack messages with your own AI provider",
    description:
      "Slacktor is a Chrome extension that shows a translation under each Slack Web message, using the OpenAI-compatible provider you configure.",
  },
  {
    id: "about",
    fileName: "about.html",
    path: "/about.html",
    navLabel: "About",
    title: "About Slacktor",
    description:
      "How Slacktor translates Slack Web messages, what it needs from you, and what it deliberately does not do.",
  },
  {
    id: "changelog",
    fileName: "changelog.html",
    path: "/changelog.html",
    navLabel: "Changelog",
    title: "Slacktor changelog",
    description: "What changed in each Slacktor release.",
  },
  {
    id: "privacy-policy",
    fileName: "privacy-policy.html",
    path: "/privacy-policy.html",
    navLabel: "Privacy",
    title: "Slacktor Privacy Policy",
    description:
      "What data Slacktor handles, where it is sent, how long it is kept, and how to remove it.",
  },
]

export function getPageHref(page: SitePage): string {
  const base = import.meta.env.BASE_URL
  return page.path === "/" ? base : `${base}${page.fileName}`
}
