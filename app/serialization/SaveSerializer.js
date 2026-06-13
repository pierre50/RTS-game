import { filterObject } from '../lib'

function cameraData(camera) {
  return {
    x: camera?.x ?? 0,
    y: camera?.y ?? 0,
  }
}

function pathData(path = []) {
  return path.map(({ i, j }) => ({ i, j }))
}

function destinationData(dest) {
  if (!dest) return dest
  return {
    i: dest.i,
    j: dest.j,
    x: dest.x,
    y: dest.y,
    label: dest.label,
  }
}

function resourceData(resource) {
  return {
    ...filterObject(resource, ['label', 'i', 'j', 'type', 'isDead', 'quantity', 'isDestroyed', 'size', 'hitPoints']),
    textureName: (resource.textureName || '').split('.')[0],
  }
}

function animalData(animal) {
  return {
    ...filterObject(animal, [
      'label',
      'type',
      'i',
      'j',
      'x',
      'y',
      'z',
      'hitPoints',
      'path',
      'work',
      'realDest',
      'zIndex',
      'degree',
      'action',
      'direction',
      'currentSheet',
      'size',
      'inactif',
      'isDead',
      'isDestroyed',
      'quantity',
    ]),
    currentFrame: animal.sprite?.currentFrame,
    loop: animal.sprite?.loop,
    dest: animal.dest && [animal.dest.i, animal.dest.j, animal.dest?.label],
    previousDest: animal.previousDest && [animal.previousDest.i, animal.previousDest.j, animal.previousDest?.label],
    path: pathData(animal.path),
    realDest: destinationData(animal.realDest),
  }
}

function unitData(unit) {
  return {
    ...filterObject(unit, [
      'label',
      'type',
      'i',
      'j',
      'x',
      'y',
      'z',
      'hitPoints',
      'path',
      'work',
      'previousWork',
      'realDest',
      'degree',
      'action',
      'loading',
      'loadingType',
      'direction',
      'currentSheet',
      'size',
      'inactif',
      'isDead',
      'isDestroyed',
    ]),
    currentFrame: unit.sprite?.currentFrame,
    loop: unit.sprite?.loop,
    dest: unit.dest && [unit.dest.i, unit.dest.j, unit.dest?.label],
    previousDest: unit.previousDest && [unit.previousDest.i, unit.previousDest.j, unit.previousDest?.label],
    path: pathData(unit.path),
    realDest: destinationData(unit.realDest),
  }
}

function buildingData(building) {
  return {
    ...filterObject(building, [
      'label',
      'i',
      'j',
      'type',
      'queue',
      'technology',
      'loading',
      'isDead',
      'isDestroyed',
      'isBuilt',
      'hitPoints',
      'quantity',
    ]),
    isUsedBy: building.isUsedBy?.label,
  }
}

function playerData(player) {
  const data = {
    ...filterObject(player, [
      'label',
      'age',
      'type',
      'wood',
      'food',
      'stone',
      'gold',
      'civ',
      'color',
      'difficulty',
      'team',
      'population',
      'population_max',
      'technologies',
      'cellViewed',
      'isPlayed',
      'hasBuilt',
    ]),
    buildings: player.buildings.map(b => buildingData(b)),
    units: player.units.map(u => unitData(u)),
    corpses: player.corpses.map(c => unitData(c)),
    views: player.views.toJSON(),
  }

  if (player.type === 'AI') {
    const savedAt = player.getNow?.() ?? 0
    const serializeMemory = memory => ({
      instance: memory.instance?.label || memory.label || null,
      lastSeenAgo: Math.max(0, savedAt - (memory.lastSeenAt ?? savedAt)),
    })

    data.aiState = {
      phase: player.phase,
      savedAt,
      lastAttackWaveAgo: Number.isFinite(player.lastAttackWaveAt)
        ? Math.max(0, savedAt - player.lastAttackWaveAt)
        : null,
      enemyUnits: [...(player.enemyUnitMemory?.values?.() || [])].map(serializeMemory),
      enemyBuildings: [...(player.enemyBuildingMemory?.values?.() || [])].map(serializeMemory),
      threatenedTargets: [...(player.threatenedTargets?.values?.() || [])].map(threat => ({
        target: threat.target?.label || null,
        attacker: threat.attacker?.label || null,
        lastSeenAgo: Math.max(0, savedAt - (threat.lastSeenAt ?? savedAt)),
        count: threat.count ?? 0,
        attackerFamily: threat.attackerFamily ?? null,
        attackerType: threat.attackerType ?? null,
      })),
    }
  }

  return data
}

function cellData(cell) {
  const data = { type: cell.type }
  if (cell.z !== 0) data.z = cell.z
  if (cell.viewed) data.viewed = true
  if (cell.inclined) data.inclined = true
  if (cell.border) data.border = true
  if (cell.waterBorder) data.waterBorder = true
  if (cell.has) data.has = cell.has.label
  if (cell.fogSprites.length > 0) {
    const seenFogSprites = new Set()
    data.fogSprites = cell.fogSprites
      .map(({ textureSheet, colorSheet, colorName }) => ({
        textureSheet,
        colorSheet,
        colorName,
      }))
      .filter(spriteData => {
        const key = `${spriteData.textureSheet}|${spriteData.colorSheet || ''}|${spriteData.colorName || ''}`
        if (seenFogSprites.has(key)) return false
        seenFogSprites.add(key)
        return true
      })
  }
  return data
}

export function serializeGame(context) {
  return {
    runtime: {
      elapsedMs: context.scheduler?.elapsedMs ?? 0,
    },
    camera: cameraData(context.controls.camera),
    config: {
      seed: context.map.seed,
      instantMode: context.map.instantMode,
      allTechnologies: context.map.allTechnologies,
      startingAge: context.map.startingAge,
      revealEverything: context.map.revealEverything,
      revealTerrain: context.map.revealTerrain,
      startingResources: context.map.startingResources,
      resourceDensity: context.map.resourceDensity,
    },
    players: context.players.map(p => playerData(p)),
    resources: [...context.map.resources].map(r => resourceData(r)),
    map: context.map.grid.map(line => line.map(cell => cellData(cell))),
    animals: context.map.gaia.units.filter(animal => !animal.isDestroyed).map(animal => animalData(animal)),
  }
}
