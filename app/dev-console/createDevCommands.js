import { DevCommandRegistry } from './DevCommandRegistry'
import { POPULATION_MAX } from '../constants'
import { GAME_SPEED_USAGE, SPEED_VALUES } from '../lib/settings'
import {
  addResources,
  aiInfo,
  applyTechnology,
  healAll,
  highlightInstances,
  killResources,
  killEntities,
  toggleInstantMode,
  setGameSpeed,
  setPopMax,
  setAge,
  setCiv,
  spawnBuilding,
  spawnUnits,
  toggleAiDebug,
  toggleFog,
  toggleCoordsDebug,
  toggleGridDebug,
  togglePathDebug,
  togglePerfDebug,
  toggleResourcesVisibility,
  toggleSolidDebug,
  toggleTerrainReveal,
  toggleVisionDebug,
} from './DevCommandActions'

const RESOURCE_NAMES = ['all', 'wood', 'food', 'stone', 'gold']

export function createDevCommands() {
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
    usage: 'list <units|buildings|techs|resources>',
    describe: 'List available items for a category',
    complete: () => ['units', 'buildings', 'techs', 'resources'],
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
        default:
          return { ok: false, message: 'Usage: list <units|buildings|techs|resources>' }
      }
    },
  })

  registry.register({
    name: 'spawn',
    aliases: ['unit'],
    usage: 'spawn <unit> [count]',
    describe: 'Spawn units near cursor',
    complete: (_args, { player }) => Object.keys(player?.config?.units || {}),
    run: ([type, count], context) => {
      if (!type) return { ok: false, message: 'Usage: spawn <unit> [count]' }
      return spawnUnits(context, type, count)
    },
  })

  registry.register({
    name: 'building',
    aliases: ['build'],
    usage: 'building <type>',
    describe: 'Spawn a building near cursor',
    complete: (_args, { player }) => Object.keys(player?.config?.buildings || {}),
    run: ([type], context) => {
      if (!type) return { ok: false, message: 'Usage: building <type>' }
      return spawnBuilding(context, type)
    },
  })

  registry.register({
    name: 'resources',
    aliases: ['res'],
    usage: 'resources [wood|food|stone|gold|all] [amount]',
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
    name: 'tech',
    aliases: ['technology'],
    usage: 'tech <technology>',
    describe: 'Unlock a technology',
    complete: (_args, { player }) => Object.keys(player?.techs || {}),
    run: ([type], context) => {
      if (!type) return { ok: false, message: 'Usage: tech <technology>' }
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
    name: 'win',
    describe: 'Instantly win by killing all enemies',
    run: (_args, context) => killEntities(context, 'enemies'),
  })

  registry.register({
    name: 'heal',
    describe: 'Restore all your units and buildings to full HP',
    run: (_args, context) => healAll(context),
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
    name: 'perf',
    usage: 'perf [on|off]',
    describe: 'Toggle performance debug overlay',
    complete: () => ['on', 'off'],
    run: ([value], context) => togglePerfDebug(context, value),
  })

  registry.register({
    name: 'ai',
    usage: 'ai [pause|resume]',
    describe: 'Pause or resume AI decisions',
    complete: () => ['pause', 'resume'],
    run: ([value], context) => toggleAiDebug(context, value),
  })

  registry.register({
    name: 'ai-info',
    aliases: ['aii'],
    usage: 'ai-info [index]',
    describe: 'Show debug info for all AI players (or one by index)',
    run: ([index], context) => aiInfo(context, index),
  })

  registry.register({
    name: 'speed',
    usage: GAME_SPEED_USAGE,
    describe: 'Set simulation speed',
    complete: () => SPEED_VALUES,
    run: ([value], context) => setGameSpeed(context, value),
  })

  registry.register({
    name: 'terrain',
    usage: 'terrain [on|off]',
    describe: 'Toggle terrain reveal debug mode',
    complete: () => ['on', 'off'],
    run: ([value], context) => toggleTerrainReveal(context, value),
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
    complete: (_args, { map }) => ['all', ...new Set([...map.resources].map(resource => resource.type))],
    run: ([type], context) => killResources(context, type),
  })

  return registry
}
