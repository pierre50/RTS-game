import { ENTITY_NAME_TRANSLATIONS } from '../../app/lib/i18n/entityNames'
import { FR_TRANSLATIONS } from '../../app/lib/i18n/fr'
import { getBuildingAsset as catalogAsset } from '../../app/lib/graphics/assets'
import {
  buildings,
  sceneFor,
  replacePositions,
  moveEditable,
  editableItems,
  authoredLayout,
  sceneWithLayout,
  editFurniture,
  furnitureCatalog,
  furnitureFootprint,
  INTERIOR_ROOM_SIZES,
  layoutIssues,
} from './model'
import dirtAtlas from '../../public/assets/terrain/dirt/texture.json'
import dirtImage from '../../public/assets/terrain/dirt/texture.png'
import wallAtlas from '../../public/assets/terrain/interior-walls/wood/texture.json'
import wallImage from '../../public/assets/terrain/interior-walls/wood/texture.png'
import decoAtlas from '../../public/assets/graphics/structures/decorations/texture.json'
import decoImage from '../../public/assets/graphics/structures/decorations/texture.png'

const furnitureName = (type: string) => ENTITY_NAME_TRANSLATIONS.fr[type] ?? type
const $ = (id: string) => document.getElementById(id) as HTMLInputElement
const canvas = $('scene') as unknown as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const sheets = new Map<string, { image: HTMLImageElement; frames: Record<string, any> }>()
let scene: ReturnType<typeof sceneFor>
let revision = '',
  token = '',
  canSave = false,
  saving = false
const undo: ReturnType<typeof authoredLayout>[] = []
let adding = false
let drag: {
  label: string
  i: number
  j: number
  grabI: number
  grabJ: number
  error: string | null
  before: ReturnType<typeof authoredLayout>
} | null = null
let selected: string | null = null
let offsetX = 500,
  offsetY = 0
const checked = (id: string) => $(id).checked
const fail = (error: unknown) => {
  $('error').textContent = String(error)
  $('status').textContent = 'Impossible de générer l’aperçu.'
  $('export').disabled = true
}

