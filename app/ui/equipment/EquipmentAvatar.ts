import { renderEquipmentAvatar } from '../../lib/avatar'
import { dynamicEquipmentVisualKey } from '../../lib/lpc/equipment'
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
  const visualEquipment = dynamicEquipmentVisualKey(equipment)
  if (!visualEquipment) return false

  void loadDynamicEquipmentAssetQueued(visualEquipment, {
    metricName: 'lazyEquipmentAvatar.loadAsset',
    performanceMonitor: performanceMonitor ?? null,
  })
    .then(() => {
      if (canvas.isConnected) renderEquipmentAvatar(app, equipment, canvas)
    })
    .catch(error => console.warn(`Unable to render ${source} equipment avatar "${equipment}"`, error))

  return false
}
