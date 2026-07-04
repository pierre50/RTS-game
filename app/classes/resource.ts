import { Graphics, Sprite, Assets, Polygon, AnimatedSprite } from 'pixi.js'
import {
  getInstanceZIndex,
  playerCanSeeInstance,
  randomRange,
  drawInstanceBlinkingSelection,
  getActionCondition,
  bindAnimatedSpriteToTicker,
  getAnimationFrames,
  getDeterministicCellVariant,
  playSoundCue,
  playSelectionSound,
} from '../lib'
import {
  TYPE_ACTION,
  CELL_WIDTH,
  CELL_HEIGHT,
  FAMILY_TYPES,
  PLAYER_TYPES,
  LABEL_TYPES,
  RESOURCE_TYPES,
  SOUND_CUES,
} from '../constants'
import { Instance } from './Instance'
import { ResourceInterface } from '../ui/ResourceInterface'
import type { FederatedPointerEvent, Texture } from 'pixi.js'
import type { UnknownRecord } from '../types/common'
import type { GameContextLike } from '../types/context'
import type { RuntimeEntity } from '../types/entities'
import type { ResourceConfig } from '../types/config'
import type { EntityInterfaceLike, ResourceEntity } from '../types/entities'

export class Resource extends Instance {
  resourceInterface: ResourceInterface
  quantity!: number
  interface: EntityInterfaceLike

  constructor(options: UnknownRecord, context: GameContextLike) {
    super(context)

    const {
      context: { map },
    } = this

    this.family = FAMILY_TYPES.resource
    this.resourceInterface = new ResourceInterface(this as unknown as ResourceEntity)
    this.size = 1

    Object.keys(options).forEach(prop => {
      this[prop] = options[prop]
    })
    const config = Assets.cache.get('config')
    Object.keys(config.resources[this.type]).forEach(prop => {
      this[prop] = config.resources[this.type][prop]
    })

    this.quantity = this.quantity ?? this.totalQuantity
    this.hitPoints = this.hitPoints ?? this.totalHitPoints
    this.x = map.grid[this.i][this.j].x
    this.y = map.grid[this.i][this.j].y
    this.z = map.grid[this.i][this.j].z
    this.zIndex = getInstanceZIndex(this as unknown as Parameters<typeof getInstanceZIndex>[0])
    this.visible = false

    // Set solid zone
    const cell = map.grid[this.i][this.j]
    cell.solid = true
    cell.has = this

    this.eventMode = 'auto'
    this.allowClick = false
    this.allowMove = false

    this.interface = {
      info: (element: HTMLElement) => {
        const data = config.resources[this.type]
        this.setDefaultInterface(element, data)
      },
    }
    if (this.isAnimated) {
      const spritesheetJump = Assets.cache.get(this.assets)
      this.sprite = new AnimatedSprite(getAnimationFrames(spritesheetJump.textures) as Texture[])
      bindAnimatedSpriteToTicker(this.sprite, this.context.app)
      this.sprite.play()
      this.sprite.animationSpeed = 0.2
    } else {
      const terrainAssets =
        Array.isArray(this.assets) || typeof this.assets === 'string'
          ? this.assets
          : this.assets?.[cell.type] || Object.values(this.assets || {}).find(value => Array.isArray(value))
      this.textureName =
        this.textureName ||
        (typeof terrainAssets === 'string' ? `000_${terrainAssets}` : map.randomItem(terrainAssets || []))
      if (!this.textureName) {
        throw new Error(`Missing texture for resource ${this.type} on ${cell.type}`)
      }
      const resourceName = this.textureName.split('_')[1]
      const textureFile = this.textureName + '.png'
      const spritesheet = Assets.cache.get(resourceName)
      const texture = spritesheet.textures[textureFile]
      this.sprite = Sprite.from(texture)
      this.sprite.hitArea =
        spritesheet.data.frames[textureFile].hitArea && new Polygon(spritesheet.data.frames[textureFile].hitArea)
    }

    this.sprite.updateAnchor = true
    this.sprite.label = LABEL_TYPES.sprite
    if (this.sprite) {
      this.sprite.allowMove = false
      this.sprite.eventMode = 'static'
      this.sprite.roundPixels = true

      this.sprite.on('pointertap', () => {
        const {
          context: { player, menu, controls, editor },
        } = this
        if (editor?.handleEntityInteraction(this) || controls.isInteractionBlocked()) return
        if (
          !player.selectedUnits.length &&
          (playerCanSeeInstance(this as unknown as Parameters<typeof playerCanSeeInstance>[0], player) || map.revealEverything)
        ) {
          player.unselectAll()
          this.select()
          menu.setBottombar(this)
          player.selectedOther = this
          playSelectionSound(this)
        }
      })
      this.sprite.on('pointerup', (evt: FederatedPointerEvent) => {
        const {
          context: { player, controls, editor },
        } = this
        if (editor?.handleEntityInteraction(this)) return
        const action = (TYPE_ACTION as Record<string, string>)[this.category || this.type]
        if (controls.rallyPointController?.active) {
          controls.mouse.prevent = true
          controls.rallyPointController.handleMouseUpOnEntity(this)
          return
        }
        if (controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp(evt)) {
          return
        }
        controls.mouse.prevent = true
        let hasActionOrder = false
        let hasFallbackOrder = false
        let hasSilentCommandOrder = false
        for (let i = 0; i < player.selectedUnits.length; i++) {
          const unit = player.selectedUnits[i]
          if (getActionCondition(unit, this, action)) {
            hasActionOrder = true
            if (this.category === 'Fish' && unit.silentWorkSounds?.includes('fishing')) {
              hasSilentCommandOrder = true
            }
            const sendToFunc = `sendTo${this.category || this.type}`
            typeof unit[sendToFunc] === 'function' ? unit[sendToFunc](this) : unit.sendTo(this)
          } else {
            hasFallbackOrder = true
            unit.sendTo(this)
          }
        }
        if (hasActionOrder) {
          drawInstanceBlinkingSelection(this as unknown as Parameters<typeof drawInstanceBlinkingSelection>[0])
        }
        if (hasFallbackOrder) {
          playSoundCue(SOUND_CUES.unit.militaryCommand)
        } else if (hasActionOrder && !hasSilentCommandOrder) {
          playSoundCue(this.sounds?.command ?? Assets.cache.get('config').units.Villager.sounds.command)
        }
      })

      this.addChild(this.sprite)
    }
    map.addToInstanceBucket(this)
  }

