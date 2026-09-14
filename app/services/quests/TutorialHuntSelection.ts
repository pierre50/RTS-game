import { isWildHorse } from '../../lib/horses/horseTaming'
import { canPlaceAmbientAnimalAt, pickAmbientAnimalType, placeAmbientAnimalGroup } from '../../classes/map/generation/AmbientAnimalGeneration'
import { createNonReservedPassageCellCondition } from '../../lib/buildings/passageCells'
import { MEAT_GATHER_BONUS_DROPS } from '../../config/animalGatherLoot'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { QuestInstance } from '../../types/quest'

/** Choose once from outdoor wildlife reachable from the quest giver. */
export function selectTutorialHunt(
  context: GameContextLike,
  npc: UnitEntity,
  options: { ensurePopulation?: boolean; resource?: string; quantity?: number } = {}
): Pick<QuestInstance, 'parameters' | 'markers' | 'reservation'> | null {
  const grid = context.map.grid
  if (!grid?.length || !Number.isInteger(npc.i) || !Number.isInteger(npc.j)) return null
  const reachable = new Set<string>()
  const queue = [{ i: npc.i, j: npc.j }]
  const key = (i: number, j: number) => `${i}:${j}`
  reachable.add(key(npc.i, npc.j))
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const point = queue[cursor]!
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const i = point.i + di!,
        j = point.j + dj!
      const cell = grid[i]?.[j]
      if (
        !cell ||
        reachable.has(key(i, j)) ||
        cell.category === 'Water' ||
        cell.inclined ||
        (cell.solid && cell.has?.family !== 'unit' && cell.has?.family !== 'animal')
      )
        continue
      reachable.add(key(i, j))
      queue.push({ i, j })
    }
  }
  const animals = context.map.gaia?.animals ?? context.map.gaia?.units ?? []
  const choices = (options.resource ? [options.resource] : ['leather', 'feather'])
    .map(resource => {
      const targets = animals.filter(
        animal =>
          !animal.isDestroyed &&
          (animal.type !== 'Horse' || isWildHorse(animal)) &&
          !('companionOwner' in animal && animal.companionOwner) &&
          (animal.quantity ?? 0) > 0 &&
          (animal.spaceId ?? 'outside') === 'outside' &&
          MEAT_GATHER_BONUS_DROPS[animal.type]?.some(drop => drop.resource === resource) &&
          [
            [0, 0],
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(([di, dj]) => reachable.has(key(animal.i + di!, animal.j + dj!)))
      )
      const clusters = targets.map(center => {
        const members = targets.filter(animal => Math.hypot(animal.i - center.i, animal.j - center.j) <= 8)
        const expected = members.reduce((sum, animal) => sum + (animal.quantity ?? 0) *
          (MEAT_GATHER_BONUS_DROPS[animal.type]?.find(drop => drop.resource === resource)?.chance ?? 0), 0)
        return { center, targets: members, expected }
      }).sort((a, b) => b.expected - a.expected ||
        Math.abs(a.center.i - npc.i) + Math.abs(a.center.j - npc.j) - Math.abs(b.center.i - npc.i) - Math.abs(b.center.j - npc.j))
      const cluster = clusters[0]
      return { resource, targets: cluster?.targets ?? [], expected: cluster?.expected ?? 0, center: cluster?.center }
    })
    .filter(choice => choice.expected >= 1)
    .sort((a, b) => b.expected - a.expected)
  const requiredExpected = (options.quantity ?? 3) * 2
  if (options.ensurePopulation && (choices[0]?.expected ?? 0) < requiredExpected) {
    const map = context.map
    const gaia = map.gaia
    const configs = gaia?.config?.animals ?? {}
    const available = Object.fromEntries(['Deer', 'BlackGrouse'].filter(type => configs[type] &&
      (!options.resource || MEAT_GATHER_BONUS_DROPS[type]?.some(drop => drop.resource === options.resource)))
      .map(type => [type, configs[type]]))
    if (gaia?.createAnimal && Object.keys(available).length) {
      const nonPassage = createNonReservedPassageCellCondition(context)
      const buildings = (context.players ?? []).flatMap(owner => owner.buildings ?? [])
      const canPlace = (i: number, j: number) => reachable.has(key(i, j)) &&
        nonPassage(grid[i]![j]!) && !context.player?.views?.isVisible(i, j) &&
        canPlaceAmbientAnimalAt(map, i, j, {
          hasWaterNeighbor: () => false,
          isInPlayerStartSafeZone: () => buildings.some(building => !building.isDead && !building.isDestroyed &&
            Math.max(Math.abs(i - building.i), Math.abs(j - building.j)) <= Math.ceil((building.size ?? 2) / 2) + 4),
        })
      const candidates = queue.filter(cell => canPlace(cell.i, cell.j)).sort((a, b) =>
        Math.abs(a.i - npc.i) + Math.abs(a.j - npc.j) - Math.abs(b.i - npc.i) - Math.abs(b.j - npc.j))
      let expected = choices[0]?.expected ?? 0
      // Bounded supplementation; later checks can retry if terrain or wildlife changes.
      for (let groups = 0; groups < 3 && expected < requiredExpected; groups++) {
        const cell = candidates.find(point => canPlace(point.i, point.j))
        if (!cell) break
        const type = pickAmbientAnimalType({ animals: available, biome: grid[cell.i]![cell.j]!.type ?? 'Grass',
          isInPlayerStartSafeZone: () => true, random: () => map.random() })
        placeAmbientAnimalGroup(map, cell.i, cell.j, type, { canPlace, createAnimal: options => {
          const animal = gaia.createAnimal!(options)
          expected += (animal.quantity ?? 0) * (MEAT_GATHER_BONUS_DROPS[type]?.[0]?.chance ?? 0)
        } })
      }
      return selectTutorialHunt(context, npc, { ...options, ensurePopulation: false })
    }
  }
  const choice = choices[0]
  if (!choice) return null
  const target = choice.center!
  choice.targets.sort((a, b) => Math.hypot(a.i - target.i, a.j - target.j) - Math.hypot(b.i - target.i, b.j - target.j))
  const quantity = options.quantity ?? Math.max(1, Math.min(3, Math.floor(choice.expected / 2)))
  let reservedYield = 0
  const entityLabels = choice.targets.filter(animal => {
    if (reservedYield >= quantity * 2) return false
    reservedYield += (animal.quantity ?? 0) * (MEAT_GATHER_BONUS_DROPS[animal.type]?.find(drop => drop.resource === choice.resource)?.chance ?? 0)
    return true
  }).flatMap(animal => animal.label ? [animal.label] : [])
  return {
    reservation: { entityLabels, stageIds: ['wood', 'hunt'] },
    parameters: {
      resource: choice.resource,
      quantity,
      rewardGold: 0,
    },
    markers: {
      hunt: [
        {
          id: 'hunting-area',
          spaceId: 'outside',
          position: { i: target.i, j: target.j },
          radius: 8,
          label: { key: 'tutorialHuntArea' },
        },
      ],
    },
  }
}
