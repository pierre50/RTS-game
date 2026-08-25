import { ACTION_TYPES, PLAYER_TYPES, UNIT_TYPES } from '../../constants'
import { classifyMilitaryUnits, isAliveUnit } from '../../ai/unitGroups'
import { canPlayerStillAct, getGaiaAnimals, isPlayerEliminated } from '../../lib'
import type { DevConsoleContext, DevEntity, DevPlayer } from '../types'

type WorkerSnapshot = {
  villagersOnFood: DevEntity[]
  villagersOnWood: DevEntity[]
  villagersOnGold: DevEntity[]
  villagersOnStone: DevEntity[]
  inactifVillagers: DevEntity[]
  villagersHunting: DevEntity[]
}

type WorkerTargets = {
  maxVillagersOnFood: number
  maxVillagersOnWood: number
  maxVillagersOnGold: number
  maxVillagersOnStone: number
}

export type AiDebugPlayer = DevPlayer & {
  difficulty?: string
  phase?: string
  population?: number
  populationMax?: number
  stepDelay?: number
  maxVillagerPerAge: Record<number, number>
  maxInfantryByAge: Record<number, number>
  maxArcherByAge: Record<number, number>
  maxCavalryByAge: Record<number, number>
  difficultyConfig: { popCapMultiplier: number; defenseRecallThreshold: number; defensePowerRatio: number }
  enemyUnitMemory: { size: number }
  enemyBuildingMemory: { size: number }
  strategy: {
    military: { getGroupCombatPower(units: DevEntity[]): number }
    getEconomicDemand(): Record<string, number>
  }
  economy: {
    getWorkerSnapshot(villagers: DevEntity[]): WorkerSnapshot
    getResourceTargets(villagerCount: number): WorkerTargets
  }
  scout?: DevEntity | null
  getLivingUnitsByType(type: string): DevEntity[]
  getActiveThreats(): Array<{ target: DevEntity }>
  getNow(): number
}

export function isAiDebugPlayer(player: DevPlayer): player is AiDebugPlayer {
  return player.type === PLAYER_TYPES.ai
}

export function ensureDebugOverlay(id: string): HTMLElement {
  let overlay = document.getElementById(id)
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = id
    overlay.classList.add('debug-overlay')
    document.body.appendChild(overlay)
  } else if (!overlay.classList.contains('debug-overlay')) {
    overlay.classList.add('debug-overlay')
  }
  return overlay
}

export function ensurePerfOverlay(context: DevConsoleContext): void {
  const overlay = ensureDebugOverlay('debug-perf')
  const { app, map, players } = context
  const units = players.reduce((sum: number, player) => sum + player.units.length, 0) + getGaiaAnimals(map.gaia).length
  const buildings = players.reduce((sum: number, player) => sum + player.buildings.length, 0)
  const schedulerTasks = context.scheduler?._tasks?.size ?? 0
  const speed = context.app?.ticker?.speed ?? context.scheduler?.timeScale ?? 1
  const perf = context.performance?.snapshot?.()
  const metric = (name: string) => perf?.metrics[`runtime.${name}`] || perf?.metrics[name]
  const pathfinding = metric('pathfinding')
  const aiStep = metric('ai.step') || metric('aiStep')
  const schedulerTick = metric('scheduler.tick')
  const unitMove = metric('unit.move')
  const visibility = metric('visibility.update')
  const camera = metric('camera.visibleCells')
  const viewportFog = metric('fog.viewport')
  const maxFrame = (value: typeof unitMove) => value?.maxFrameExclusiveMs?.toFixed(2) || value?.maxFrameMs?.toFixed(2) || '0.00'
  const maxCalls = (value: typeof unitMove) => value?.maxFrameCalls || 0
  overlay.textContent = [
    `FPS ${Math.round(app?.ticker.FPS ?? 0)}`,
    `Frame interval ${perf?.frames.averageMs.toFixed(2) || '0.00'}ms | p95 ${perf?.frames.p95Ms.toFixed(2) || '0.00'}ms | slow ${perf?.frames.slowCount || 0}`,
    `Units ${units}`,
    `Buildings ${buildings}`,
    `Resources ${map.resources.size}`,
    `Tasks ${schedulerTasks}`,
    `Speed ${speed}x`,
    `Scheduler ${schedulerTick?.averageMs.toFixed(2) || '0.00'}ms avg | ${maxFrame(schedulerTick)}ms frame`,
    `Move ${unitMove?.averageMs.toFixed(3) || '0.000'}ms avg | ${maxFrame(unitMove)}ms frame | ${maxCalls(unitMove)} calls`,
    `Vision ${visibility?.averageMs.toFixed(3) || '0.000'}ms avg | ${maxFrame(visibility)}ms frame`,
    `Camera ${camera?.averageMs.toFixed(3) || '0.000'}ms avg | ${maxFrame(camera)}ms frame`,
    `Path ${pathfinding?.averageMs.toFixed(3) || '0.000'}ms avg | ${maxFrame(pathfinding)}ms frame | ${maxCalls(pathfinding)} calls`,
    `AI step ${aiStep?.averageMs.toFixed(3) || '0.000'}ms avg | ${maxFrame(aiStep)}ms frame`,
    `Fog ${viewportFog?.averageMs.toFixed(3) || '0.000'}ms avg | ${maxFrame(viewportFog)}ms frame`,
  ].join('\n')
}

