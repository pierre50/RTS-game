import { equipmentBaseKey, isEquipmentBroken } from '../../lib/equipment/equipmentCondition'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { QuestJournalState } from '../../types/quest'

export const CAMP_RESOURCES = 'camp-first-resources'
export const CAMP_AXE = 'camp-first-tool'
export const CAMP_HAMMER = 'camp-prepare-shelter'
export const CAMP_SPEAR = 'camp-first-defense'

/** Facts live in the journal, including after the resource quest is completed. */
export function observeCampPreparation(context: GameContextLike, state: QuestJournalState): boolean {
  const quest = state.quests.find(q => q.id === CAMP_RESOURCES && q.assigneeId === context.player?.label)
  const hero = context.controls?.heroUnit
  if (!quest || !hero || hero.isDead || hero.isDestroyed) return false
  const region = context.map?.worldRegionId ?? context.getCurrentWorldId?.() ?? ''
  if (quest.regionId !== region) return false
  let changed = false
  const remember = (key: string, value: boolean) => {
    if (value && !quest.facts[key]) {
      quest.facts[key] = true
      changed = true
    }
  }
  const inventory = hero.inventory
  const carried = [...(inventory?.equipment ?? []), ...Object.values(inventory?.activeWeapons ?? {})]
  const hasTool = carried.some(item => /^(axe|hammer)_/.test(equipmentBaseKey(item)))
  remember(
    'resourcesReady',
    hasTool || ((inventory?.resources?.wood ?? 0) >= 4 && (inventory?.resources?.stone ?? 0) >= 5)
  )
  const tool = inventory?.activeWeapons?.tool
  if (tool && !isEquipmentBroken(tool)) {
    remember('axeEquipped', equipmentBaseKey(tool).startsWith('axe_'))
    remember('hammerEquipped', equipmentBaseKey(tool).startsWith('hammer_'))
  }
  return changed
}

export function campPreparationDone(state: QuestJournalState, id: string): boolean {
  const facts = state.quests.find(q => q.id === CAMP_RESOURCES)?.facts ?? {}
  if (id === CAMP_RESOURCES) return facts.resourcesReady === true
  if (id === CAMP_AXE) return facts.axeEquipped === true
  return facts.woodCut === true && facts.hammerEquipped === true
}

/** Only actual wood harvested from a tree counts, never loose branches or NPC work. */
export function recordCampWoodCut(unit: UnitEntity): void {
  const context = unit.context
  if (context?.controls?.heroUnit !== unit) return
  const quest = context
    .getQuestJournal?.()
    ?.quests.find(q => q.id === CAMP_RESOURCES && q.assigneeId === unit.owner?.label)
  const region = context.map?.worldRegionId ?? context.getCurrentWorldId?.() ?? ''
  if (!quest || quest.regionId !== region || quest.facts.woodCut) return
  quest.facts.woodCut = true
  context.autosave?.()
}

export function hasEquippedCampSpear(hero?: UnitEntity | null): boolean {
  const spear = hero?.inventory?.activeWeapons?.melee
  return Boolean(
    hero && !hero.isDead && spear && equipmentBaseKey(spear).startsWith('spear_') && !isEquipmentBroken(spear)
  )
}
