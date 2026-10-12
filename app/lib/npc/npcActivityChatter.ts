import { groundToolPlan } from '../units/supplies/groundToolRecovery'
import { isEquipmentBroken } from '../equipment/equipmentCondition'
import { npcNeedsSupplies } from '../units/supplies/npcSupplyStatus'
import { isGroundResourceType } from '../resources/groundResourceRegrowth'
import type { UnitEntity } from '../../types/entities'

const actions: Record<string, [string, string]> = {
  attack: ['Je défends les nôtres !', 'I’m defending our people!'],
  flee: ['Je me mets à l’abri !', 'I’m getting to safety!'],
  chopwood: ['Je coupe du bois.', 'I’m gathering wood.'],
  minestone: ['Je taille de la pierre.', 'I’m quarrying stone.'],
  minegold: ['J’extrais de l’or.', 'I’m mining gold.'],
  minecopper: ['J’extrais du cuivre.', 'I’m mining copper.'],
  minetin: ['J’extrais de l’étain.', 'I’m mining tin.'],
  mineiron: ['J’extrais du fer.', 'I’m mining iron.'],
  forageberry: ['Je ramasse de quoi manger.', 'I’m gathering food.'],
  farm: ['Je m’occupe des cultures.', 'I’m tending the crops.'],
  hunt: ['Je chasse pour nous nourrir.', 'I’m hunting for food.'],
  takemeat: ['Je récupère la viande.', 'I’m collecting the meat.'],
  captureHorse: ['Je vais apprivoiser ce cheval.', 'I’m going to tame that horse.'],
  heal: ['Je soigne les blessés.', 'I’m tending to the wounded.'],
  train: ['Je m’entraîne.', 'I’m training.'],
}

/** Actual errands take precedence over the worker's assigned job or a generic greeting. */
export function npcActivityChatter(unit: UnitEntity, english: boolean, working: boolean): string | null {
  const say = (fr: string, en: string) => (english ? en : fr)
  const target = unit.dest ?? (unit.lookingAtHero ? unit.previousDest : null)
  const action = unit.action ?? ''
  if (action === 'attack' || action === 'flee') return actions[action][english ? 1 : 0]
  if (unit.followingHero) return say('Je vous accompagne.', 'I’m following you.')
  if (unit.resourceDeliveryState || action === 'delivery')
    return unit.resourceDeliveryState?.pickup
      ? say('Je vais chercher des provisions au dépôt.', 'I’m fetching supplies from storage.')
      : say('Je rapporte ce que j’ai récolté.', 'I’m bringing back what I gathered.')
  const toolPlan = working ? groundToolPlan(unit) : undefined
  if (toolPlan) {
    const missing = toolPlan.missing
    if (missing.length) {
      if (toolPlan.bagFull && !target && !unit.path?.length && !action)
        return say(
          'Mon sac est plein. Il me faut de la place pour préparer mes outils.',
          'My bag is full. I need room to prepare my tools.'
        )
      if (target || unit.path?.length || action)
        return say('Je rassemble de quoi fabriquer mes outils.', 'I’m gathering materials to make my tools.')
      const material =
        missing.length === 2
          ? say('bois et de la pierre', 'wood and stone')
          : missing[0] === 'wood'
            ? say('bois', 'wood')
            : say('la pierre', 'stone')
      return say(
        `Il me faut ${missing.length === 1 && missing[0] === 'stone' ? 'de ' : 'du '}${material} pour fabriquer mes outils.`,
        `I need ${material} to make my tools.`
      )
    }
    return say('Je prépare mes nouveaux outils.', 'I’m making my new tools.')
  }
  if (target && 'type' in target && isGroundResourceType(target.type))
    return target.type === 'GroundWood'
      ? say('Je ramasse des branches.', 'I’m collecting fallen branches.')
      : say('Je ramasse des pierres.', 'I’m collecting loose stones.')
  if (action === 'build')
    return target && 'isBuilt' in target && target.isBuilt
      ? say('Je répare ce bâtiment.', 'I’m repairing this building.')
      : say('Je travaille sur le chantier.', 'I’m working on the construction site.')
  if (actions[action]) return actions[action][english ? 1 : 0]
  if (working && unit.inventory && npcNeedsSupplies(unit)) {
    const tool = unit.inventory?.activeWeapons?.tool
    if (tool && isEquipmentBroken(tool))
      return say(
        'Mon outil est cassé. Il me faut de quoi le remplacer.',
        'My tool broke. I need supplies to replace it.'
      )
    return say('Il me faut du matériel avant de reprendre.', 'I need supplies before I can get back to work.')
  }
  return null
}