async function loadSheet(name: string, data, src: string) {
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`Sprite introuvable : ${name}`))
    image.src = src
  })
  sheets.set(name, { image, frames: data.frames })
}
function frame(sheet: string, index: number) {
  const atlas = sheets.get(sheet)
  if (!atlas) throw new Error(`Atlas absent : ${sheet}`)
  const keys = Object.keys(atlas.frames).sort((a, b) => parseInt(a) - parseInt(b))
  const key = keys.find(key => parseInt(key) === index) ?? keys[index]
  if (!key) throw new Error(`Image absente : ${sheet}, ${index}`)
  return { image: atlas.image, ...atlas.frames[key] }
}
function sprite(
  sheet: string,
  index: number,
  x: number,
  y: number,
  options: { width?: number; height?: number; flip?: boolean; tint?: number; center?: boolean } = {}
) {
  const asset = frame(sheet, index),
    f = asset.frame
  const w = options.width ?? f.w,
    h = options.height ?? f.h
  const anchor = options.center
    ? { x: Math.floor(w / 2) / w, y: Math.floor(h / 2) / h }
    : options.width
      ? { x: 0, y: 0 }
      : (asset.anchor ?? { x: 0.5, y: 0.5 })
  ctx.save()
  ctx.translate(x + offsetX, y + offsetY)
  if (options.flip) {
    if (options.width) ctx.translate(w, 0)
    ctx.scale(-1, 1)
  }
  if (options.tint && options.tint !== 0xffffff) ctx.filter = `brightness(${(options.tint & 255) / 255})`
  ctx.drawImage(asset.image, f.x, f.y, f.w, f.h, -anchor.x * w, -anchor.y * h, w, h)
  ctx.restore()
}
function draw() {
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
  offsetX = canvas.width / 2
  offsetY = canvas.height / 2 + 30 - (scene.center.i + scene.center.j) * 16
  for (const row of scene.grid)
    for (const cell of row)
      if (!cell.terrainHidden) {
        sprite('terrain/dirt', (cell.i * 3 + cell.j * 7) % 9, cell.x, cell.y, { center: true })
      }
  if (checked('furniture'))
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
  for (const row of scene.grid)
    for (const cell of row)
      if (!cell.terrainHidden) {
        const x = cell.x + offsetX,
          y = cell.y + offsetY
        if (checked('grid')) {
          ctx.beginPath()
          ctx.moveTo(x - 32, y)
          ctx.lineTo(x, y - 16)
          ctx.lineTo(x + 32, y)
          ctx.lineTo(x, y + 16)
          ctx.closePath()
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
  const active = editableItems(scene).find(item => item.label === selected)
  if (active && checked('edit')) {
    for (const cell of active.label.startsWith('floor:') ? [active] : furnitureFootprint(scene, active)) {
      const x = (cell.i - cell.j) * 32 + offsetX,
        y = (cell.i + cell.j) * 16 + offsetY
      ctx.beginPath()
      ctx.moveTo(x - 32, y)
      ctx.lineTo(x, y - 16)
      ctx.lineTo(x + 32, y)
      ctx.lineTo(x, y + 16)
      ctx.closePath()
      ctx.strokeStyle = drag?.error ? '#ff8989' : '#81e9bc'
      ctx.fillStyle = drag?.error ? '#ff898920' : '#81e9bc20'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }
  const exit = scene.bp.exits[0],
    x = (exit.i - exit.j) * 32 + offsetX,
    y = (exit.i + exit.j) * 16 + offsetY
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
function update() {
  try {
    $('error').textContent = ''
    selected = null
    adding = false
    scene = sceneFor($('building').value, Number($('level').value), checked('mirror'), $('preset').value === 'ai')
    draw()
    refreshItemPositions()
    $('status').textContent = 'Survole une case pour connaître ses coordonnées.'
    $('export').disabled = false
    document.body.dataset.ready = 'true'
    editorState()
  } catch (error) {
    fail(error)
  }
}
function levels() {
  const building = buildings.find(b => b.type === $('building').value)!
  const hasLevels = building.type === 'House'
  $('level-control').hidden = !hasLevels
  $('level').replaceChildren(
    ...(hasLevels ? building.levels : [0]).map(level => new Option(`Niveau ${level + 1}`, String(level)))
  )
}
async function main() {
  await Promise.all([
    loadSheet('terrain/dirt', dirtAtlas, dirtImage),
    loadSheet('walls', wallAtlas, wallImage),
    loadSheet('buildings/deco', decoAtlas, decoImage),
  ])
  await connectEditor()
  $('building').replaceChildren(...buildings.map(b => new Option(b.name, b.type)))
  $('building').value = 'House'
  levels()
  update()
  $('building').addEventListener('change', () => {
    levels()
    update()
  })
  for (const id of ['level', 'preset', 'mirror']) $(id).addEventListener('change', update)
  for (const id of ['furniture', 'walls', 'grid', 'coordinates', 'transparent', 'zoom'])
    $(id).addEventListener('input', () => {
      try {
        draw()
      } catch (error) {
        fail(error)
      }
    })
  $('reset').addEventListener('click', () => {
    for (const id of ['walls', 'furniture']) $(id).checked = true
    for (const id of ['grid', 'coordinates', 'mirror', 'transparent']) $(id).checked = false
    $('zoom').value = '100'
    $('preset').value = 'ai'
    update()
  })
  installEditor()
  canvas.addEventListener('mousemove', event => {
    if (drag) return
    const rect = canvas.getBoundingClientRect(),
      x = ((event.clientX - rect.left) * canvas.width) / rect.width - offsetX,
      y = ((event.clientY - rect.top) * canvas.height) / rect.height - offsetY
    const i = Math.round((x / 32 + y / 16) / 2),
      j = Math.round((y / 16 - x / 32) / 2),
      cell = scene.grid[i]?.[j]
    $('status').textContent =
      cell && !cell.terrainHidden
        ? `Case ${i}, ${j}${cell.has ? ` · ${cell.has.type}` : ''}${cell.border ? ' · Bord de pièce' : ''}`
        : 'Hors de la pièce'
  })
  $('export').addEventListener('click', () => {
    const link = document.createElement('a')
    link.download = `${$('building').value}-niveau-${Number($('level').value) + 1}${checked('grid') ? '-grille' : ''}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  })
}

function editorState(message?: string) {
  const dirty = undo.length > 0
  for (const id of ['building', 'level', 'preset', 'mirror', 'reset']) $(id).disabled = dirty || saving
  const issues = scene ? layoutIssues(scene) : []
  $('room-issues').textContent = issues.join(' · ')
  $('room-size').disabled = !canSave || $('preset').value !== 'ai' || saving
  if (scene) $('room-size').value = String(scene.roomSize)
  $('size-hint').textContent =
    $('building').value === 'House'
      ? 'Taille et aménagement propres à ce niveau de maison.'
      : 'Taille, meubles et tapis du niveau 1 partagés par tous les niveaux.'
  $('save').disabled = !canSave || !dirty || saving
  $('save').textContent = saving
    ? 'Enregistrement…'
    : dirty
      ? 'Enregistrer pour le jeu'
      : 'Aucune modification à enregistrer'
  $('save').dataset.blocked = String(issues.length > 0)
  $('undo').disabled = !dirty || saving
  $('edit').disabled = !canSave || $('preset').value !== 'ai' || saving
  if (!canSave || $('preset').value !== 'ai') $('edit').checked = false
  const editing = checked('edit') && !saving && canSave
  for (const id of ['catalog', 'add']) $(id).disabled = !editing
  for (const id of ['rotate', 'remove'])
    $(id).disabled = !editing || !(scene && editableItems(scene).some(item => item.label === selected))
  const selectedItem = scene && editableItems(scene).find(item => item.label === selected)
  $('selection').textContent = selectedItem
    ? furnitureName(selectedItem.type)
    : 'Sélectionne un meuble dans la pièce ou dans la liste.'
  $('add').textContent = adding ? 'Annuler l’ajout' : 'Ajouter dans la pièce'
  canvas.style.cursor = editing ? (adding ? 'crosshair' : 'grab') : 'default'
  if (message) $('save-status').textContent = message
  else if (dirty)
    $('save-status').textContent = 'Modifications non enregistrées. Enregistre ou annule avant de changer de bâtiment.'
  const feedback =
    message ??
    (issues.length
      ? `Enregistrement bloqué : ${issues.join(' · ')}`
      : dirty
        ? 'Modifications non enregistrées.'
        : 'Aucune modification en attente.')
  $('save-feedback').textContent = feedback
  $('save-feedback').style.color = /Error|Erreur|bloqué|impossible|refusé/i.test(feedback) ? '#ffaaaa' : '#e9cc83'
}
async function connectEditor() {
  if (location.protocol === 'file:') {
    editorState('Pour enregistrer, lance le rapport avec --serve.')
    return
  }
  try {
    const response = await fetch('/api/layouts')
    if (!response.ok) throw new Error('API indisponible')
    const data = await response.json()
    revision = data.revision
    token = data.token
    replacePositions(data.positions)
    canSave = true
    editorState('Active « Modifier les meubles » pour éditer cet intérieur.')
  } catch {
    editorState('Mode lecture seule : relance le serveur du rapport avec --serve pour éditer.')
  }
}
function pointerCell(event: PointerEvent) {
  const rect = canvas.getBoundingClientRect(),
    x = ((event.clientX - rect.left) * canvas.width) / rect.width - offsetX,
    y = ((event.clientY - rect.top) * canvas.height) / rect.height - offsetY
  return { x, y, i: Math.round((x / 32 + y / 16) / 2), j: Math.round((y / 16 - x / 32) / 2) }
}
const pixels = new Map<string, ImageData>()
function furnitureAt(x: number, y: number) {
  return editableItems(scene)
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
function refreshItemPositions() {
  const floor = scene.grid.flat().filter(cell => !cell.terrainHidden).length
  const beds = scene.furniture.filter(item => item.type === 'CampBedroll').length
  $('stats').replaceChildren(
    ...[
      `${floor} cases de sol`,
      `Emprise extérieure : ${scene.building.size}`,
      `${beds} lit${beds > 1 ? 's' : ''}`,
      `${editableItems(scene).length} éléments`,
    ].map(text => {
      const span = document.createElement('span')
      span.textContent = text
      return span
    })
  )
  $('items').replaceChildren(
    ...editableItems(scene).map(item => {
      const tr = document.createElement('tr')
      for (const text of [
        item.label.startsWith('floor:') ? furnitureName(item.type) + ' (sol)' : item.type,
        `${item.i}, ${item.j}`,
      ]) {
        const td = document.createElement('td')
        td.textContent = text
        tr.append(td)
      }
      return tr
    })
  )
  for (const [index, row] of Array.from(($('items') as unknown as HTMLTableSectionElement).rows).entries()) {
    row.tabIndex = 0
    row.style.cursor = 'pointer'
    const select = () => {
      selected = editableItems(scene)[index].label
      editorState()
      draw()
    }
    row.onclick = select
    row.onkeydown = event => {
      if (event.key === 'Enter') select()
    }
  }
}
function commitLayout(layout: ReturnType<typeof authoredLayout>, message: string) {
  try {
    const next = layoutIssues(scene).length ? sceneWithLayout(scene, layout) : editFurniture(scene, layout)
    undo.push(authoredLayout(scene))
    scene = next
    refreshItemPositions()
    editorState(message)
    draw()
  } catch (error) {
    editorState(String(error))
  }
}
function updateCatalogPreview() {
  const type = $('catalog').value
  const ref = catalogAsset(type, {}, {} as never).images.final
  const asset = frame(ref.sheet, ref.frame),
    f = asset.frame
  const c = $('catalog-preview') as unknown as HTMLCanvasElement
  const context = c.getContext('2d')!
  context.clearRect(0, 0, c.width, c.height)
  context.imageSmoothingEnabled = false
  const scale = Math.min(2, (c.width - 12) / f.w, (c.height - 12) / f.h)
  context.drawImage(
    asset.image,
    f.x,
    f.y,
    f.w,
    f.h,
    (c.width - f.w * scale) / 2,
    (c.height - f.h * scale) / 2,
    f.w * scale,
    f.h * scale
  )
}
function installEditor() {
  $('room-size').replaceChildren(
    ...INTERIOR_ROOM_SIZES.map(size => new Option(`${size - 2} × ${size - 2} cases`, String(size)))
  )
  $('room-size').value = String(scene.roomSize)
  $('room-size').addEventListener('change', () => {
    $('edit').checked = true
    $('grid').checked = true
    adding = false
    const previous = authoredLayout(scene)
    const roomSize = Number($('room-size').value)
    undo.push(previous)
    scene = sceneWithLayout(scene, { ...previous, roomSize })
    selected = null
    refreshItemPositions()
    draw()
    editorState('Taille modifiée. Replace les éléments signalés avant d’enregistrer.')
  })
  const categoryNames = [
    'Assises et lits',
    'Rangement',
    'Ateliers et tables',
    'Éclairage',
    'Tapis et peaux',
    'Décoration',
  ]
  $('catalog').replaceChildren(
    ...furnitureCatalog.map(group => {
      const optgroup = document.createElement('optgroup')
      optgroup.label = FR_TRANSLATIONS[group.titleKey] ?? group.titleKey
      optgroup.append(...group.types.map(type => new Option(furnitureName(type), type)))
      return optgroup
    })
  )
  updateCatalogPreview()
  $('catalog').addEventListener('change', updateCatalogPreview)
  $('add').addEventListener('click', () => {
    adding = !adding
    editorState(adding ? 'Clique sur une case libre pour ajouter ce meuble.' : 'Ajout annulé.')
    draw()
  })
  $('remove').addEventListener('click', () => {
    const item = editableItems(scene).find(item => item.label === selected)
    if (!item) return
    const layout = authoredLayout(scene)
    if (item.label.startsWith('floor:')) layout.rugs!.splice(Number(item.label.slice(6)), 1)
    else delete layout.items[item.label.split(':default:')[1]]
    commitLayout(layout, 'Meuble supprimé. Tu peux annuler avant de sauvegarder.')
  })
  $('rotate').addEventListener('click', () => {
    const item = editableItems(scene).find(item => item.label === selected)
    if (!item) return
    const layout = authoredLayout(scene),
      key = item.label.split(':default:')[1]
    if (item.label.startsWith('floor:')) {
      const rug = layout.rugs![Number(item.label.slice(6))]
      rug.mirrored = !rug.mirrored
    } else layout.items[key].mirrored = !layout.items[key].mirrored
    commitLayout(layout, 'Orientation inversée.')
  })
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      adding = false
      editorState()
      draw()
    }
  })
  $('edit').addEventListener('change', () => {
    adding = false
    if (checked('edit')) {
      $('furniture').checked = true
      $('grid').checked = true
    }
    editorState()
    draw()
  })
  $('undo').addEventListener('click', () => {
    const previous = undo.pop()
    if (!previous) return
    scene = sceneWithLayout(scene, previous)
    selected = null
    adding = false
    refreshItemPositions()
    draw()
    editorState(undo.length ? 'Modifications non enregistrées.' : 'Toutes les modifications ont été annulées.')
  })
  canvas.addEventListener('pointerdown', event => {
    if (!checked('edit') || !checked('furniture') || saving || event.button !== 0) return
    const point = pointerCell(event)
    if (adding) {
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
      const previous = undo.length
      commitLayout(layout, 'Meuble ajouté. Tu peux le déplacer ou le tourner.')
      if (undo.length > previous) {
        adding = false
        selected = `preview:${scene.building.type}:default:${key}`
        editorState()
        draw()
      }
      return
    }
    const item = furnitureAt(point.x, point.y)
    if (!item) {
      selected = null
      editorState()
      draw()
      return
    }
    event.preventDefault()
    selected = item.label
    drag = {
      label: item.label,
      i: item.i,
      j: item.j,
      grabI: point.i - item.i,
      grabJ: point.j - item.j,
      error: null,
      before: authoredLayout(scene),
    }
    canvas.setPointerCapture(event.pointerId)
    editorState()
    canvas.style.cursor = 'grabbing'
    draw()
  })
  canvas.addEventListener('pointermove', event => {
    if (!drag) return
    const point = pointerCell(event)
    drag.error = moveEditable(scene, drag.label, point.i - drag.grabI, point.j - drag.grabJ)
    $('status').textContent = drag.error ?? 'Relâche pour poser le meuble.'
    draw()
  })
  const finish = (event: PointerEvent, cancel = false) => {
    if (!drag) return
    const current = drag,
      point = pointerCell(event)
    const error = cancel
      ? 'Déplacement annulé.'
      : moveEditable(scene, current.label, point.i - current.grabI, point.j - current.grabJ)
    if (error) scene = sceneWithLayout(scene, current.before)
    else {
      const item = editableItems(scene).find(item => item.label === current.label)!
      if (item.i !== current.i || item.j !== current.j) undo.push(current.before)
    }
    drag = null
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    refreshItemPositions()
    draw()
    editorState(error ?? (undo.length ? 'Modifications non enregistrées.' : undefined))
  }
  canvas.addEventListener('pointerup', event => finish(event))
  canvas.addEventListener('pointercancel', event => finish(event, true))
  $('save').addEventListener('click', async () => {
    if (saving) return
    const issues = layoutIssues(scene)
    if (issues.length) {
      editorState(`Enregistrement bloqué : ${issues.join(' · ')} Déplace ou supprime les éléments signalés.`)
      return
    }
    let message = ''
    saving = true
    adding = false
    editorState('Enregistrement…')
    try {
      const session = await fetch('/api/layouts', { signal: AbortSignal.timeout(10000) })
      if (!session.ok)
        throw new Error('Serveur de sauvegarde indisponible. Tes modifications sont conservées dans la page.')
      token = (await session.json()).token
      const response = await fetch('/api/layouts', {
        signal: AbortSignal.timeout(15000),
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Layout-Token': token },
        body: JSON.stringify({
          type: $('building').value,
          level: Number($('level').value),
          revision,
          layout: authoredLayout(scene),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Enregistrement impossible.')
      revision = data.revision
      replacePositions(data.positions)
      undo.length = 0
      message = 'Enregistré pour le jeu. Les nouveaux intérieurs utiliseront ces positions.'
    } catch (error) {
      message = String(error)
    } finally {
      saving = false
      editorState(message)
    }
  })
  window.addEventListener('beforeunload', event => {
    if (undo.length) {
      event.preventDefault()
      event.returnValue = ''
    }
  })
}
main().catch(fail)