function getAiDebugLines(aiPlayers: AiDebugPlayer[], targetIndex: number | null = null): string[] | null {
  const targets = targetIndex !== null ? [aiPlayers[targetIndex]].filter(Boolean) : aiPlayers
  if (!targets.length) return null

  const lines: string[] = []

  for (const ai of targets) {
    const idx = aiPlayers.indexOf(ai)
    const villagers = ai.getLivingUnitsByType(UNIT_TYPES.villager)
    const aliveUnits = ai.units.filter(isAliveUnit)
    const { infantry, archers, cavalry } = classifyMilitaryUnits(aliveUnits)
    const military = [...infantry, ...archers, ...cavalry]
    const militaryPower = Math.round(ai.strategy.military.getGroupCombatPower(military))
    const threats = ai.getActiveThreats()
    const enemyUnits = ai.enemyUnitMemory.size
    const enemyBuildings = ai.enemyBuildingMemory.size
    const maxVil = Math.floor(ai.maxVillagerPerAge[ai.age] * ai.difficultyConfig.popCapMultiplier)
    const maxInf = ai.maxInfantryByAge[ai.age]
    const maxArc = ai.maxArcherByAge[ai.age]
    const maxCav = ai.maxCavalryByAge[ai.age]
    const workerSnapshot = ai.economy.getWorkerSnapshot(villagers)
    const workerTargets = ai.economy.getResourceTargets(villagers.length)
    const demand = ai.strategy.getEconomicDemand()
    const builders = villagers.filter(
      (v: DevEntity) => !v.isDead && (v.hitPoints ?? 0) > 0 && v.action === ACTION_TYPES.build
    ).length
    const scoutLabel = ai.scout && !ai.scout.isDead ? `${ai.scout.type}#${ai.scout.name || ai.scout.label}` : 'none'
    const scoutStatus =
      ai.scout && !ai.scout.isDead ? (ai.scout.inactif ? 'idle' : ai.scout.dest ? 'moving' : 'active') : 'none'

    lines.push(`AI [${idx}] ${ai.label} (${ai.difficulty})`)
    lines.push(`Phase ${ai.phase} | Age ${ai.age} | Pop ${ai.population}/${ai.populationMax} | Step ${ai.stepDelay}ms`)
    lines.push(
      `Res W:${ai.wood} F:${ai.food} S:${ai.stone} G:${ai.gold} | Demand W:${demand.wood} F:${demand.food} S:${demand.stone} G:${demand.gold}`
    )
    lines.push(
      `Eco vil ${villagers.length}/${maxVil} | food ${workerSnapshot.villagersOnFood.length}/${workerTargets.maxVillagersOnFood} | wood ${workerSnapshot.villagersOnWood.length}/${workerTargets.maxVillagersOnWood} | gold ${workerSnapshot.villagersOnGold.length}/${workerTargets.maxVillagersOnGold} | stone ${workerSnapshot.villagersOnStone.length}/${workerTargets.maxVillagersOnStone}`
    )
    lines.push(
      `Jobs idle ${workerSnapshot.inactifVillagers.length} | builders ${builders} | hunters ${workerSnapshot.villagersHunting.length} | scout ${scoutLabel} (${scoutStatus})`
    )
    lines.push(
      `Army inf ${infantry.length}/${maxInf} | arc ${archers.length}/${maxArc} | cav ${cavalry.length}/${maxCav}`
    )
    lines.push(
      `Power ${militaryPower} | Defense recall ${ai.difficultyConfig.defenseRecallThreshold} | Ratio ${ai.difficultyConfig.defensePowerRatio}`
    )
    lines.push(
      `Intel mem u:${enemyUnits} b:${enemyBuildings} | known trees:${ai.foundedTrees?.size ?? 0} berries:${ai.foundedBerrybushs?.size ?? 0} hunt:${ai.foundedAnimals?.size ?? 0} gold:${ai.foundedGolds?.size ?? 0} stone:${ai.foundedStones?.size ?? 0}`
    )
    lines.push(`Threats ${threats.length}${threats.length ? ` | ${threats.map(t => t.target.type).join(', ')}` : ''}`)
    lines.push('')
  }

  lines.pop()
  return lines
}

