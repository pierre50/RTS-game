import { countResidentHouseholds } from '../../../lib/housing/households'
import { isStaticSettlement } from '../../../config/settlementProfiles'
import { createConstructionMaterials } from '../../../lib/economy/constructionMaterials'
import { generatedBuildingMirrored } from '../../../lib/buildings/generatedBuildingOrientation'
import { AI_DIFFICULTIES, MAX_BUILDINGS } from '../../../ai/config'
import { BUILDING_TYPES } from '../../../constants'
import { villageBuildingNeeds, villagePhase } from '../../../ai/AIDevelopmentPolicy'
import { getBuildingConfigForLevel } from '../../../lib/buildings/buildingLevel'
import { isValidCondition } from '../../../lib/combat/configConditions'
import { isFootprintBuildable } from '../../../lib/grid/buildingFootprint'
import { findStoragePitSite, needsStoragePit } from '../../../lib/grid/storagePitPlacement'
import { isLiving, OfflineWorldSpatial, type OfflineTerrainCell } from './OfflineWorldSpatial'
import { isOfflineWorker, stopOfflineTask, type OfflineWorkRules } from './OfflineWorldWork'
import type { SaveEntityState, SerializedSave } from '../../../types/save'

export function restoreOfflineBuilders(state: SerializedSave): void {
  for (const player of state.players) {
    if (isStaticSettlement(player)) continue
    if (player.type !== 'AI' || player.buildings?.some(b => isLiving(b) && !b.isBuilt)) continue
    for (const unit of player.units ?? []) {
      if (
        (!unit.offlineBuilderJob && unit.work !== 'builder' && unit.autonomousJob !== 'construction') ||
        !isOfflineWorker(unit)
      )
        continue
      stopOfflineTask(unit)
      unit.autonomousJob =
        unit.offlineBuilderJob ?? (['farmer', 'forager', 'hunter'].includes(unit.previousWork ?? '') ? 'food' : 'wood')
      unit.work = null
      delete unit.offlineBuilderJob
      delete unit.offlineWork
    }
  }
}

function findVillageBuildingSite(
  anchor: SaveEntityState,
  size: number,
  spatial: OfflineWorldSpatial,
  worker: SaveEntityState
) {
  // Keep a free ring around the full footprint for entrances and walking space.
  const radius = Math.ceil(size / 2) + 1
  for (let ring = 4; ring <= 20; ring++) {
    for (let di = -ring; di <= ring; di++)
      for (let dj = -ring; dj <= ring; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue
        const point = { i: anchor.i + di, j: anchor.j + dj }
        if (!spatial.reachable(worker, point)) continue
        if (
          isFootprintBuildable(
            point,
            radius,
            p => spatial.naturalCell(p),
            p => spatial.elevation(p)
          )
        )
          return point
      }
  }
  return null
}

export function planOfflineBuildings(
  state: SerializedSave,
  day: number,
  terrain: (OfflineTerrainCell | null | undefined)[][],
  rules: OfflineWorkRules,
  spatial = new OfflineWorldSpatial(
    terrain,
    state,
    (building, index) => Number(rules.buildingConfig(index, building.type).size) || 1
  )
): void {
  restoreOfflineBuilders(state)
  state.players.forEach((player, index) => {
    if (isStaticSettlement(player)) return
    if (player.type !== 'AI' || player.offlineBuildingPlanDay === day) return
    player.offlineBuildingPlanDay = day
    player.offlineBuildingDecision = `Day ${day}: no new project needed`
    const workers = (player.units ?? []).filter(isOfflineWorker)
    if (workers.length < 1) {
      player.offlineBuildingDecision = `Day ${day}: not enough workers`
      return
    }
    const buildings = (player.buildings ?? []).filter(isLiving)
    const center = buildings.find(b => b.type === BUILDING_TYPES.townCenter && b.isBuilt) ?? workers[0]
    let project = buildings.find(b => !b.isBuilt)
    if (!project) {
      const difficulty =
        AI_DIFFICULTIES[state.config?.difficulty as keyof typeof AI_DIFFICULTIES] ?? AI_DIFFICULTIES.medium
      player.aiState ??= {}
      player.aiState.phase = villagePhase(
        player.aiState.phase ?? 'economy',
        workers.length,
        difficulty.econToMilVillagers
      )
      const needs = villageBuildingNeeds({
        population: player.population ?? 0,
        residentHouseholds: countResidentHouseholds(player),
        populationMax: player.populationMax ?? 0,

        phase: player.aiState.phase,
        desiredBarracks: 1,
        buildings,
        storagePitNeeded: needsStoragePit(state.resources, buildings),
      })
      const priorities = buildings.some(b => b.type === BUILDING_TYPES.townCenter && b.isBuilt)
        ? Object.keys(needs).filter(type => needs[type])
        : [BUILDING_TYPES.townCenter]
      const caps = MAX_BUILDINGS as Record<string, number>
      for (const type of priorities) {
        if (type !== BUILDING_TYPES.house && buildings.filter(b => b.type === type).length >= (caps[type] ?? 0))
          continue
        const config = getBuildingConfigForLevel(rules.buildingConfig(index, type), 0)
        if (
          !config.cost ||
          !Object.keys(config.cost).length ||
          !(Number(config.totalHitPoints) > 0) ||
          !(Number(config.constructionTime) > 0)
        )
          continue
        const eligibility = {
          ...player,

          hasBuilt: player.hasBuilt ?? [],
        }
        if (
          !(config.conditions ?? []).every(
            condition => condition.key in eligibility && isValidCondition(condition, eligibility)
          )
        )
          continue
        const size = Number(config.size) || 0
        const position =
          type === BUILDING_TYPES.storagePit
            ? findStoragePitSite({
                home: center,
                size,
                resources: state.resources,
                buildings,
                terrainAt: point => terrain[point.i]?.[point.j],
                isFree: (point, forBuilding) => spatial.storageSiteFree(point, forBuilding),
              })
            : findVillageBuildingSite(center, size, spatial, workers[0])
        if (!position) {
          player.offlineBuildingDecision = `Day ${day}: no safe space for ${type}`
          continue
        }
        project = {
          ...position,
          type,
          size,
          label: `offline-building:${state.world?.worldRegionId ?? 'world'}:${player.label ?? index}:${day}:${type}`,
          buildingLevel: 0,
          placementMirrored: generatedBuildingMirrored(type, position, player.civ ?? index, p => spatial.available(p)),
          isBuilt: false,
          constructionMaterials: createConstructionMaterials(config.cost),
          hitPoints: 1,
          totalHitPoints: Number(config.totalHitPoints),
        }
        player.buildings ??= []
        player.buildings.push(project)
        const radius = Math.ceil(size / 2)
        for (let i = position.i - radius; i <= position.i + radius; i++)
          for (let j = position.j - radius; j <= position.j + radius; j++) spatial.reserve(project, { i, j })
        spatial.protectVillageAccess(center, player.buildings)
        break
      }
    }
    if (project) player.offlineBuildingDecision = `Day ${day}: building ${project.type} (${project.label})`
  })
}
