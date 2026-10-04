import { GAME_SPEED_USAGE, isGameSpeedPreset } from '../../lib/audio/settings'
import { BANDIT_FACTION_ID } from '../../lib/campaign/playerRoster'
import type { CommandResult } from '../DevCommandRegistry'
import type { DevConsoleContext, DevPlayer } from '../types'
import { normalizeToggle } from './shared'
import type { FactionSave } from '../../types/save'

type DevPlayerState = DevPlayer & {
  enemyPlayers?: () => DevPlayerState[]
}

function formatFactionRelation(faction: FactionSave): string {
  return `${faction.relationState} (${Math.round(faction.relationScore)})`
}

function formatKnownWorlds(faction: FactionSave, currentWorldId: string | null | undefined): string {
  const knownWorldIds = faction.knownWorldIds ?? []
  if (!knownWorldIds.length) return 'undiscovered'
  return knownWorldIds.map(worldId => (worldId === currentWorldId ? `${worldId}*` : worldId)).join(',')
}

export function listLocalPlayers(context: DevConsoleContext): CommandResult {
  const lines = context.players.map((player, index) => {
    const relation = context.player === player ? 'self' : context.player.isEnemy?.(player) ? 'hostile' : 'neutral'
    const name = player.name || player.label || `player-${index}`
    return `${index}. ${name} | civ=${player.civ ?? '-'} | color=${player.color ?? '-'} | relation=${relation} | local`
  })
  return { ok: true, message: lines.length ? lines.join('\n') : 'No local players found' }
}

export function listFactions(context: DevConsoleContext): CommandResult {
  const factions = context.getCampaignFactions?.()
  if (!factions || !Object.keys(factions).length) return { ok: true, message: 'No campaign factions found' }

  const currentWorldId = context.getCurrentWorldId?.() ?? null
  const lines = Object.values(factions)
    .sort((a, b) => {
      if (a.id === BANDIT_FACTION_ID) return 1
      if (b.id === BANDIT_FACTION_ID) return -1
      return (a.civilization || a.name).localeCompare(b.civilization || b.name)
    })
    .map(faction => {
      const localPlayers = context.players.flatMap((player, index) =>
        player.factionId === faction.id ? [{ player, index }] : []
      )
      const presence = localPlayers.length
        ? localPlayers
            .map(
              ({ player, index }) =>
                `playerIndex=${index} units=${player.units.length} buildings=${player.buildings.length}`
            )
            .join('; ')
        : 'not local'
      return [
        faction.name,
        `id=${faction.id}`,
        `civ=${faction.civilization ?? '-'}`,
        `color=${faction.color ?? '-'}`,
        `relation=${formatFactionRelation(faction)}`,
        `worlds=${formatKnownWorlds(faction, currentWorldId)}`,
        presence,
      ].join(' | ')
    })

  return { ok: true, message: lines.length ? lines.join('\n') : 'No campaign factions found' }
}

export function killEntities(context: DevConsoleContext, target = 'enemies'): CommandResult {
  const player = context.player as DevPlayerState

  if (target === 'enemies') {
    const enemies = player.enemyPlayers?.() ?? []
    let count = 0
    enemies.forEach(enemy => {
      count += enemy.units.length + enemy.buildings.length
      ;[...enemy.units].forEach(u => u.die?.())
      ;[...enemy.buildings].forEach(b => b.die?.())
    })
    if (!count) return { ok: false, message: 'No enemies found' }
    return { ok: true, message: `Killed ${count} enemy entities` }
  }

  if (target === 'all') {
    const count = player.units.length + player.buildings.length
    ;[...player.units].forEach(u => u.die?.())
    ;[...player.buildings].forEach(b => b.die?.())
    return { ok: true, message: `Killed ${count} of your entities` }
  }

  return { ok: false, message: 'Usage: kill [enemies|all]' }
}

export function healAll(context: DevConsoleContext): CommandResult {
  const { player } = context
  ;[...player.units].forEach(u => {
    u.hitPoints = u.totalHitPoints
  })
  ;[...player.buildings].forEach(b => {
    b.hitPoints = b.totalHitPoints
  })
  const count = player.units.length + player.buildings.length
  return { ok: true, message: `Healed ${count} entities to full HP` }
}

export function toggleHeroInvincible(context: DevConsoleContext, value?: string): CommandResult {
  const hero = context.controls?.heroUnit
  if (!hero || hero.isDead || hero.isDestroyed) return { ok: false, message: 'No active hero found' }
  hero.devInvincible = normalizeToggle(value, Boolean(hero.devInvincible))
  return { ok: true, message: `Hero invincible: ${hero.devInvincible ? 'on' : 'off'}` }
}

export function setGameSpeed(context: DevConsoleContext, value: number | string = 1): CommandResult {
  const speed = Number(value)
  if (!Number.isFinite(speed) || !isGameSpeedPreset(speed)) {
    return { ok: false, message: `Usage: ${GAME_SPEED_USAGE}` }
  }
  if (context.app?.ticker) context.app.ticker.speed = speed
  if (context.scheduler) {
    context.scheduler.timeScale = speed
  }
  return { ok: true, message: `Speed: ${speed}x` }
}

export function toggleInstantMode(context: DevConsoleContext, value: string): CommandResult {
  const { map } = context
  const enabled = value === 'on' ? true : value === 'off' ? false : !map.instantMode
  map.instantMode = enabled
  return { ok: true, message: `Instant build/train: ${enabled ? 'on' : 'off'}` }
}
