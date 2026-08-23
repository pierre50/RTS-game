import { Assets } from 'pixi.js'
import { DevCommandRegistry } from './DevCommandRegistry'
import { POPULATION_MAX, RESOURCE_NAMES as PLAYER_RESOURCE_NAMES } from '../constants'
import { GAME_SPEED_USAGE, SPEED_VALUES } from '../lib/settings'
import {
  addResources,
  addHeroInventoryEquipment,
  aiInfo,
  applyAllTechnologies,
  applyTechnology,
  forceNextDay,
  healAll,
  highlightInstances,
  killEntities,
  killResources,
  performanceReport,
  setAge,
  setCiv,
  setGameSpeed,
  toggleHeroInvincible,
  setPopMax,
  setWeatherPhase,
  showTimeState,
  spawnAnimal,
  spawnBuilding,
  spawnUnits,
  TRIBAL_BUILDING_COMPLETIONS,
  toggleEntityBars,
  toggleCoordsDebug,
  toggleFog,
  toggleFreeCamera,
  toggleGridDebug,
  toggleHeroAimDebug,
  toggleInstantMode,
  togglePathDebug,
  togglePerfDebug,
  togglePlayerStatsDebug,
  toggleResourcesVisibility,
  toggleSolidDebug,
  toggleTerrainFrameDebug,
  teleportHeroToPortal,
  toggleVisionDebug,
  WEATHER_PHASES,
} from './DevCommandActions'
import { toggleHeroCollisionDebug } from './actions/debug'
import { getAllHeroInventoryItems } from './actions/heroInventory'
import type { DevEntity, DevPlayer } from './types'

const RESOURCE_NAMES = ['all', ...PLAYER_RESOURCE_NAMES]

