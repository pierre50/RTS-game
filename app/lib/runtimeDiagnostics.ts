import { traceLoad } from './loadDiagnostics'

type Details = Record<string, string | number | boolean | null | undefined>
let until = 0
let session = 0
const seen = new Set<string>()

/** Short, bounded capture after a minimap teleport; never retain entities or map cells. */
export function startTeleportDiagnostics(details: Details): void {
  until = performance.now() + 15000
  session++
  seen.clear()
  traceLoad('runtime.teleport.begin', () => {}, { ...details, session })
}

export function traceRuntime<T>(stage: string, callback: () => T, details: Details = {}, key = stage): T {
  if (performance.now() >= until || seen.has(key) || seen.size >= 256) return callback()
  seen.add(key)
  return traceLoad(`runtime.${stage}`, callback, { ...details, session })
}
