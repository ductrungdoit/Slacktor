// Public URLs shared by the popup and the documentation site (site/).
// The site is published to GitHub Pages from the upstream repository.

export const REPOSITORY_URL = "https://github.com/ductrungdoit/Slacktor"
export const ISSUES_URL = `${REPOSITORY_URL}/issues`
export const RELEASES_URL = `${REPOSITORY_URL}/releases`

const PUBLIC_SITE_URL = "https://ductrungdoit.github.io/Slacktor/"
const DEV_SITE_URL = "http://localhost:5173/Slacktor/"

function resolveSitePageUrl(fileName: string): string {
  const relativePath = fileName === "index.html" ? "" : fileName
  if (import.meta.env.DEV) {
    return `${DEV_SITE_URL}${relativePath}`
  }
  if (
    __SLACKTOR_LOCAL_SITE__ &&
    typeof chrome !== "undefined" &&
    typeof chrome.runtime?.getURL === "function"
  ) {
    return chrome.runtime.getURL(`site/${fileName}`)
  }
  return `${PUBLIC_SITE_URL}${relativePath}`
}

export const SITE_URL = resolveSitePageUrl("index.html")
export const ABOUT_URL = resolveSitePageUrl("about.html")
export const CHANGELOG_URL = resolveSitePageUrl("changelog.html")
// Referenced by the Chrome Web Store listing. Keep this path stable.
export const PRIVACY_POLICY_URL = resolveSitePageUrl("privacy-policy.html")

export const CONTACT_EMAIL = "ductrung.do.it@gmail.com"
