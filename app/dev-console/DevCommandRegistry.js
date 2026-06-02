export class DevCommandRegistry {
  constructor() {
    this.commands = new Map()
    this.aliases = new Map()
  }

  register(command) {
    this.commands.set(command.name, command)
    ;(command.aliases || []).forEach(alias => this.aliases.set(alias, command.name))
  }

  get(name) {
    return this.commands.get(name) || this.commands.get(this.aliases.get(name))
  }

  all() {
    return [...this.commands.values()]
  }

  names() {
    return [...new Set([...this.commands.keys(), ...this.aliases.keys()])].sort()
  }

  complete(input, context) {
    const endsWithSpace = /\s$/.test(input)
    const parts = input.trim().split(/\s+/).filter(Boolean)

    if (!parts.length || (parts.length === 1 && !endsWithSpace)) {
      const prefix = parts[0] || ''
      return this.names().filter(name => name.startsWith(prefix))
    }

    const [cmdName, ...argParts] = parts
    const command = this.get(cmdName)
    if (!command?.complete) return []

    const prefix = endsWithSpace ? '' : argParts[argParts.length - 1] || ''
    const confirmedArgs = endsWithSpace ? argParts : argParts.slice(0, -1)

    const suggestions = command.complete(confirmedArgs, context)
    return suggestions.filter(s => s.toLowerCase().startsWith(prefix.toLowerCase()))
  }

  execute(input, context) {
    const [name, ...args] = input.trim().split(/\s+/)
    const command = this.get(name)
    if (!command) {
      return { ok: false, message: `Unknown command: ${name}` }
    }
    return command.run(args, context)
  }
}
