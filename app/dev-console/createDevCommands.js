import { DevCommandRegistry } from './DevCommandRegistry'
import { addResources, applyTechnology, setAge, setCiv, spawnBuilding, spawnUnits } from './DevCommandActions'

export function createDevCommands() {
  const registry = new DevCommandRegistry()

  registry.register({
    name: 'help',
    aliases: ['?'],
    run: (_args, { commands }) => ({ ok: true, message: `Commands: ${commands.names().join(', ')}` }),
  })

  registry.register({
    name: 'spawn',
    aliases: ['unit'],
    run: ([type, count], context) => {
      if (!type) return { ok: false, message: 'Usage: spawn <unit> [count]' }
      return spawnUnits(context, type, count)
    },
  })

  registry.register({
    name: 'building',
    aliases: ['build'],
    run: ([type], context) => {
      if (!type) return { ok: false, message: 'Usage: building <type>' }
      return spawnBuilding(context, type)
    },
  })

  registry.register({
    name: 'resources',
    aliases: ['res'],
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
    run: ([type], context) => {
      if (!type) return { ok: false, message: 'Usage: tech <technology>' }
      return applyTechnology(context, type)
    },
  })

  registry.register({
    name: 'age',
    run: ([value], context) => setAge(context, value),
  })

  registry.register({
    name: 'civ',
    run: ([value], context) => setCiv(context, value),
  })

  return registry
}
