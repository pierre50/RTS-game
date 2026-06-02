import { DevCommandRegistry } from './DevCommandRegistry'
import { addResources, applyTechnology, healAll, killEntities, setAge, setCiv, spawnBuilding, spawnUnits, toggleFog } from './DevCommandActions'

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
    name: 'fog',
    usage: 'fog [on|off]',
    describe: 'Toggle fog of war',
    complete: () => ['on', 'off'],
    run: ([value], context) => toggleFog(context, value),
  })

  return registry
}
