import { editableItems, furnitureFootprint } from './model'
import { sprite } from './sprites'
import { $, canvas, checked, ctx, state } from './state'

function diamondPath(x: number, y: number) {
  ctx.beginPath()
  ctx.moveTo(x - 32, y)
  ctx.lineTo(x, y - 16)
  ctx.lineTo(x + 32, y)
  ctx.lineTo(x, y + 16)
  ctx.closePath()
}

function prepareCanvas() {
  const { scene } = state
  const width = Math.max(1000, (scene.roomSize - 2) * 64 + 160)
  const height = Math.max(720, (scene.roomSize - 2) * 32 + 280)
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  const zoom = Number($('zoom').value) / 100
  canvas.style.width = `${canvas.width * zoom}px`
  canvas.style.height = `${canvas.height * zoom}px`
  $('zoom-label').textContent = `${Math.round(zoom * 100)} %`
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = false
  if (!checked('transparent')) {
    ctx.fillStyle = '#0c1120'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  state.offsetX = canvas.width / 2
  state.offsetY = canvas.height / 2 + 30 - (scene.center.i + scene.center.j) * 16
}

function drawFloor() {
  for (const row of state.scene.grid)
    for (const cell of row)
      if (!cell.terrainHidden) {
        sprite('terrain/dirt', (cell.i * 3 + cell.j * 7) % 9, cell.x, cell.y, { center: true })
      }
}

function drawRugs() {
  const { scene } = state
  for (const rug of scene.rugs) {
    const x = rug.offsetX * (checked('mirror') ? -1 : 1),
      y = rug.offsetY
    const i = Math.round(scene.center.i + (x / 32 + y / 16) / 2),
      j = Math.round(scene.center.j + (y / 16 - x / 32) / 2)
    const cell = scene.grid[i]?.[j]
    if ((!cell || cell.terrainHidden || (cell.border && !rug.allowBorderPlacement)) && !checked('edit')) continue
    sprite(
      'buildings/deco',
      rug.frame,
      (scene.center.i - scene.center.j) * 32 + x,
      (scene.center.i + scene.center.j) * 16 + y,
      { flip: checked('mirror') !== Boolean(rug.mirrored) }
    )
  }
}

function drawCellOverlays() {
  for (const row of state.scene.grid)
    for (const cell of row)
      if (!cell.terrainHidden) {
        const x = cell.x + state.offsetX,
          y = cell.y + state.offsetY
        if (checked('grid')) {
          diamondPath(x, y)
          ctx.strokeStyle = '#efdc9888'
          ctx.lineWidth = 1
          ctx.stroke()
        }
        if (checked('coordinates')) {
          ctx.font = '10px system-ui'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.lineWidth = 3
          ctx.strokeStyle = '#493d32'
          ctx.strokeText(`${cell.i},${cell.j}`, x, y)
          ctx.fillStyle = '#fff1c5'
          ctx.fillText(`${cell.i},${cell.j}`, x, y)
        }
      }
}

function drawEntities() {
  const { scene } = state
  const entities: { depth: number; draw: () => void }[] = []
  if (checked('walls'))
    for (const wall of scene.walls)
      entities.push({
        depth: wall.zIndex,
        draw: () =>
          sprite('walls', wall.frame + (wall.low ? 5 : 0), wall.x, wall.y + (wall.low ? 76 : 0), {
            width: wall.width,
            height: wall.height - (wall.low ? 76 : 0),
            flip: wall.flip,
            tint: wall.tint,
          }),
      })
  if (checked('furniture'))
    for (const item of scene.furniture)
      entities.push({
        depth: item.depth,
        draw: () => {
          const ref = item.asset.images.final
          sprite(ref.sheet, ref.frame, (item.i - item.j) * 32, (item.i + item.j) * 16, {
            flip: Boolean(item.asset.mirrored) !== Boolean(item.placementMirrored),
          })
        },
      })
  entities.sort((a, b) => a.depth - b.depth).forEach(item => item.draw())
}

function drawSelection() {
  const { scene, drag } = state
  const active = editableItems(scene).find(item => item.label === state.selected)
  if (!active || !checked('edit')) return
  for (const cell of active.label.startsWith('floor:') ? [active] : furnitureFootprint(scene, active)) {
    diamondPath((cell.i - cell.j) * 32 + state.offsetX, (cell.i + cell.j) * 16 + state.offsetY)
    ctx.strokeStyle = drag?.error ? '#ff8989' : '#81e9bc'
    ctx.fillStyle = drag?.error ? '#ff898920' : '#81e9bc20'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

function drawExit() {
  const exit = state.scene.bp.exits[0],
    x = (exit.i - exit.j) * 32 + state.offsetX,
    y = (exit.i + exit.j) * 16 + state.offsetY
  ctx.strokeStyle = '#78d3b4'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, y + 18)
  ctx.lineTo(x, y + 42)
  ctx.stroke()
  ctx.fillStyle = '#78d3b4'
  ctx.font = '13px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('Entrée', x, y + 48)
}

export function draw() {
  prepareCanvas()
  drawFloor()
  if (checked('furniture')) drawRugs()
  drawCellOverlays()
  drawEntities()
  drawSelection()
  drawExit()
}
