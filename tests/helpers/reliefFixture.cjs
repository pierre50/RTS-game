const point = (i, j) => ({ x: (i - j) * 32, y: (i + j) * 16 })
function reliefMap(elevation, size = 13) {
  return {
    grid: Array.from({ length: size }, (_, i) =>
      Array.from({ length: size }, (_, j) => ({
        i,
        j,
        z: elevation(i, j),
        ...point(i, j),
      }))
    ),
  }
}
module.exports = { point, reliefMap }
