const RALLY_POINT_FRAME_COUNT = 6

export function getRallyPointFrames(textures, direction = 0) {
  const names = Object.keys(textures).sort((a, b) => {
    const frameA = parseInt(a.split('_')[0], 10)
    const frameB = parseInt(b.split('_')[0], 10)
    return frameA - frameB
  })
  const start = direction * RALLY_POINT_FRAME_COUNT
  return names.slice(start, start + RALLY_POINT_FRAME_COUNT).map(name => textures[name])
}
