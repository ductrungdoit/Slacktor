// Requests the optional host permission Slacktor needs to call a
// user-configured AI endpoint. Only HTTPS endpoints, or HTTP on localhost,
// are allowed (mirrors the manifest's optional_host_permissions).
export async function requestProviderPermission(endpoint: string): Promise<void> {
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    throw new Error("Use an HTTPS endpoint, or HTTP on localhost only.")
  }
  const isLocalHttp =
    url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error("Use an HTTPS endpoint, or HTTP on localhost only.")
  }
  const granted = await chrome.permissions.request({ origins: [`${url.protocol}//${url.host}/*`] })
  if (!granted) throw new Error("Permission was not granted for this AI endpoint.")
}
