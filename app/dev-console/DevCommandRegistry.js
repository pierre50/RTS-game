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

  names() {
    return [...new Set([...this.commands.keys(), ...this.aliases.keys()])].sort()
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
