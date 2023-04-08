import { Container, Graphics } from 'pixi.js'
import { degreesToRadians, moveTowardPoint, pointsDistance, instancesDistance } from '../../lib'
import { colorArrow, stepTime } from '../../constants'

export class Projectile extends Container {
  constructor(options, context) {
    super()

    this.context = context

    const {
      context: { map },
    } = this
    this.setParent(map)
    this.id = map.children.length
    this.name = 'projectile'

    Object.keys(options).forEach(prop => {
      this[prop] = options[prop]
    })
    const { x: targetX, y: targetY } = this.target

    this.distance = instancesDistance(this, this.target, false)
    const degree = getPointsDegree(this.x, this.y, targetX, targetY)
    const sprite = new Graphics()
    sprite.beginFill(colorArrow)
    //sprite.lineStyle(1, colorArrow, 1)
    sprite.drawRect(1, 1, this.size, 1)
    sprite.rotation = degreesToRadians(degree)
    sprite.name = 'sprite'
    sprite.allowMove = false
    sprite.interactive = false
    sprite.allowClick = false
    sprite.roundPixels = true
    this.addChild(sprite)

    const interval = setInterval(() => {
      if (pointsDistance(this.x, this.y, targetX, targetY) <= Math.max(this.speed, this.size)) {
        if (this.target && this.target.life > 0) {
          this.onHit()
        }
        clearInterval(interval)
        this.die()
        return
      }
      moveTowardPoint(this, targetX, targetY, this.speed)
    }, stepTime)
  }

  onHit() {
    const {
      context: { menu, player },
    } = this
    this.target.life -= this.owner.attack
    if (this.target.selected && player && player.selectedOther === this.target) {
      menu.updateInfo(
        'life',
        element => (element.textContent = Math.max(this.target.life, 0) + '/' + this.target.lifeMax)
      )
    }
    typeof this.target.isAttacked === 'function' && this.target.isAttacked(this.owner)
  }

  die() {
    this.isDead = true
    this.destroy({ child: true, texture: true })
  }
}
