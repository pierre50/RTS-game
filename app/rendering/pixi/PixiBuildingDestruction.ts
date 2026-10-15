import type { Container } from 'pixi.js'
import { LABEL_TYPES } from '../../constants'
import { spawnSpriteFragmentBurst } from '../../lib'
import type { Building } from '../../classes/building/Building'
import { CAMPFIRE_DECORATION_LABEL, CAMPFIRE_SMOKE_DECORATION_LABEL } from './PixiBuildingFire'
import type { BuildingDestructionGroundTarget } from '../BuildingView'
import { clearBuildingConstructionReveal } from './PixiBuildingVisuals'

const BUILDING_DESTRUCTION_CLEAR_MS = 940

export function showBuildingDestruction(
  building: Building,
  container: Container,
  groundTargets: BuildingDestructionGroundTarget[]
): void {
  for (const label of [
    LABEL_TYPES.color,
    LABEL_TYPES.deco,
    LABEL_TYPES.fire,
    CAMPFIRE_DECORATION_LABEL,
    CAMPFIRE_SMOKE_DECORATION_LABEL,
  ]) {
    container.getChildByLabel(label)?.destroy()
  }

  // Fragments must use the finished sprite's full opacity and tint.
  clearBuildingConstructionReveal(building)
  const footprintArea = Math.max(1, groundTargets.length)
  spawnSpriteFragmentBurst({
    context: building.context,
    host: building,
    sprite: building.sprite,
    layer: container.parent,
    fragmentSize: 14,
    maxFragments: Math.min(96, 28 + footprintArea * 8),
    durationMs: BUILDING_DESTRUCTION_CLEAR_MS,
    gravity: 0.0026,
    minSpeed: 0.014,
    maxSpeed: 0.09,
    upwardVelocity: 0.045,
    settleToBottom: true,
    lockX: true,
    groundTargets,
    settleSpread: Math.max(34, Math.sqrt(footprintArea) * 24),
    settleStrength: 0.00006,
    groundBounce: 0.09,
  })

  building.sprite.eventMode = 'none'
  building.sprite.visible = false
  building.sprite.parent?.removeChild(building.sprite)
  building.sprite.destroy({ children: true, texture: false })
  building.shadow?.parent?.removeChild(building.shadow)
  building.shadow?.destroy({ children: true, texture: false })
  building.shadow = null
}