  die(immediate?: boolean) {
    if (this.isDead) {
      return
    }
    const {
      context: { player, players, map, menu },
    } = this
    if (this.selected && player.selectedOther === this) {
      player.unselectAll()
    }
    const listName = 'founded' + this.type + 's'
    for (let i = 0; i < players.length; i++) {
      if (players[i].type === PLAYER_TYPES.ai) {
        const list = players[i][listName] as Set<RuntimeEntity> | undefined
        if (list) {
          list.delete(this)
        }
      }
    }
    map.resources.delete(this)
    menu.updateResourcesMiniMap()
    map.removeFromInstanceBucket(this)
    this.isDead = true
    if (this.type === RESOURCE_TYPES.tree && !immediate) {
      this.onTreeDie()
    } else {
      this.clear()
    }
  }

  setCuttedTreeTexture() {
    const { sprite } = this
    const spritesheet = Assets.cache.get('636')
    this.textureName = `00${randomRange(0, 3)}_636.png`
    const texture = spritesheet.textures[this.textureName]
    sprite.texture = texture
    const points = [-CELL_WIDTH / 2, 0, 0, -CELL_HEIGHT / 2, CELL_WIDTH / 2, 0, 0, CELL_HEIGHT / 2]
    sprite.hitArea = new Polygon(points)
    sprite.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y)
  }

  onTreeDie() {
    const {
      context: { map },
    } = this
    const spritesheet = Assets.cache.get('623')
    this.textureName = `00${randomRange(0, 3)}_623.png`
    const texture = spritesheet.textures[this.textureName]
    const { sprite } = this
    sprite.texture = texture
    sprite.eventMode = 'none'
    this.zIndex--
    if (map.grid[this.i][this.j].has === this) {
      map.grid[this.i][this.j].has = null
      map.grid[this.i][this.j].corpses.add(this)
      map.grid[this.i][this.j].solid = false
    }
  }

  clear() {
    if (this.isDestroyed) {
      return
    }
    const {
      context: { map },
    } = this
    this.isDestroyed = true
    if (map.grid[this.i][this.j].has === this) {
      map.grid[this.i][this.j].has = null
      map.grid[this.i][this.j].solid = false
    }
    map.grid[this.i][this.j].corpses.delete(this)
    map.removeChild(this)
    this.destroy({ children: true, texture: false })
  }

  setDefaultInterface(element: HTMLElement, data: ResourceConfig) {
    return this.resourceInterface.setDefaultInterface(element, data)
  }

  refreshTextureForTerrain() {
    if (this.isAnimated || this.type !== RESOURCE_TYPES.tree) return

    const {
      context: { map },
    } = this
    const cell = map.grid[this.i]?.[this.j]
    const terrainAssets = this.assets?.[cell?.type]
    if (!cell || !Array.isArray(terrainAssets) || !terrainAssets.length) return

    const textureName = getDeterministicCellVariant(terrainAssets, this.i, this.j, map.seed)
    const resourceName = textureName.split('_')[1]
    const textureFile = textureName + '.png'
    const spritesheet = Assets.cache.get(resourceName)
    const texture = spritesheet?.textures?.[textureFile]
    if (!texture) return

    this.textureName = textureName
    this.sprite.texture = texture
    this.sprite.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y)
  }

  syncWithCell() {
    const {
      context: { map },
    } = this
    const cell = map.grid[this.i]?.[this.j]
    if (!cell) return
    this.x = cell.x
    this.y = cell.y
    this.z = cell.z
    this.zIndex = getInstanceZIndex(this as unknown as Parameters<typeof getInstanceZIndex>[0])
    this.visible = true
    this.refreshTextureForTerrain()
  }
}
