import { AnimatedSprite, Assets, Container, Graphics, Sprite } from 'pixi.js'
import {
  degreesToRadians,
  getHitPointsWithDamage,
  moveTowardPoint,
  pointsDistance,
  average,
  randomItem,
  uuidv4,
  getPointsDegree,
  bindAnimatedSpriteToTicker,
  degreeToDirection,
} from '../lib'
import { COLOR_ARROW, FAMILY_TYPES, LABEL_TYPES, MENU_INFO_IDS, STEP_TIME } from '../constants'
import { sound } from '@pixi/sound'

const DIRECTIONAL_FRAME_INDEX = {
  south: 0,
  southwest: 1,
  west: 2,
  northwest: 3,
  north: 4,
  northeast: 5,
  east: 6,
  southeast: 7,
}

function getDirectionalFrameIndex(projectile, direction) {
  if (Array.isArray(projectile.directionalFrameOrder)) {
    const frameIndex = projectile.directionalFrameOrder.indexOf(direction)
    if (frameIndex >= 0) {
      return frameIndex
    }
  }

  return DIRECTIONAL_FRAME_INDEX[direction] ?? 0
}

function getSortedTextureNames(textures) {
  return Object.keys(textures).sort((a, b) => {
    const na = parseInt(a.split('_')[0], 10)
    const nb = parseInt(b.split('_')[0], 10)
    return na - nb
  })
}

export class Projectile extends Container {
  constructor(options, context) {
    super()

    this.context = context
    this.label = uuidv4()
    this.family = FAMILY_TYPES.projectile

    Object.assign(this, options)
    Object.assign(this, this.owner.owner.config.projectiles[this.type])

    this.x = this.owner.x
    this.y = this.owner.y - this.owner.sprite.height / 2
    const targetPoint = this.destination || this.target
    if (!targetPoint) {
      this.isDead = true
      return
    }
    const { x: targetX, y: targetY } = targetPoint

    this.context.controls.instanceIsAudible(this) &&
      this.sounds.start &&
      sound.play(Array.isArray(this.sounds.start) ? randomItem(this.sounds.start) : this.sounds.start)

    const degree = this.degree || getPointsDegree(this.x, this.y, targetX, targetY)
    const sprite = this.createSprite(degree)
    sprite.label = LABEL_TYPES.sprite
    sprite.allowMove = false
    sprite.eventMode = 'none'
    sprite.allowClick = false
    sprite.roundPixels = true
    this.addChild(sprite)

    this.interval = this.context.scheduler.add(() => {
      if (pointsDistance(this.x, this.y, targetX, targetY) <= Math.max(this.speed, this.size)) {
        if (
          this.target &&
          !this.target.isDead &&
          !this.target.isDestroyed &&
          pointsDistance(targetX, targetY, this.target.x, this.target.y) <=
            average(this.target.width, this.target.height)
        ) {
          this.onHit(this.target)
        }
        this.die()
        return
      }
      moveTowardPoint(this, targetX, targetY, this.speed)
    }, STEP_TIME)
  }

  createSprite(degree) {
    if (!this.assets) {
      const sprite = new Graphics()
      sprite.rect(1, 1, this.size, 1)
      sprite.fill(COLOR_ARROW)
      sprite.rotation = degreesToRadians(degree)
      return sprite
    }

    const spritesheet = Assets.cache.get(this.assets)
    const textureNames = getSortedTextureNames(spritesheet.textures)

    if (this.isAnimated) {
      const textures = textureNames.map(name => spritesheet.textures[name])
      const sprite = new AnimatedSprite(textures)
      bindAnimatedSpriteToTicker(sprite, this.context.app)
      sprite.animationSpeed = this.animationSpeed ?? 0.3
      sprite.play()
      return sprite
    }

    let textureName = textureNames[0]
    if (this.directionalFrames) {
      const direction = degreeToDirection(degree)
      const frameIndex = getDirectionalFrameIndex(this, direction)
      textureName = textureNames[Math.min(frameIndex, textureNames.length - 1)]
    }
    const sprite = Sprite.from(spritesheet.textures[textureName])
    if (this.rotateSprite) {
      sprite.rotation = degreesToRadians(degree)
    }
    return sprite
  }

  onHit(instance) {
    const {
      context: { menu, player },
    } = this
    instance.hitPoints = getHitPointsWithDamage(this.owner, instance, this.damage)
    if (instance.selected && player.selectedOther === instance) {
      menu.updateInfo(MENU_INFO_IDS.hitPoints, instance.hitPoints + '/' + instance.totalHitPoints)
    }
    if (instance.hitPoints <= 0) {
      instance.die()
    } else {
      typeof instance.isAttacked === 'function' && instance.isAttacked(this.owner)
    }
  }

  die() {
    this.isDead = true
    this.context.scheduler.remove(this.interval)
    this.interval = null
    this.destroy({ child: true, texture: true })
  }
}
