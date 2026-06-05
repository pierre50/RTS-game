export function getIconPath(name) {
  const id = name.split('_')[1]
  const index = name.split('_')[0]
  return `assets/interface/${id}/${index}_${id}.png`
}

export function getBuildingTextureNameWithSize(size) {
  switch (size) {
    case 1:
      return '000_256'
    case 2:
      return '000_258'
    case 3:
      return '000_261'
  }
}

export function getBuildingRubbleTextureNameWithSize(size) {
  switch (size) {
    case 1:
      return '000_153'
    case 2:
      return '000_154'
    case 3:
      return '000_155'
  }
}

export function getBuildingAsset(type, owner, assets) {
  const path = assets.cache.get(owner.civ.toLowerCase()).buildings
  if (path[owner.age]?.[type]) return path[owner.age][type]
  if (owner.age >= 1 && path[owner.age - 1]?.[type]) return path[owner.age - 1][type]
  if (owner.age >= 2 && path[owner.age - 2]?.[type]) return path[owner.age - 2][type]
  if (path[0]?.[type]) return path[0][type]
  if (path[owner.age + 1]?.[type]) return path[owner.age + 1][type]
  if (path[owner.age + 2]?.[type]) return path[owner.age + 2][type]
  if (path[owner.age + 3]?.[type]) return path[owner.age + 3][type]

  throw new Error(`Missing building asset for ${owner.civ} ${type} at age ${owner.age}`)
}
