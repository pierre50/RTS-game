import type { AITechCondition, AIStrategyPlayerLike } from './types'

export function canResearchTechForAI(
  ai: AIStrategyPlayerLike,
  techKey: string,
  hasReachedAge: (requiredAge: number) => boolean
): boolean {
  const tech = ai.techs[techKey]
  if (!tech?.conditions) return true
  return tech.conditions.every((cond: AITechCondition) => {
    if (cond.key === 'age') {
      const ageValue = typeof cond.value === 'number' ? cond.value : Number(cond.value)
      if (cond.op === '>=') return hasReachedAge(ageValue)
      if (cond.op === '=') return ai.age === ageValue
    }
    if (cond.key === 'technologies') {
      const technology = String(cond.value)
      if (cond.op === 'includes') return ai.technologies.includes(technology)
      if (cond.op === 'notincludes') return !ai.technologies.includes(technology)
    }
    return true
  })
}
