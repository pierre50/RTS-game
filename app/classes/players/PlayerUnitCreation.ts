import { getRandomUnitName } from '../../config/name'
import { FADE_DURATION_MS,UNIT_TYPES } from '../../constants'
import { canUpdateMinimap,updateInstanceVisibility,uuidv4 } from '../../lib'
import { definedProperties } from '../../lib/definedProperties'
import { fadeIn } from '../../lib/entities/entityFade'
import { addEntityToMapSpaceContainer } from '../../lib/mapSpaces'
import { resolveUnitIdentity } from '../../lib/units/unitIdentity'
import type { UnitSpawnOptions } from '../unit/Unit'
import { Unit } from '../unit/Unit'
import type { Player } from './Player'

export function createPlayerUnit(
  this: Player,
  options: UnitSpawnOptions,
  creationOptions: { preserveType?: boolean } = {}
) {
  const { context } = this
  const isHeroUnit = !creationOptions.preserveType && this.isPlayed && !this.units.length
  const type = isHeroUnit ? UNIT_TYPES.hero : options.type
  const label = options.label ?? uuidv4()
  const identity = resolveUnitIdentity({ ...options, type, label, owner: this })
  const name =
    options.name ||
    (isHeroUnit ? this.name : getRandomUnitName(identity.civ, identity.gender, () => context.map.random()))
  let unit = new Unit(
    definedProperties({
      ...options,
      label,
      gender: identity.gender,
      assetCiv: identity.civ,
      appearanceVariants: { ...options.appearanceVariants, gender: identity.gender },
      type,
      name,
      controlMode: isHeroUnit ? 'hero' : options.controlMode,
      isChief: options.isChief ?? isHeroUnit,
      owner: this,
    }),
    context
  )
  addEntityToMapSpaceContainer(context.map, unit)
  canUpdateMinimap(unit, context.player) &&
    context.menu.isMiniMapActive?.() !== false &&
    context.menu.updatePlayerMiniMapEvt(this)
  if (!options.suppressCreateSound) {
    updateInstanceVisibility(unit)
    fadeIn(unit, FADE_DURATION_MS)
  }
  this.updatePopulationObjectives()
  return unit
}
