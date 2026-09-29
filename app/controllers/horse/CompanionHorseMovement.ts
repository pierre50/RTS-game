import { SOUND_CUES } from '../../constants'
import { playAudibleSoundCue } from '../../lib'
import { t } from '../../lib/lang'
import { getEntityCell, getMapSpace, moveEntityToMapSpace } from '../../lib/mapSpaces'
import type { UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { HeroCompanionHorseController } from '../HeroCompanionHorseController'
import { type CompanionHorse } from '../HeroControllerSupport'
type Host = Pick<HeroCompanionHorseController, 'controls'>
export function moveCompanionHorseToCell(
  this: Host,
  getHeroUnit: () => UnitEntity | null,
  horse: CompanionHorse,
  cell: RuntimeCell
): void {
  const map = getHeroUnit()?.context?.map
  const oldI = horse.i
  const oldJ = horse.j
  const targetSpace = map ? getMapSpace(map, cell.spaceId) : null
  if (map && targetSpace) {
    moveEntityToMapSpace(map, horse, targetSpace, cell)
    return
  }
  const currentCell = horse.currentCell ?? (map ? getEntityCell(horse, map) : null)
  if (currentCell?.has === horse) {
    currentCell.has = null
    currentCell.solid = false
  }
  horse.i = cell.i
  horse.j = cell.j
  horse.x = cell.x
  horse.y = cell.y
  horse.z = cell.z
  horse.currentCell = cell
  cell.place(horse)
  cell.solid = true
  map?.updateInstanceBucket?.(horse, oldI, oldJ)
}
export function sendCompanionHorseToHero(
  this: Host,
  getHeroUnit: () => UnitEntity | null,
  horse: CompanionHorse,
  unit: UnitEntity
): void {
  const cell = getEntityCell(unit, unit.context?.map)
  const destination = cell
    ? { i: cell.i, j: cell.j, x: cell.x, y: cell.y, z: cell.z }
    : { i: unit.i, j: unit.j, x: unit.x, y: unit.y, z: unit.z ?? 0 }
  horse.sendTo?.(destination, null, { forceRepath: true })
  playAudibleSoundCue(horse, SOUND_CUES.unit.horseMoving, { profile: 'voice' })
  this.controls.context.menu?.showMessage(t('companionHorseComing'), 'success')
}
