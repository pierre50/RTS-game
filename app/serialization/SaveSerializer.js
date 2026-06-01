import { filterObject } from '../lib'

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
  return {
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
    views: player.views.map(view =>
      view.map(cell => ({
        ...filterObject(cell, ['i', 'j', 'viewed']),
        viewBy: [...(cell.viewBy || [])].map(unit => unit.label),
      }))
    ),
  }
}

function cellData(cell) {
  return {
    ...filterObject(cell, ['z', 'type', 'viewed', 'solid', 'visible', 'category', 'inclined', 'border', 'waterBorder']),
    has: cell.has?.label,
    fogSprites: cell.fogSprites.map(({ textureSheet, colorSheet, colorName }) => ({
      textureSheet,
      colorSheet,
      colorName,
    })),
  }
}

export function serializeGame(context) {
  return {
    camera: context.controls.camera,
    config: {
      devMode: context.map.devMode,
      revealEverything: context.map.revealEverything,
      revealTerrain: context.map.revealTerrain,
      startingResources: context.map.startingResources,
    },
    players: context.players.map(p => playerData(p)),
    resources: [...context.map.resources].map(r => resourceData(r)),
    map: context.map.grid.map(line => line.map(cell => cellData(cell))),
    animals: context.map.gaia.units.map(a => animalData(a)),
  }
}
