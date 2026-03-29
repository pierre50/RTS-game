import { Container, Graphics } from 'pixi.js'
import {
  degreesToRadians,
  getHitPointsWithDamage,
  moveTowardPoint,
  pointsDistance,
  average,
  randomItem,
  uuidv4,
} from '../lib'
import { COLOR_ARROW, FAMILY_TYPES, LABEL_TYPES, MENU_INFO_IDS, STEP_TIME } from '../constants'
import { sound } from '@pixi/sound'

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
    const { x: targetX, y: targetY } = this.destination || this.target

    this.owner.visible &&
      this.sounds.start &&
      sound.play(Array.isArray(this.sounds.start) ? randomItem(this.sounds.start) : this.sounds.start)

    const degree = this.degree || getPointsDegree(this.x, this.y, targetX, targetY)
    const sprite = new Graphics()
    sprite.rect(1, 1, this.size, 1)
    sprite.fill(COLOR_ARROW)
    sprite.rotation = degreesToRadians(degree)
    sprite.label = LABEL_TYPES.sprite
    sprite.allowMove = false
    sprite.eventMode = 'none'
    sprite.allowClick = false
    sprite.roundPixels = true
    this.addChild(sprite)

    this.interval = setInterval(() => {
      if (this.context.paused) return
      if (pointsDistance(this.x, this.y, targetX, targetY) <= Math.max(this.speed, this.size)) {
        if (
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
    clearInterval(this.interval)
    this.destroy({ child: true, texture: true })
  }
}
