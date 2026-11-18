import pkg from "../../../../package.json"

/**
 * Official project version sourced directly from the root `package.json`.
 */
export const APP_VERSION: string = pkg.version

/**
 * Version milestones that trigger clearing or rebuilding local extension data.
 *
 * When bumping `version` in root `package.json`:
 * - Update a constant below to the new version ONLY when that release requires
 *   resetting or rebuilding the corresponding data/schema.
 * - Leave it unchanged when existing user data/cache remains compatible.
 */
export const TRANSLATION_CACHE_RESET_VERSION = "0.2.0"
export const CONTEXT_STORE_RESET_VERSION = "0.2.0"
export const THREAD_SUMMARY_RESET_VERSION = "0.2.0"
export const CONFIG_SCHEMA_RESET_VERSION = "0.2.0"

/**
 * Physical IndexedDB schema version required by `indexedDB.open`.
 * Keep fixed unless object stores or indexes are structurally added or removed.
 */
export const SLACKTOR_DB_VERSION = 6

export function isVersionAtLeast(version: string, minVersion: string): boolean {
  const parse = (value: string) => value.split(".").map((part) => Number.parseInt(part, 10) || 0)
  const [majA = 0, minA = 0, patA = 0] = parse(version)
  const [majB = 0, minB = 0, patB = 0] = parse(minVersion)
  if (majA !== majB) return majA > majB
  if (minA !== minB) return minA > minB
  return patA >= patB
}
