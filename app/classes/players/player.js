import { Assets } from 'pixi.js'
import {
  canAfford,
  drawInstanceBlinkingSelection,
  payCost,
  uuidv4,
  capitalizeFirstLetter,
  getHexColor,
  updateObject,
  getActionCondition,
  canUpdateMinimap,
  isValidCondition,
  canPlaceBuildingAt,
  playSoundCue,
} from '../../lib'
import { Building } from '../building'
import { Unit } from '../unit'
import { ACTION_TYPES, FAMILY_TYPES, PLAYER_TYPES, POPULATION_MAX, SOUND_CUES, UNIT_TYPES } from '../../constants'
import { createPlayerData } from '../../config/playerConfig'
import { playUiSound } from '../../lib/uiSound'
import { VisionGrid } from '../../services/VisionGrid'
import { refreshOwnerWalls } from '../../lib/buildings/walls'
import { updateWallAndNeighbours } from '../../lib/buildings/walls'
import { refreshOwnerTowers } from '../../lib/buildings/towers'

const AGE_TECHNOLOGIES = new Set(['ToolAge', 'BronzeAge', 'IronAge'])

export class Player {
  constructor(options, context) {
    this.family = FAMILY_TYPES.player
    this.context = context

    const { map } = context
    this.label = uuidv4()
    this.parent = map

    const res = map.startingResources
    this.wood = res.wood
    this.food = res.food
    this.stone = res.stone
    this.gold = res.gold
    this.corpses = []
    this.units = []
    this.buildings = []
    this.population = 0
    this.technologies = []
    this.cellViewed = 0
    this.age = 0
    this.lastUnderAttackAlertAt = 0
    Object.keys(options).forEach(prop => {
      this[prop] = options[prop]
    })
    this.team = this.team == null || this.team === '' ? null : Number(this.team)
    if (!Number.isFinite(this.team)) this.team = null

    this.population_max = this.population_max || (map.instantMode ? POPULATION_MAX : 0)

    this.colorHex = getHexColor(this.color)
    const { config, techs } = createPlayerData(Assets.cache.get('config'), Assets.cache.get('technology'), this.civ)
    this.config = config
    this.techs = techs
    this.hasBuilt = this.hasBuilt || (map.instantMode ? Object.keys(this.config.buildings).map(key => key) : [])
    this.views = new VisionGrid(
      map.size,
      this.views,
      (i, j) => {
        if (this.isPlayed && !map.revealEverything) {
          this.context.menu.updateTerrainMiniMap(i, j)
        }
      },
      this.isPlayed && this.type === PLAYER_TYPES.human && map.revealTerrain
    )
  }

  reportThreat(target, attacker) {
    if (!target || target.owner?.label !== this.label || !attacker || attacker.isDead || attacker.isDestroyed) return
    if (!this.isPlayed || this.type !== PLAYER_TYPES.human) return

    const isWindowFocused = document.visibilityState === 'visible' && document.hasFocus()
    const isTargetInCamera = this.context.controls?.instanceInCamera(target) ?? true
    if (isWindowFocused && isTargetInCamera) return

    const now = Date.now()
    if (now - this.lastUnderAttackAlertAt < 5000) return

    this.lastUnderAttackAlertAt = now
    playUiSound(SOUND_CUES.ui.underAttack)
  }

  spawnBuilding(options) {
    const building = this.createBuilding(options)
    if (this.isPlayed) {
      let hasSentVillager = false
      let hasSentOther = false

      for (let i = 0; i < this.selectedUnits.length; i++) {
        const unit = this.selectedUnits[i]
        if (unit.type === UNIT_TYPES.villager) {
          if (getActionCondition(unit, building, ACTION_TYPES.build)) {
            hasSentVillager = true
            unit.sendToBuilding(building)
          }
        } else {
          unit.sendTo(building)
          hasSentOther = true
        }
      }
      if (hasSentVillager) {
        drawInstanceBlinkingSelection(building)
      }
      if (hasSentOther) {
        playSoundCue(SOUND_CUES.unit.militaryCommand)
        return
      } else if (hasSentVillager) {
        const voice = this.config.units.Villager.sounds.buildCommand
        playSoundCue(voice)
        return
      }
    }

    return building
  }

  isTechnologyEligible(type) {
    if (AGE_TECHNOLOGIES.has(type)) return false
    if (this.technologies.includes(type)) return false

    const config = this.techs?.[type]
    if (!config) return false

    return (config.conditions || []).every(condition => isValidCondition(condition, this))
  }

