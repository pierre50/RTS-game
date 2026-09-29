import { AnimatedSprite } from 'pixi.js'
import { FADE_DURATION_MS, RESOURCE_TYPES } from '../../constants'
import { isAIControlledPlayer } from '../../lib'
import { fadeOutThenClear } from '../../lib/entities/entityFade'
import { resetHarvestedWheat } from '../../lib/resources/wheatGrowth'
import { playerSeesTarget } from '../../lib/units/playerTargetKnowledge'
import type { Resource } from '../Resource'
import { type PlayerWithResourceMemory } from '../ResourceTexture'
type Host = Resource
export function die(this: Host, immediate?: boolean) {
  if (this.isDead) {
    return
  }
  if (!immediate && resetHarvestedWheat(this)) {
    this.stopWindMotion()
    if (this.sprite instanceof AnimatedSprite) this.sprite.gotoAndStop(0)
    this.syncShadow()
    this.context.menu?.refreshInventory?.()
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
    if (isAIControlledPlayer(players[i]) && playerSeesTarget(players[i], this)) {
      const list = (players[i] as PlayerWithResourceMemory)[listName]
      if (list) {
        list.delete(this)
      }
    }
  }
  map.resources.delete(this)
  this.registerNaturalRespawnSlot()
  if (menu.isMiniMapActive?.() !== false) menu.updateResourcesMiniMap()
  map.removeFromInstanceBucket(this)
  this.isDead = true
  this.stopWindMotion()
  let clearWithoutFade = false
  if (this.type === RESOURCE_TYPES.tree && !immediate) {
    this.onTreeDie()
  } else {
    clearWithoutFade = !immediate && this.spawnDepletedResourceFragmentBurst()
    this.prepareFadeOut()
  }
  if (clearWithoutFade) {
    this.hideDepletedResourceSprite()
    this.context.scheduler.addOneShot(() => this.clear(), FADE_DURATION_MS, 'resource.fragmentBurstClear')
  } else {
    fadeOutThenClear(this, FADE_DURATION_MS)
  }
}
