import { PLAYER_TYPES, SOUND_CUES, SHEET_TYPES } from '../../constants'
import { refreshUnitEquipmentStats } from '../../lib/equipment/equipmentStats'
import { isValidCondition, playSoundCue } from '../../lib'
import type { GameContextLike } from '../../types/context'
import type { PlayerLike } from '../../types/player'
import type { RuntimeEntity } from '../../types/entities'
import type { Condition } from '../../lib/combat'

type PlayerAgeOwner = PlayerLike & { context: GameContextLike }

export function onAgeChange(player: PlayerAgeOwner): void {
  const {
    context: { players, menu },
  } = player
  const refreshSelection = (selection: RuntimeEntity | null | undefined) => {
    if (!selection?.interface) return false
    if (selection.owner?.label !== player.label) return false
    menu.setActionTarget(selection)
    return true
  }

  if (player.isPlayed) {
    playSoundCue(SOUND_CUES.player.ageAdvance)
  }
  for (const unit of player.units ?? []) {
    if (unit.isDead || unit.isDestroyed) continue
    refreshUnitEquipmentStats(unit)
    unit.setTextures?.(unit.currentSheet ?? SHEET_TYPES.standing)
  }
  for (const building of player.buildings) {
    if (building.isBuilt && !building.isDead) {
      building.finalTexture?.()
    }
  }
  for (const selectedPlayer of players) {
    if (selectedPlayer.type === PLAYER_TYPES.human) {
      refreshSelection(selectedPlayer.selectedUnit) ||
        refreshSelection(selectedPlayer.selectedBuilding) ||
        refreshSelection(selectedPlayer.selectedOther)
    }
  }
}

export function isBuildingEligible(player: PlayerLike, type: string): boolean {
  const config = player.config.buildings[type]
  if (!config) return false

  return (config.conditions || []).every((condition: Condition) => isValidCondition(condition, player))
}