export function ensureAiInfoOverlay(context: DevConsoleContext): void {
  const overlay = ensureDebugOverlay('debug-ai-info')
  const aiPlayers = context.players.filter(isAiDebugPlayer)

  if (!aiPlayers.length) {
    overlay.textContent = 'No AI players on the map'
    return
  }

  const targetIndex = Number.isInteger(context.debugAiInfoTargetIndex) ? context.debugAiInfoTargetIndex : null
  const lines = getAiDebugLines(aiPlayers, targetIndex)
  overlay.textContent = lines?.join('\n') || `No AI player at index ${targetIndex}`
}

export function ensurePlayerStatsOverlay(context: DevConsoleContext): void {
  const overlay = ensureDebugOverlay('debug-player-stats')
  const { players = [], player: me } = context
  const sorted = [...players].sort((a, b) => {
    const activeDiff = Number(canPlayerStillAct(b)) - Number(canPlayerStillAct(a))
    if (activeDiff !== 0) return activeDiff
    return b.units.length + b.buildings.length - (a.units.length + a.buildings.length)
  })

  const formatValue = (current: number | undefined, total: number | undefined): string => {
    const normalizedCurrent = Number.isFinite(current ?? NaN) ? Math.round(current ?? 0) : 0
    const normalizedTotal = Number.isFinite(total ?? NaN) ? Math.round(total ?? normalizedCurrent) : normalizedCurrent
    return `${normalizedCurrent}/${normalizedTotal}`
  }

  overlay.innerHTML = ''
  sorted.forEach((p, rank) => {
    const dead = isPlayerEliminated(p)
    const isMe = p === me
    const label = isMe ? 'You' : (p.color?.charAt(0).toUpperCase() ?? '') + p.color?.slice(1)

    const row = document.createElement('div')
    row.className = 'debug-player-stats-row' + (dead ? ' debug-player-stats-row--dead' : '')
    row.style.color = p.colorHex
    const totalUnits = p.units.length
    const totalBuildings = p.buildings.length
    row.textContent = `${rank + 1}. ${label}: ${totalUnits}/${totalBuildings}`
    overlay.appendChild(row)

    for (const unit of p.units) {
      const unitRow = document.createElement('div')
      unitRow.className = 'debug-player-stats-unit' + (dead ? ' debug-player-stats-row--dead' : '')
      unitRow.style.color = p.colorHex

      const unitLabel = unit.name || `${unit.type}`
      const hp = formatValue(unit.hitPoints, unit.totalHitPoints)
      const energy =
        unit.energy == null || unit.totalEnergy == null
          ? null
          : formatValue(unit.energy, unit.totalEnergy)

      unitRow.textContent = `  ${unitLabel}: HP ${hp}${energy ? ` | EN ${energy}` : ''}`
      overlay.appendChild(unitRow)
    }
  })
}
