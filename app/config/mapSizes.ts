interface MapSizeDefinition {
  label: string
  value: number
  idealSpawnRange: [number, number]
}

const MAP_SIZE_DEFINITIONS: MapSizeDefinition[] = [
  { label: 'Dev    (16x16)', value: 16, idealSpawnRange: [1, 1] },
  { label: 'Small  (144x144)', value: 144, idealSpawnRange: [2, 4] },
  { label: 'Medium (256x256)', value: 256, idealSpawnRange: [3, 6] },
]

export function getIdealSpawnRangeForMapSize(size: number): [number, number] {
  return MAP_SIZE_DEFINITIONS.find(definition => definition.value === size)?.idealSpawnRange ?? [1, 3]
}
