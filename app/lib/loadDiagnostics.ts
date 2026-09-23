// Temporary loading diagnostics. Scalar JSON snapshots avoid retaining game objects in DevTools.
const ENABLED = true
let nextId = 0
type Details = Record<string, string | number | boolean | null | undefined>
type Heap = { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }

function heap(): Heap | undefined {
  return (performance as Performance & { memory?: Heap }).memory
}

export function beginLoadTrace(name: string, details: Details = {}) {
  const id = ++nextId
  const startedAt = performance.now()
  const initialHeap = heap()?.usedJSHeapSize
  const write = (status: string, extra: Details = {}) => {
    if (!ENABLED) return
    const memory = heap()
    const mib = (bytes: number) => Math.round((bytes / 1048576) * 10) / 10
    console.info(
      `[load] ${JSON.stringify({
        id,
        stage: name,
        status,
        elapsedMs: Math.round(performance.now() - startedAt),
        heapUsedMiB: memory ? mib(memory.usedJSHeapSize) : null,
        heapDeltaMiB: memory && initialHeap !== undefined ? mib(memory.usedJSHeapSize - initialHeap) : null,
        heapAllocatedMiB: memory ? mib(memory.totalJSHeapSize) : null,
        heapLimitMiB: memory ? mib(memory.jsHeapSizeLimit) : null,
        ...details,
        ...extra,
      })}`
    )
  }
  write('START')
  return {
    progress: (details: Details) => write('PROGRESS', details),
    end: (details: Details = {}) => write('END', details),
    fail: (error: unknown) => write('ERROR', { error: error instanceof Error ? error.message : String(error) }),
  }
}

export function traceLoad<T>(name: string, callback: () => T, details?: Details): T {
  const trace = beginLoadTrace(name, details)
  try {
    const result = callback()
    trace.end()
    return result
  } catch (error) {
    trace.fail(error)
    throw error
  }
}

export async function traceLoadAsync<T>(name: string, callback: () => Promise<T> | T, details?: Details): Promise<T> {
  const trace = beginLoadTrace(name, details)
  try {
    const result = await callback()
    trace.end()
    return result
  } catch (error) {
    trace.fail(error)
    throw error
  }
}
