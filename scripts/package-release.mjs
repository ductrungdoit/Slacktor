import { execSync } from "node:child_process"
import { mkdir, readFile, rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const pkg = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"))
const releaseDir = path.join(rootDir, "release")
const extensionDir = path.join(rootDir, "dist", "extension")
const archivePath = path.join(releaseDir, `Slacktor-${pkg.version}.zip`)

execSync("npm run build", {
  cwd: rootDir,
  stdio: "inherit",
  env: { ...process.env, SLACKTOR_RELEASE: "1" },
})

await mkdir(releaseDir, { recursive: true })
await rm(archivePath, { force: true })

if (process.platform === "win32") {
  // Windows: use PowerShell's built-in Compress-Archive
  execSync(
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path '${path.join(extensionDir, "*")}' -DestinationPath '${archivePath}' -Force"`,
    { stdio: "inherit" },
  )
} else {
  // macOS / Linux: use system zip command inside extension directory
  // to ensure manifest.json is at the root of the ZIP archive
  execSync(`zip -r -q "${archivePath}" .`, {
    cwd: extensionDir,
    stdio: "inherit",
  })
}

console.log(archivePath)
