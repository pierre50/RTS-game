import { Container, Graphics } from 'pixi.js'
import {
  degreesToRadians,
  getHitPointsWithDamage,
  moveTowardPoint,
  pointsDistance,
  instancesDistance,
  average,
  randomItem,
  uuidv4,
} from '../lib'
import { colorArrow, stepTime } from '../constants'
import { sound } from '@pixi/sound'

export class Projectile extends Container {
  constructor(options, context) {
    super()

    this.context = context

    const {
      context: { map },
    } = this
    this.setParent(map)
    this.name = uuidv4()
    this.family = 'projectile'

    Object.keys(options).forEach(prop => {
      this[prop] = options[prop]
    })
    Object.keys(this.owner.owner.config.projectiles[this.type]).forEach(prop => {
      this[prop] = this.owner.owner.config.projectiles[this.type][prop]
    })

    this.x = this.owner.x
    this.y = this.owner.y - this.owner.sprite.height / 2
    const { x: targetX, y: targetY } = this.destination || this.target

    this.owner.visible &&
      this.sounds.start &&
      sound.play(Array.isArray(this.sounds.start) ? randomItem(this.sounds.start) : this.sounds.start)

    this.distance = instancesDistance(this, this.target, false)
    const degree = this.degree || getPointsDegree(this.x, this.y, targetX, targetY)
    const sprite = new Graphics()
    sprite.beginFill(colorArrow)
    sprite.drawRect(1, 1, this.size, 1)
    sprite.rotation = degreesToRadians(degree)
    sprite.name = 'sprite'
    sprite.allowMove = false
    sprite.eventMode = 'none'
    sprite.allowClick = false
    sprite.roundPixels = true
    this.addChild(sprite)

    const interval = setInterval(() => {
      if (pointsDistance(this.x, this.y, targetX, targetY) <= Math.max(this.speed, this.size)) {
        if (
          pointsDistance(targetX, targetY, this.target.x, this.target.y) <=
          average(this.target.width, this.target.height)
        ) {
          this.onHit(this.target)
        }
        clearInterval(interval)
        this.die()
        return
      }
      moveTowardPoint(this, targetX, targetY, this.speed)
    }, stepTime)
  }

  onHit(instance) {
    const {
      context: { menu, player },
    } = this
    instance.hitPoints = getHitPointsWithDamage(this.owner, instance, this.damage)
    if (instance.selected && player.selectedOther === instance) {
      menu.updateInfo('hitPoints', instance.hitPoints + '/' + instance.totalHitPoints)
    }
    if (instance.hitPoints <= 0) {
      instance.die()
    } else {
      typeof instance.isAttacked === 'function' && instance.isAttacked(this.owner)
    }
  }

  die() {
    this.isDead = true
    this.destroy({ child: true, texture: true })
  }
}
