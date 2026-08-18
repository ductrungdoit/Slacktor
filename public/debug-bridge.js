(() => {
  if (window.CheckContext) return

  window.CheckContext = (url) => new Promise((resolve) => {
    const requestId = crypto.randomUUID()
    const receive = (event) => {
      if (event.detail?.requestId !== requestId) return
      document.removeEventListener("slacktor:thread-context-result", receive)
      resolve(event.detail.response)
    }

    document.addEventListener("slacktor:thread-context-result", receive)
    document.dispatchEvent(new CustomEvent("slacktor:inspect-thread-context", {
      detail: { url, requestId },
    }))
  })
})()
