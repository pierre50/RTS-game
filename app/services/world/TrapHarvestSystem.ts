import { BUILDING_TYPES, FADE_DURATION_MS, SHEET_TYPES } from '../../constants'
import { updateInstanceVisibility } from '../../lib'
import { addHeroInventoryItem } from '../../lib/equipment/equipmentLoot'
import { fadeOut } from '../../lib/entities/entityFade'
import { clearEntityOverheadIndicator, setEntityOverheadIndicator } from '../../lib/entities/overheadIndicator'
import { instanceIsInActiveOrTeamSight } from '../../lib/grid/visibility'
import { getEntityMapSpace } from '../../lib/mapSpaces'
import type { AnimalEntity, BuildingEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { GameContextLike, VisionChangeEvent } from '../../types/context'
import type { DailyWorldEvent, DailyWorldEventHandler } from '../DailyWorldEventTypes'

const TRAP_PREY_TYPES = ['Hare', 'Fox', 'BlackGrouse'] as const

type TrapPreyType = (typeof TRAP_PREY_TYPES)[number]

type GaiaWithAnimals = NonNullable<GameContextLike['map']['gaia']> & {
  createAnimal?: (options: {
    currentSheet?: string
    hitPoints?: number
    i: number
    isDead?: boolean
    j: number
    spaceId?: string
    trapPrey?: boolean
    type: TrapPreyType
  }) => AnimalEntity
}

type RuntimeTrapBuilding = BuildingEntity & { context: GameContextLike }

type TrapSightViewer = {
  family?: string
  isDead?: boolean
  isDestroyed?: boolean
  label?: string
}

function isTrapPreyType(type: string | null | undefined): type is TrapPreyType {
  return Boolean(type && (TRAP_PREY_TYPES as readonly string[]).includes(type))
}

function isTrap(building: BuildingEntity | null | undefined): building is RuntimeTrapBuilding {
  return Boolean(
    building &&
      building.context &&
      building.type === BUILDING_TYPES.trap &&
      building.isBuilt &&
      !building.isDead &&
      !building.isDestroyed
  )
}

function isTrapCell(building: RuntimeTrapBuilding, cell: RuntimeCell | null | undefined): cell is RuntimeCell {
  return Boolean(
    cell &&
      !cell.border &&
      cell.category !== 'Water' &&
      !cell.waterBorder &&
      cell.has === building &&
      cell.solid === true
  )
}

function isTrapObservedBySight(building: RuntimeTrapBuilding, context: GameContextLike): boolean {
  const { players } = context
  for (const player of players) {
    const viewers = player.views?.getViewers?.(building.i, building.j)
    if (!viewers) continue
    for (const viewerRef of viewers) {
      if (typeof viewerRef === 'string') continue
      const viewer = viewerRef as TrapSightViewer
      if (viewer.label === building.label || viewer.isDead || viewer.isDestroyed) continue
      if (viewer.family === 'unit' || viewer.family === 'building') return true
    }
  }
  return false
}

function getTrapCell(building: RuntimeTrapBuilding): RuntimeCell | null {
  const space = getEntityMapSpace(building, building.context?.map)
  const grid = space?.grid ?? building.context?.map?.grid
  return grid?.[building.i]?.[building.j] ?? null
}

function removeTrapBuilding(building: RuntimeTrapBuilding, cell: RuntimeCell): void {
  const { map, menu, player } = building.context
  map.removeFromInstanceBucket?.(building)
  const index = building.owner?.buildings?.indexOf(building) ?? -1
  if (index >= 0) building.owner?.buildings?.splice(index, 1)
  if (building.selected && player?.selectedBuilding === building) player.unselectAll?.()
  if (cell.has === building) {
    cell.has = null
    cell.solid = false
    cell.updateVisible()
  }
  canUpdateTrapMinimap(building, menu, player)
  building.clear?.()
}

function canUpdateTrapMinimap(
  building: BuildingEntity,
  menu: GameContextLike['menu'],
  player: GameContextLike['player']
): void {
  if (menu.isMiniMapActive?.() === false) return
  if (building.owner) menu.updatePlayerMiniMapEvt?.(building.owner)
  menu.updatePlayerMiniMapEvt?.(player)
}

function spawnContainedAnimal(
  building: RuntimeTrapBuilding,
  cell: RuntimeCell,
  type: string | null | undefined
): AnimalEntity | null {
  if (!isTrapPreyType(type)) return null
  const gaia = building.context.map.gaia as GaiaWithAnimals | null | undefined
  if (!gaia?.createAnimal) return null
  const animal = gaia.createAnimal({
    currentSheet: SHEET_TYPES.corpse,
    hitPoints: 0,
    i: cell.i,
    isDead: true,
    j: cell.j,
    spaceId: cell.spaceId,
    trapPrey: true,
    type,
  })
  updateInstanceVisibility(animal)
  return animal
}

export function recoverTrapBuilding(hero: GameContextLike['controls']['heroUnit'], building: BuildingEntity): boolean {
  if (!hero || !isTrap(building)) return false
  const cell = getTrapCell(building)
  if (!isTrapCell(building, cell)) return false
  addHeroInventoryItem(hero, 'trap')
  const containedAnimalType = building.containedAnimalType
  building.containedAnimalType = null
  clearEntityOverheadIndicator(building, { fade: false })
  fadeOut(building, FADE_DURATION_MS, () => {
    removeTrapBuilding(building, cell)
    spawnContainedAnimal(building, cell, containedAnimalType)
  })
  return true
}

function pickPreyType(context: GameContextLike): TrapPreyType {
  return (
    context.map.randomItem?.([...TRAP_PREY_TYPES]) ??
    TRAP_PREY_TYPES[Math.floor(context.map.random() * TRAP_PREY_TYPES.length)]
  )
}

export class TrapHarvestSystem implements DailyWorldEventHandler {
  context: GameContextLike
  unsubscribeVisionChange: (() => void) | null

  constructor(context: GameContextLike) {
    this.context = context
    this.unsubscribeVisionChange = context.onVisionChange?.(event => this.handleVisionChange(event)) ?? null
    this.syncTrapIndicators()
  }

  handleDailyWorldEvent(_event: DailyWorldEvent): void {
    this.fillTraps()
  }

  fillTraps(): void {
    const { players, menu } = this.context

    let filled = false
    for (const player of players) {
      for (const building of player.buildings ?? []) {
        if (!isTrap(building)) continue
        if (building.containedAnimalType) continue
        if (isTrapObservedBySight(building, this.context)) continue
        building.containedAnimalType = pickPreyType(this.context)
        this.syncTrapIndicator(building)
        filled = true
      }
    }

    if (filled && menu.isMiniMapActive?.() !== false) {
      menu.updateResourcesMiniMap?.()
      menu.updatePlayerMiniMapEvt?.(this.context.player)
    }
  }

  syncTrapIndicator(building: RuntimeTrapBuilding): void {
    if (
      building.containedAnimalType &&
      instanceIsInActiveOrTeamSight(building, this.context.player, this.context.players)
    ) {
      setEntityOverheadIndicator(building, 'question')
    } else {
      clearEntityOverheadIndicator(building, { fade: false })
    }
  }

  handleVisionChange(event: VisionChangeEvent): void {
    const cell = this.context.map.grid?.[event.i]?.[event.j]
    const building = cell?.has
    if (!isTrap(building)) return
    this.syncTrapIndicator(building)
  }

  syncTrapIndicators(): void {
    for (const player of this.context.players) {
      for (const building of player.buildings ?? []) {
        if (!isTrap(building)) continue
        this.syncTrapIndicator(building)
      }
    }
  }

  destroy(): void {
    this.unsubscribeVisionChange?.()
    this.unsubscribeVisionChange = null
  }
}
