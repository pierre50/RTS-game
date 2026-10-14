import { authoredLayout, editableItems, moveEditable, sceneWithLayout } from './model'
import { draw } from './draw'
import { commitLayout, editorState, refreshItemPositions } from './editorPanel'
import { frame } from './sprites'
import { $, canvas, checked, state } from './state'

function pointerCell(event: MouseEvent) {
  const rect = canvas.getBoundingClientRect(),
    x = ((event.clientX - rect.left) * canvas.width) / rect.width - state.offsetX,
    y = ((event.clientY - rect.top) * canvas.height) / rect.height - state.offsetY
  return { x, y, i: Math.round((x / 32 + y / 16) / 2), j: Math.round((y / 16 - x / 32) / 2) }
}

const pixels = new Map<string, ImageData>()
function furnitureAt(x: number, y: number) {
  const { selected } = state
  return editableItems(state.scene)
    .sort((a, b) => {
      // A rug selected from the list remains draggable even below a piece of furniture.
      if (selected?.startsWith('floor:')) {
        if (a.label === selected) return -1
        if (b.label === selected) return 1
      }
      return b.depth - a.depth
    })
    .find(item => {
      const ref = item.asset.images.final,
        asset = frame(ref.sheet, ref.frame),
        f = asset.frame,
        a = asset.anchor ?? { x: 0.5, y: 0.5 }
      const flip = Boolean(item.asset.mirrored) !== Boolean(item.placementMirrored)
      const u = Math.floor(a.x * f.w + (x - (item.i - item.j) * 32) * (flip ? -1 : 1)),
        v = Math.floor(y - (item.i + item.j) * 16 + a.y * f.h)
      if (u < 0 || v < 0 || u >= f.w || v >= f.h) return false
      const key = ref.sheet + ':' + ref.frame
      if (!pixels.has(key)) {
        const c = document.createElement('canvas')
        c.width = f.w
        c.height = f.h
        const context = c.getContext('2d')!
        context.drawImage(asset.image, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h)
        pixels.set(key, context.getImageData(0, 0, f.w, f.h))
      }
      return pixels.get(key)!.data[(v * f.w + u) * 4 + 3] > 30
    })
}

export function installHoverStatus() {
  canvas.addEventListener('mousemove', event => {
    if (state.drag) return
    const { i, j } = pointerCell(event),
      cell = state.scene.grid[i]?.[j]
    $('status').textContent =
      cell && !cell.terrainHidden
        ? `Case ${i}, ${j}${cell.has ? ` · ${cell.has.type}` : ''}${cell.border ? ' · Bord de pièce' : ''}`
        : 'Hors de la pièce'
  })
}

function addAt(point: { i: number; j: number }) {
  const { scene } = state
  const layout = authoredLayout(scene)
  const key = 'custom-' + crypto.randomUUID()
  const di = point.i - scene.center.i,
    dj = point.j - scene.center.j
  layout.items[key] = {
    type: $('catalog').value,
    mirrored: false,
    offsetI: checked('mirror') ? dj : di,
    offsetJ: checked('mirror') ? di : dj,
  }
  const previous = state.undo.length
  commitLayout(layout, 'Meuble ajouté. Tu peux le déplacer ou le tourner.')
  if (state.undo.length > previous) {
    state.adding = false
    state.selected = `preview:${state.scene.building.type}:default:${key}`
    editorState()
    draw()
  }
}

function onPointerDown(event: PointerEvent) {
  if (!checked('edit') || !checked('furniture') || state.saving || event.button !== 0) return
  const point = pointerCell(event)
  if (state.adding) {
    addAt(point)
    return
  }
  const item = furnitureAt(point.x, point.y)
  if (!item) {
    state.selected = null
    editorState()
    draw()
    return
  }
  event.preventDefault()
  state.selected = item.label
  state.drag = {
    label: item.label,
    i: item.i,
    j: item.j,
    grabI: point.i - item.i,
    grabJ: point.j - item.j,
    error: null,
    before: authoredLayout(state.scene),
  }
  canvas.setPointerCapture(event.pointerId)
  editorState()
  canvas.style.cursor = 'grabbing'
  draw()
}

function onPointerMove(event: PointerEvent) {
  const { drag } = state
  if (!drag) return
  const point = pointerCell(event)
  drag.error = moveEditable(state.scene, drag.label, point.i - drag.grabI, point.j - drag.grabJ)
  $('status').textContent = drag.error ?? 'Relâche pour poser le meuble.'
  draw()
}

function finishDrag(event: PointerEvent, cancel = false) {
  if (!state.drag) return
  const current = state.drag,
    point = pointerCell(event)
  const error = cancel
    ? 'Déplacement annulé.'
    : moveEditable(state.scene, current.label, point.i - current.grabI, point.j - current.grabJ)
  if (error) state.scene = sceneWithLayout(state.scene, current.before)
  else {
    const item = editableItems(state.scene).find(item => item.label === current.label)!
    if (item.i !== current.i || item.j !== current.j) state.undo.push(current.before)
  }
  state.drag = null
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
  refreshItemPositions()
  draw()
  editorState(error ?? (state.undo.length ? 'Modifications non enregistrées.' : undefined))
}

export function installPointerEditing() {
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', event => finishDrag(event))
  canvas.addEventListener('pointercancel', event => finishDrag(event, true))
}
