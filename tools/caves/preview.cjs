const fs = require('node:fs')
const zlib = require('node:zlib')
function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  const length = Buffer.alloc(4),
    crc = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}
function writePreview(blueprint, file) {
  const cells = blueprint.size + 1,
    scale = 8,
    width = cells * scale
  const floor = Buffer.from(blueprint.floorMask, 'base64')
  const border = Buffer.from(blueprint.borderMask, 'base64')
  const relief = Buffer.from(blueprint.relief, 'base64')
  const pixels = Buffer.alloc((width * 3 + 1) * width)
  for (let y = 0; y < width; y++)
    for (let x = 0; x < width; x++) {
      const i = Math.floor(y / scale),
        j = Math.floor(x / scale),
        index = i * cells + j
      const exit = blueprint.exits.some(exit => exit.i === i && exit.j === j)
      const mineral = blueprint.resources?.find(resource => resource.i === i && resource.j === j)
      const color = mineral
        ? ({ Gold: [222, 207, 16], Copper: [184, 115, 51], Iron: [140, 155, 175] }[mineral.type] ?? [174, 151, 116])
        : exit
          ? [92, 204, 134]
          : !floor[index]
            ? [28, 27, 30]
            : border[index]
              ? [80, 71, 62]
              : [174, 151, 116].map(channel => Math.min(255, channel + relief[index] * 20))
      const offset = y * (width * 3 + 1) + 1 + x * 3
      pixels.set(color, offset)
    }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(width, 4)
  header[8] = 8
  header[9] = 2
  fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', zlib.deflateSync(pixels)),
      chunk('IEND', Buffer.alloc(0)),
    ])
  )
}
module.exports = { writePreview }
