import { seekGroundToolMaterials } from '../../lib/units/village/villageGroundRecovery'
import { npcNeedsSupplies } from '../../lib/units/supplies/npcSupplyStatus'
import { getBaseTerritory } from '../../lib/territory/baseTerritory'
import type { UnitEntity } from '../../types/entities'
import { syncNpcWeaponAppearance } from '../../lib/units/visuals/npcWeaponAppearance'
import { notifyVillageWorkChanged } from '../../lib/units/village/villageWorkEvents'
import { supplyTownTool, supplyTownWeapons } from '../../lib/units/supplies/townToolSupply'
import { refreshUnitEquipmentStats } from '../../lib/equipment/equipmentStats'
import { supplyTownArrows } from '../../lib/units/supplies/townArrowSupply'
import { replenishNpcArrows } from '../../lib/units/combat/unitArrows'
import type { GameContextLike } from '../../types/context'
import type { DailyWorldEvent, DailyWorldEventHandler } from '../dailyEvents/DailyWorldEventTypes'

/** Daily supplies are delayed until combat ends; the pending allowance survives saves. */
export class NpcArrowSupplySystem implements DailyWorldEventHandler {
  private returnRetry = new WeakMap<UnitEntity, number>()
  private taskId: number | null = null
  constructor(private context: GameContextLike) {
    this.taskId = context.scheduler?.add(() => this.update(), 1000, 'npc.arrowSupplies') ?? null
  }

  handleDailyWorldEvent(event: DailyWorldEvent): void {
    for (const player of this.context.players ?? [])
      for (const unit of player.units ?? []) replenishNpcArrows(unit, event.day, player)
    this.context.menu?.refreshInventory?.()
  }

  private update(): void {
    let changed = false
    for (const player of this.context.players ?? [])
      for (const unit of player.units ?? []) {
        if (unit.inventory?.npcArrows?.pendingDay != null) replenishNpcArrows(unit, undefined, player)
        if (supplyTownArrows(unit, player, { hunting: unit.work === 'hunter' })) changed = true
        const toolChanged = supplyTownTool(unit, player)
        const weaponChanged = supplyTownWeapons(unit, player)
        if (!toolChanged) seekGroundToolMaterials(unit)
        if (
          npcNeedsSupplies(unit) &&
          unit.inactif &&
          !unit.action &&
          !unit.dest &&
          !unit.path?.length &&
          !unit.combatMode &&
          unit.villageHome &&
          !unit.isChief &&
          !unit.campPatrolAnchor &&
          !unit.banditCampAnchor &&
          !getBaseTerritory({ i: unit.i, j: unit.j, spaceId: unit.spaceId }, [player])
        ) {
          const now = this.context.scheduler?.elapsedMs ?? 0
          const town = getBaseTerritory(unit.villageHome, [player])?.center
          if (town && now >= (this.returnRetry.get(unit) ?? 0)) {
            this.returnRetry.set(unit, now + 10000)
            const target = player.buildings.find(building => building === town)
            if (target) unit.sendToEvt?.(target, null)
          }
        }
        if (toolChanged || weaponChanged) {
          notifyVillageWorkChanged(player)
          syncNpcWeaponAppearance(unit)
          refreshUnitEquipmentStats(unit)
          unit.syncAppearanceLayers?.(unit.currentSheet ?? 'standingSheet')
          changed = true
        }
      }
    if (changed) {
      this.context.menu?.refreshInventory?.()
      this.context.menu?.updateTopbar?.()
    }
  }

  destroy(): void {
    if (this.taskId != null) this.context.scheduler?.remove(this.taskId)
    this.taskId = null
  }
}
