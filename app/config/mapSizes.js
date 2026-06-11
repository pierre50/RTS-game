export const MAP_SIZE_DEFINITIONS = [
  { label: 'Dev    (16x16)', value: 16, maxPlayers: 2, editorOnly: true },
  { label: 'Small  (144x144)', value: 144, maxPlayers: 3 },
  { label: 'Medium (256x256)', value: 256, maxPlayers: 4 },
  { label: 'Large  (512x512)', value: 512, maxPlayers: 4 },
]

export const MAP_SIZES = MAP_SIZE_DEFINITIONS.filter(size => !size.editorOnly)
export const MAP_EDITOR_SIZES = MAP_SIZE_DEFINITIONS
