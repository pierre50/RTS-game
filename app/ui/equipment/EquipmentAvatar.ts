import { renderEquipmentAvatar } from '../../lib/avatar'
import { isDynamicEquipmentKey } from '../../lib/lpc/equipment'
import { loadDynamicEquipmentAssetQueued } from '../../lib/lpc/lazyEquipmentAssets'
import type { Application } from 'pixi.js'

type EquipmentAvatarPerformanceMonitor = {
  record?: (name: string, duration: number) => void
}

export function renderEquipmentAvatarLazy(
  app: Application,
  equipment: string,
  canvas: HTMLCanvasElement,
  source = 'equipment',
  performanceMonitor?: EquipmentAvatarPerformanceMonitor | null
): boolean {
  if (renderEquipmentAvatar(app, equipment, canvas)) return true
  if (!isDynamicEquipmentKey(equipment)) return false

  void loadDynamicEquipmentAssetQueued(equipment, {
    metricName: 'lazyEquipmentAvatar.loadAsset',
    performanceMonitor,
  })
    .then(() => {
      if (canvas.isConnected) renderEquipmentAvatar(app, equipment, canvas)
    })
    .catch(error => console.warn(`Unable to render ${source} equipment avatar "${equipment}"`, error))

  return false
}