  unlockTechnology(type) {
    if (this.technologies.includes(type)) return false

    const config = this.techs?.[type]
    if (!config) return false

    if (Array.isArray(this[config.key])) {
      this[config.key].push(config.value || type)
    } else {
      this[config.key] = config.value || type
    }

    if (config.action) {
      switch (config.action.type) {
        case 'upgradeUnit':
          this.units.forEach(unit => {
            if (unit.type === config.action.source) unit.upgrade(config.action.target)
          })
          break
        case 'upgradeBuilding':
          this.buildings.forEach(building => {
            if (building.type === config.action.source) building.upgrade(config.action.target)
          })
          break
        case 'improve':
          this.updateConfig(
            config.action.operations.map(operation => ({
              ...operation,
              value: Number(operation.value),
            }))
          )
          break
        case 'refreshWalls':
          refreshOwnerWalls(this)
          break
        case 'refreshTowers':
          refreshOwnerTowers(this)
          break
      }
    }

    const handler = `on${capitalizeFirstLetter(config.key)}Change`
    typeof this[handler] === 'function' && this[handler](config.value)
    return true
  }

  applyEligibleTechnologies() {
    const unlocked = []
    let appliedInPass = true

    while (appliedInPass) {
      appliedInPass = false
      for (const type of Object.keys(this.techs || {})) {
        if (!this.isTechnologyEligible(type)) continue
        if (this.unlockTechnology(type)) {
          unlocked.push(type)
          appliedInPass = true
        }
      }
    }

    return unlocked
  }

  onAgeChange() {
    const {
      context: { players, menu },
    } = this
    const refreshSelection = selection => {
      if (!selection?.interface) return false
      if (selection.owner?.label !== this.label) return false
      menu.setBottombar(selection)
      return true
    }

    if (this.autoTechnologyByAge) {
      this.applyEligibleTechnologies()
    }

    if (this.isPlayed) {
      playSoundCue(SOUND_CUES.player.ageAdvance)
    }
    for (let i = 0; i < this.buildings.length; i++) {
      const building = this.buildings[i]
      if (building.isBuilt && !building.isDead) {
        building.finalTexture()
      }
    }
    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      if (player.type === PLAYER_TYPES.human) {
        refreshSelection(player.selectedUnit) ||
          refreshSelection(player.selectedBuilding) ||
          refreshSelection(player.selectedOther)
      }
    }
  }

  otherPlayers() {
    const {
      context: { players },
    } = this
    const others = [...players]
    others.splice(players.indexOf(this), 1)
    return others
  }

  isAlliedWith(player) {
    return !!player && player.label !== this.label && this.team !== null && this.team === player.team
  }

  isEnemy(player) {
    return !!player && player.label !== this.label && !this.isAlliedWith(player)
  }

  enemyPlayers() {
    return this.otherPlayers().filter(player => this.isEnemy(player))
  }

  visiblePlayers() {
    return [this, ...this.otherPlayers().filter(player => this.isAlliedWith(player))]
  }

  updateConfig(operations) {
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i]
      const types = Array.isArray(operation.type) ? operation.type : [operation.type]
      for (let j = 0; j < types.length; j++) {
        const type = types[j]
        if (Object.keys(this.config.buildings).includes(type)) {
          this.config.buildings[type] && updateObject(this.config.buildings[type], operation)
        } else if (Object.keys(this.config.units).includes(type)) {
          this.config.units[type] && updateObject(this.config.units[type], operation)
        }
      }
    }
  }

  isBuildingEligible(type) {
    const config = this.config.buildings[type]
    if (!config) return false

    return (config.conditions || []).every(
      condition => (this.autoTechnologyByAge && condition.key !== 'age') || isValidCondition(condition, this)
    )
  }

  buyBuilding(i, j, type) {
    const {
      context: { menu, map },
    } = this
    const config = this.config.buildings[type]
    if (canAfford(this, config.cost) && this.isBuildingEligible(type) && canPlaceBuildingAt(map.grid, i, j, config)) {
      this.spawnBuilding({ i, j, type, isBuilt: map.instantMode })
      payCost(this, config.cost)
      this.isPlayed && menu.updateTopbar()
      return true
    }
    return false
  }

  createUnit(options) {
    const { context } = this
    let unit = context.map.addChild(new Unit({ ...options, owner: this }, context))
    canUpdateMinimap(unit, context.player) && context.menu.updatePlayerMiniMapEvt(this)
    return unit
  }

  createBuilding(options) {
    const { context } = this
    const building = context.map.addChild(new Building({ ...options, owner: this }, context))
    this.buildings.push(building)
    updateWallAndNeighbours(building)
    canUpdateMinimap(building, context.player) && context.menu.updatePlayerMiniMapEvt(this)
    return building
  }
}
