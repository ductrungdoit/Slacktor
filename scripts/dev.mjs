import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const isWindows = process.platform === "win32"
const npmCmd = isWindows ? "npm.cmd" : "npm"

const ext = spawn(npmCmd, ["run", "dev:extension"], {
  cwd: rootDir,
  stdio: "inherit",
  shell: isWindows,
})

const site = spawn(npmCmd, ["run", "dev:site"], {
  cwd: rootDir,
  stdio: "inherit",
  shell: isWindows,
})

let shuttingDown = false

function cleanup(code = 0) {
  if (shuttingDown) return
  shuttingDown = true

  if (isWindows) {
    if (ext.pid) {
      try {
        spawn("taskkill", ["/pid", ext.pid.toString(), "/t", "/f"])
      } catch {}
    }
    if (site.pid) {
      try {
        spawn("taskkill", ["/pid", site.pid.toString(), "/t", "/f"])
      } catch {}
    }
  } else {
    try {
      ext.kill("SIGTERM")
    } catch {}
    try {
      site.kill("SIGTERM")
    } catch {}
  }

  process.exit(code)
}

process.on("SIGINT", () => cleanup(0))
process.on("SIGTERM", () => cleanup(0))

ext.on("exit", (code) => {
  if (!shuttingDown && code !== 0 && code !== null) {
    cleanup(code)
  }
})

site.on("exit", (code) => {
  if (!shuttingDown && code !== 0 && code !== null) {
    cleanup(code)
  }
})
