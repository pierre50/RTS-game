const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { loadGenerationTs } = require('../maps/load-generation-ts.cjs')
const {
  buildings,
  getInteriorLayoutLevel,
  sceneFor,
  replacePositions,
  authoredPositions,
  authoredLayout,
  moveFurniture,
  furnitureCatalog,
  editableItems,
  moveEditable,
  INTERIOR_ROOM_SIZES,
} = loadGenerationTs('tools/interiors-preview/model.ts')
const defaultFile = path.resolve(__dirname, '../../app/config/interiorLayoutPositions.json')

function createLayoutStore(file = defaultFile) {
  function read() {
    const source = fs.readFileSync(file, 'utf8')
    return { positions: JSON.parse(source), revision: crypto.createHash('sha256').update(source).digest('hex') }
  }
  function save(payload) {
    const current = read()
    if (payload.revision !== current.revision) {
      const error = new Error('Les aménagements ont changé. Recharge la page avant de sauvegarder.')
      error.status = 409
      throw error
    }
    const building = buildings.find(b => b.type === payload.type)
    if (!building || !Number.isInteger(payload.level) || !building.levels.includes(payload.level))
      throw new Error('Bâtiment ou niveau invalide.')
    payload = { ...payload, level: getInteriorLayoutLevel({ type: payload.type, buildingLevel: payload.level }) }
    replacePositions(current.positions)
    const full = payload.layout !== undefined
    const positions = full ? payload.layout?.items : payload.positions
    const keys = full
      ? Object.keys(positions ?? {})
      : Object.keys(authoredPositions(sceneFor(payload.type, payload.level, false, true)))
    if (
      !positions ||
      typeof positions !== 'object' ||
      Array.isArray(positions) ||
      Object.keys(positions).length !== keys.length ||
      keys.length > 100
    )
      throw new Error('Liste de meubles invalide.')
    if (
      full &&
      (!Object.hasOwn(payload.layout, 'items') ||
        Object.keys(payload.layout).some(key => !['items', 'rugs', 'roomSize'].includes(key)))
    )
      throw new Error('Aménagement invalide.')
    const types = furnitureCatalog.flatMap(group => group.types)
    for (const key of keys) {
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key))
        throw new Error('Identifiant de meuble invalide.')
      if (!Object.hasOwn(positions, key)) throw new Error('Meuble manquant.')
      const p = positions[key]
      if (
        !p ||
        Object.keys(p).sort().join(',') !== (full ? 'mirrored,offsetI,offsetJ,type' : 'offsetI,offsetJ') ||
        !Number.isInteger(p.offsetI) ||
        !Number.isInteger(p.offsetJ) ||
        Math.abs(p.offsetI) > 20 ||
        Math.abs(p.offsetJ) > 20 ||
        (full && (!types.includes(p.type) || typeof p.mirrored !== 'boolean'))
      )
        throw new Error('Meuble ou coordonnées invalides.')
    }
    const rugs = full ? payload.layout.rugs : undefined
    if (rugs !== undefined) {
      if (!Array.isArray(rugs) || rugs.length > 100) throw new Error('Liste de tapis invalide.')
      for (const rug of rugs) {
        if (
          !rug ||
          typeof rug !== 'object' ||
          Object.keys(rug).some(
            key => !['frame', 'offsetX', 'offsetY', 'mirrored', 'allowBorderPlacement'].includes(key)
          ) ||
          ![17, 18, 41].includes(rug.frame) ||
          !Number.isFinite(rug.offsetX) ||
          !Number.isFinite(rug.offsetY) ||
          Math.abs(rug.offsetX) > 1280 ||
          Math.abs(rug.offsetY) > 640 ||
          (rug.mirrored !== undefined && typeof rug.mirrored !== 'boolean') ||
          (rug.allowBorderPlacement !== undefined && typeof rug.allowBorderPlacement !== 'boolean')
        )
          throw new Error('Tapis ou coordonnées invalides.')
      }
    }
    const roomSize = full ? payload.layout.roomSize : undefined
    if (roomSize !== undefined && !INTERIOR_ROOM_SIZES.includes(roomSize))
      throw new Error('Taille intérieure invalide.')
    const next = structuredClone(current.positions)
    next[payload.type] ??= {}
    next[payload.type][payload.level] = full
      ? { items: positions, ...(rugs !== undefined ? { rugs } : {}), ...(roomSize !== undefined ? { roomSize } : {}) }
      : positions
    try {
      replacePositions(next)
      for (const mirrored of [false, true]) {
        const scene = sceneFor(payload.type, payload.level, mirrored, true)
        const actual = full ? authoredLayout(scene).items : authoredPositions(scene)
        if (Object.keys(actual).length !== keys.length) throw new Error('Le jeu ne peut pas placer tous les meubles.')
        for (const key of keys) {
          if (
            actual[key]?.offsetI !== positions[key].offsetI ||
            actual[key]?.offsetJ !== positions[key].offsetJ ||
            (full && (actual[key]?.type !== positions[key].type || actual[key]?.mirrored !== positions[key].mirrored))
          )
            throw new Error(
              `Le jeu ne peut pas placer ${key} à cet endroit. Vérifie les passages et les chevauchements.`
            )
        }
        if (rugs !== undefined) {
          for (const rug of editableItems(scene).filter(item => item.label.startsWith('floor:'))) {
            const error = moveEditable(scene, rug.label, rug.i, rug.j)
            if (error) throw new Error(error)
          }
        }
        for (const item of scene.furniture) {
          const error = moveFurniture(scene, item.label, item.i, item.j)
          if (error) throw new Error(error)
        }
      }
      const temp = `${file}.${crypto.randomUUID()}.tmp`
      try {
        fs.writeFileSync(temp, JSON.stringify(next, null, 2) + '\n')
        fs.renameSync(temp, file)
      } finally {
        if (fs.existsSync(temp)) fs.unlinkSync(temp)
      }
      return read()
    } finally {
      replacePositions(read().positions)
    }
  }
  return { read, save }
}
function createLayoutApi(port, file = defaultFile) {
  const store = createLayoutStore(file),
    token = crypto.randomBytes(32).toString('hex')
  return async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    if (pathname !== '/api/layouts') return false
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(data))
    }
    if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) {
      send(403, { error: 'Hôte non autorisé.' })
      return true
    }
    if (req.method === 'GET') {
      try {
        send(200, { ...store.read(), token })
      } catch (error) {
        send(500, { error: error.message })
      }
      return true
    }
    if (req.method !== 'POST') {
      send(405, { error: 'Méthode non autorisée.' })
      return true
    }
    if (
      ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin) ||
      req.headers['x-layout-token'] !== token ||
      req.headers['content-type'] !== 'application/json'
    ) {
      send(403, { error: 'Sauvegarde autorisée uniquement depuis cet éditeur local.' })
      return true
    }
    try {
      let body = ''
      for await (const chunk of req) {
        body += chunk
        if (Buffer.byteLength(body) > 32768) throw new Error('Aménagement trop volumineux.')
      }
      send(200, store.save(JSON.parse(body)))
    } catch (error) {
      send(error.status ?? 400, { error: error.message })
    }
    return true
  }
}
module.exports = { createLayoutStore, createLayoutApi }
