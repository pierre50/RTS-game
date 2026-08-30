import { dynamicEquipmentAsset, dynamicEquipmentAssets, type DynamicEquipmentKey } from './equipment'
import { isAssetCached, loadDynamicEquipmentAsset } from './bakedAliasCache'

type LazyEquipmentPerformanceMonitor = {
  record?: (name: string, duration: number) => void
}

type LazyEquipmentLoadOptions = {
  idle?: boolean
  metricName?: string
  performanceMonitor?: LazyEquipmentPerformanceMonitor | null
}

const pendingEquipmentLoads = new Map<string, Promise<void>>()
let equipmentLoadQueue = Promise.resolve()

function waitForIdle(): Promise<void> {
  return new Promise(resolve => {
    const scheduler = globalThis as typeof globalThis & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
    }
    if (typeof scheduler.requestIdleCallback === 'function') {
      scheduler.requestIdleCallback(resolve, { timeout: 750 })
      return
    }
    globalThis.setTimeout(resolve, 0)
  })
}

export function getLazyEquipmentLoadStats(): { loaded: number; pending: number; total: number } {
  const assets = dynamicEquipmentAssets()
  return {
    loaded: assets.filter(asset => isAssetCached(asset.alias)).length,
    pending: pendingEquipmentLoads.size,
    total: assets.length,
  }
}

export function loadDynamicEquipmentAssetQueued(
  equipment: DynamicEquipmentKey,
  options: LazyEquipmentLoadOptions = {}
): Promise<void> {
  const asset = dynamicEquipmentAsset(equipment)
  let request = pendingEquipmentLoads.get(asset.alias)
  if (!request) {
    request = equipmentLoadQueue.then(async () => {
      if (options.idle !== false) await waitForIdle()
      const startedAt = performance.now()
      try {
        await loadDynamicEquipmentAsset(equipment)
      } finally {
        options.performanceMonitor?.record?.(
          options.metricName ?? 'lazyEquipment.loadAsset',
          performance.now() - startedAt
        )
      }
    })
    equipmentLoadQueue = request.catch(() => {})
    request = request.finally(() => pendingEquipmentLoads.delete(asset.alias))
    pendingEquipmentLoads.set(asset.alias, request)
  }
  return request
}