export function createDevCommands(): DevCommandRegistry {
  const registry = new DevCommandRegistry()

  registry.register({
    name: 'help',
    aliases: ['?'],
    describe: 'Show available commands',
    run: ([cmd], { commands }) => {
      if (cmd) {
        const c = commands.get(cmd)
        if (!c) return { ok: false, message: `Unknown command: ${cmd}` }
        const lines = [c.usage || c.name]
        if (c.describe) lines.push(c.describe)
        if (c.aliases?.length) lines.push(`Aliases: ${c.aliases.join(', ')}`)
        return { ok: true, message: lines.join('\n') }
      }
      const lines = commands.all().map(c => `${(c.usage || c.name).padEnd(32)} ${c.describe || ''}`)
      return { ok: true, message: lines.join('\n') }
    },
  })

  registry.register({
    name: 'list',
    aliases: ['ls'],
    usage: 'list <units|buildings|techs|resources|inventories>',
    describe: 'List available items for a category',
    complete: () => ['units', 'buildings', 'techs', 'resources', 'inventories'],
    run: ([category], { player }) => {
      switch (category?.toLowerCase()) {
        case 'units':
          return { ok: true, message: Object.keys(player.config.units).join('  ') }
        case 'buildings':
          return { ok: true, message: Object.keys(player.config.buildings).join('  ') }
        case 'techs':
          return { ok: true, message: Object.keys(player.techs).join('  ') }
        case 'resources':
          return { ok: true, message: RESOURCE_NAMES.join('  ') }
        case 'inventories':
        case 'inventory':
          return { ok: true, message: getAllHeroInventoryItems().join('  ') }
        default:
          return { ok: false, message: 'Usage: list <units|buildings|techs|resources|inventories>' }
      }
    },
  })

  registry.register({
    name: 'spawn',
    aliases: ['unit'],
    usage: 'spawn <unit> [count] [playerIndex]',
    describe: 'Spawn units near cursor',
    complete: (_args, { player }) => Object.keys(player?.config?.units || {}),
    run: ([type, count, playerIndex], context) => {
      if (!type) return { ok: false, message: 'Usage: spawn <unit> [count] [playerIndex]' }
      return spawnUnits(context, type, count, playerIndex)
    },
  })

  registry.register({
    name: 'bandit-raid',
    aliases: ['raid', 'bandits'],
    usage: 'bandit-raid',
    describe: 'Trigger a bandit tribute raid near the portal',
    run: (_args, context) => {
      const started = context.tributeRaids?.triggerRaid({ source: 'dev-console' }) ?? false
      return started
        ? { ok: true, message: 'Bandit raid triggered' }
        : { ok: false, message: 'Unable to trigger bandit raid' }
    },
  })

  registry.register({
    name: 'faction-raid',
    aliases: ['frraid', 'envoy'],
    usage: 'faction-raid',
    describe: 'Trigger a hostile known faction tribute raid near the portal',
    run: (_args, context) => {
      const started = context.tributeRaids?.triggerFactionRaid({ source: 'dev-console', ignoreBaseWorld: true }) ?? false
      return started
        ? { ok: true, message: 'Faction raid triggered' }
        : { ok: false, message: 'Unable to trigger faction raid' }
    },
  })

  registry.register({
    name: 'animal',
    usage: 'animal <type> [count]',
    describe: 'Spawn wild animals near cursor',
    complete: () => Object.keys((Assets.cache.get('config') as { animals?: Record<string, unknown> })?.animals || {}),
    run: ([type, count], context) => {
      if (!type) return { ok: false, message: 'Usage: animal <type> [count]' }
      return spawnAnimal(context, type, count)
    },
  })

  registry.register({
    name: 'building',
    aliases: ['build'],
    usage: 'building <type> [playerIndex]',
    describe: 'Spawn a building near cursor',
    complete: (_args, { player }) => [...Object.keys(player?.config?.buildings || {}), ...TRIBAL_BUILDING_COMPLETIONS],
    run: ([type, playerIndex], context) => {
      if (!type) return { ok: false, message: 'Usage: building <type> [playerIndex]' }
      return spawnBuilding(context, type, playerIndex)
    },
  })

  registry.register({
    name: 'resources',
    aliases: ['res'],
    usage: `resources [${RESOURCE_NAMES.join('|')}] [amount]`,
    describe: 'Add resources to player',
    complete: () => RESOURCE_NAMES,
    run: ([resource = 'all', amount = 1000], context) => {
      const parsedAmount = Number(amount)
      if (!Number.isFinite(parsedAmount)) return { ok: false, message: 'Amount must be a number' }
      const message = addResources(context.player, resource.toLowerCase(), parsedAmount)
      context.menu.updateTopbar()
      return { ok: !message.startsWith('Unknown'), message }
    },
  })

  registry.register({
    name: 'hero-inventory',
    aliases: ['hinv', 'hero-items'],
    usage: 'hero-inventory [item|all] [quantity]',
    describe: 'Add assignable/equippable hero items to the hero bag',
    complete: () => ['all', ...getAllHeroInventoryItems()],
    run: ([item = 'all', quantity], context) => addHeroInventoryEquipment(context, item, quantity),
  })

  registry.register({
    name: 'tech',
    aliases: ['technology'],
    usage: 'tech <technology|all>',
    describe: 'Unlock a technology, or all technologies at once',
    complete: (_args, { player }) => ['all', ...Object.keys(player?.techs || {})],
    run: ([type], context) => {
      if (!type) return { ok: false, message: 'Usage: tech <technology|all>' }
      if (type === 'all') return applyAllTechnologies(context)
      return applyTechnology(context, type)
    },
  })

  registry.register({
    name: 'age',
    usage: 'age <0-3>',
    describe: 'Set player age',
    complete: () => ['0', '1', '2', '3'],
    run: ([value], context) => setAge(context, value),
  })

  registry.register({
    name: 'nextday',
    aliases: ['daynext'],
    usage: 'nextday',
    describe: 'Advance the day/night cycle to the next day',
    run: (_args, context) => forceNextDay(context),
  })

  registry.register({
    name: 'time',
    aliases: ['clock'],
    usage: 'time',
    describe: 'Print day/night debug state',
    run: (_args, context) => showTimeState(context),
  })

  registry.register({
    name: 'weather',
    usage: `weather [${WEATHER_PHASES.join('|')}]`,
    describe: 'Print weather state or force a weather phase',
    complete: () => WEATHER_PHASES,
    run: ([phase], context) => setWeatherPhase(context, phase),
  })

  registry.register({
    name: 'civ',
    usage: 'civ <name>',
    describe: 'Set player civilization',
    run: ([value], context) => setCiv(context, value),
  })

  registry.register({
    name: 'kill',
    usage: 'kill [enemies|all]',
    describe: 'Kill enemies (default) or all your entities',
    complete: () => ['enemies', 'all'],
    run: ([target = 'enemies'], context) => killEntities(context, target),
  })

  registry.register({
    name: 'heal',
    describe: 'Restore all your units and buildings to full HP',
    run: (_args, context) => healAll(context),
  })

  registry.register({
    name: 'hero-invincible',
    aliases: ['hinvincible', 'invincible', 'hero-invinsible'],
    usage: 'hero-invincible [on|off]',
    describe: 'Toggle hero debug invincibility while still receiving hits',
    complete: () => ['on', 'off'],
    run: ([value], context) => toggleHeroInvincible(context, value),
  })

  registry.register({
    name: 'instant',
    usage: 'instant [on|off]',
    describe: 'Toggle instant build/train/tech',
    complete: () => ['on', 'off'],
    run: ([value], context) => toggleInstantMode(context, value),
  })

  registry.register({
    name: 'popmax',
    usage: 'popmax [amount]',
    describe: `Set player max population (default: ${POPULATION_MAX})`,
    complete: () => [String(POPULATION_MAX)],
    run: ([value], context) => setPopMax(context, value),
  })

  registry.register({
    name: 'fog',
    usage: 'fog [on|off]',
    describe: 'Toggle fog of war',
    complete: () => ['on', 'off'],
    run: ([value], context) => toggleFog(context, value),
  })

  registry.register({
    name: 'resources-visible',
    aliases: ['resvis'],
    usage: 'resources-visible [on|off]',
    describe: 'Toggle map resources visibility',
    complete: () => ['on', 'off'],
    run: ([value], context) => toggleResourcesVisibility(context, value),
  })

  registry.register({
    name: 'portal',
    aliases: ['tpportal'],
    usage: 'portal',
    describe: 'Teleport the hero next to the current world portal',
    run: (_args, context) => teleportHeroToPortal(context),
  })

  registry.register({
    name: 'solid',
    usage: 'solid [on|off]',
    describe: 'Toggle solid-cell debug overlay',
    complete: () => ['on', 'off'],
    run: ([value], context) => toggleSolidDebug(context, value),
  })

  registry.register({
    name: 'path',
    usage: 'path [on|off]',
    describe: 'Toggle unit path debug overlay',
    complete: () => ['on', 'off'],
    run: ([value], context) => togglePathDebug(context, value),
  })

  registry.register({
    name: 'vision',
    usage: 'vision [on|off]',
    describe: 'Toggle visible/viewed cells debug overlay',
    complete: () => ['on', 'off'],
    run: ([value], context) => toggleVisionDebug(context, value),
  })

  registry.register({
    name: 'grid',
    usage: 'grid [on|off]',
    describe: 'Toggle cell grid debug overlay',
    complete: () => ['on', 'off'],
    run: ([value], context) => toggleGridDebug(context, value),
  })

  registry.register({
    name: 'coords',
    usage: 'coords [on|off]',
    describe: 'Toggle cell coordinate labels',
    complete: () => ['on', 'off'],
    run: ([value], context) => toggleCoordsDebug(context, value),
  })

  registry.register({
    name: 'hero-collision',
    aliases: ['hcol'],
    usage: 'hero-collision [on|off]',
    describe: 'Toggle hero-controlled unit collision shape debug overlay',
    complete: () => ['on', 'off'],
    run: ([value], context) => toggleHeroCollisionDebug(context, value),
  })

  registry.register({
    name: 'hero-aim',
    aliases: ['haim'],
    usage: 'hero-aim [on|off]',
    describe: 'Toggle hero mouse aim direction-sector debug overlay',
    complete: () => ['on', 'off'],
    run: ([value], context) => toggleHeroAimDebug(context, value),
  })

  registry.register({
    name: 'free-camera',
    aliases: ['fcam'],
    usage: 'free-camera [on|off]',
    describe: 'Toggle hero free camera (arrow keys pan, off returns to hero)',
    complete: () => ['on', 'off'],
    run: ([value], context) => toggleFreeCamera(context, value),
  })

  registry.register({
    name: 'perf',
    usage: 'perf [on|off]',
    describe: 'Toggle performance debug overlay',
    complete: () => ['on', 'off'],
    run: ([value], context) => togglePerfDebug(context, value),
  })

  registry.register({
    name: 'perf-report',
    aliases: ['perfr'],
    usage: 'perf-report [reset]',
    describe: 'Print or reset frame, pathfinding, AI and fog timings',
    complete: () => ['reset'],
    run: ([value], context) => performanceReport(context, value),
  })

  registry.register({
    name: 'player-stats',
    aliases: ['pstats'],
    usage: 'player-stats [on|off]',
    describe: 'Toggle player stats debug overlay',
    complete: () => ['on', 'off'],
    run: ([value], context) => togglePlayerStatsDebug(context, value),
  })

  registry.register({
    name: 'ai-info',
    aliases: ['aii'],
    usage: 'ai-info [on|off|index]',
    describe: 'Toggle a live AI debug overlay for all AI players or one by index',
    complete: (_args, context) => [
      'on',
      'off',
      ...context.players.filter((p: DevPlayer) => p.type === 'ai').map((_, index: number) => `${index}`),
    ],
    run: ([value], context) => aiInfo(context, value),
  })

  registry.register({
    name: 'speed',
    usage: GAME_SPEED_USAGE,
    describe: 'Set simulation speed',
    complete: () => SPEED_VALUES,
    run: ([value], context) => setGameSpeed(context, value),
  })

  registry.register({
    name: 'terrain-frame',
    aliases: ['tframe'],
    usage: 'terrain-frame [on|off]',
    describe: 'Show the terrain sprite sheet/frame under the cursor',
    complete: () => ['on', 'off'],
    run: ([value], context) => toggleTerrainFrameDebug(context, value),
  })

  registry.register({
    name: 'highlight',
    usage: 'highlight <units|buildings|resources|enemies> [type]',
    describe: 'Blink matching instances',
    complete: () => ['units', 'buildings', 'resources', 'enemies'],
    run: ([category, type], context) => highlightInstances(context, category, type),
  })

  registry.register({
    name: 'kill-resources',
    aliases: ['killres'],
    usage: 'kill-resources [type|all]',
    describe: 'Remove resources from the map',
    complete: (_args, { map }) => ['all', ...new Set([...map.resources].map((resource: DevEntity) => resource.type))],
    run: ([type], context) => killResources(context, type),
  })

  registry.register({
    name: 'entity-bars',
    aliases: ['ebars', '9a', '9A'],
    usage: 'entity-bars [on|off]',
    describe: 'Toggle health and energy bars on visible units, buildings and animals',
    complete: () => ['on', 'off'],
    run: (_args, context) => toggleEntityBars(context, _args[0] || ''),
  })

  return registry
}
