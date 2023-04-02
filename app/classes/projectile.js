import { Container, Graphics } from 'pixi.js'
import { degreesToRadians, moveTowardPoint, pointsDistance, instancesDistance, degreeToDirection } from '../lib'
import { accelerator, colorArrow, stepTime } from '../constants'

class Projectile extends Container {
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
    this.isDestroyed = true
    this.destroy({ child: true, texture: true })
  }
}

export class Arrow extends Projectile {
  constructor({ owner, target }, context) {
    const type = 'Arrow'
    const ownerSprite = owner.getChildByName('sprite')
    const { height, width } = ownerSprite
    const anchoredWidth = width * ownerSprite.anchor.x
    const anchoredHeight = height * ownerSprite.anchor.y
    const direction = degreeToDirection(owner.degree)
    const position = {
      x: owner.x,
      y: owner.y,
    }
    switch (direction) {
      case 'north':
        position.y = owner.y - anchoredHeight
        break
      case 'west':
        position.y = owner.y - anchoredHeight
        position.x = owner.x - anchoredWidth
        break
      case 'northwest':
        position.y = owner.y - anchoredHeight
        position.x = owner.x - anchoredWidth
        break
      case 'southwest':
        position.y = owner.y - anchoredHeight
        position.x = owner.x - anchoredWidth
        break
      case 'est':
        position.y = owner.y - anchoredHeight
        position.x = owner.x + anchoredWidth * 2
        break
      case 'northest':
        position.y = owner.y - anchoredHeight
        position.x = owner.x + anchoredWidth
        break
      case 'southest':
        position.y = owner.y - anchoredHeight
        position.x = owner.x + anchoredWidth
        break
    }
    super(
      {
        x: position.x,
        y: position.y,
        type,
        target,
        owner,
        size: 4,
        speed: 14 * accelerator,
      },
      context
    )
  }
}

export default {
  Arrow,
}
