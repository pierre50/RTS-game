import { Unit } from './unit'
import { Assets } from 'pixi.js'
import { accelerator, loadingFoodTypes } from '../../constants'
import { getClosestInstance, getActionCondition } from '../../lib'

const assets = {
  default: {
    standingSheet: '418',
    walkingSheet: '657',
    dyingSheet: '314',
    corpseSheet: '373',
  },
  attack: {
    actionSheet: '224',
    standingSheet: '418',
    dyingSheet: '314', // missing
    walkingSheet: '657',
    corpseSheet: '373', // missing
  },
  hunter: {
    actionSheet: '624',
    harvestSheet: '626',
    standingSheet: '435',
    walkingSheet: '676',
    dyingSheet: '332',
    corpseSheet: '389',
    loadedSheet: '272',
  },
  farmer: {
    actionSheet: '630',
    standingSheet: '430',
    walkingSheet: '670',
    dyingSheet: '326',
    corpseSheet: '388',
  },
  forager: {
    actionSheet: '632',
    standingSheet: '432',
    walkingSheet: '672',
    dyingSheet: '328',
    corpseSheet: '390',
  },
  stoneminer: {
    actionSheet: '633',
    standingSheet: '441',
    walkingSheet: '683',
    dyingSheet: '315', // missing
    corpseSheet: '400',
  },
  goldminer: {
    actionSheet: '633',
    standingSheet: '441',
    walkingSheet: '683',
    dyingSheet: '315', // missing
    corpseSheet: '400',
  },
  woodcutter: {
    actionSheet: '625',
    standingSheet: '440',
    walkingSheet: '682',
    dyingSheet: '315', // missing
    corpseSheet: '399',
  },
  builder: {
    actionSheet: '628',
    standingSheet: '419',
    walkingSheet: '658', // to reupload yellow ?
    dyingSheet: '315',
    corpseSheet: '374',
  },
}

export class Villager extends Unit {
  constructor({ i, j, owner }, context) {
    const type = 'Villager'
    const data = Assets.cache.get('config').units[type]
    const buildings = Assets.cache.get('config').buildings
    const { menu } = context
    const defaultAssets = {}
    for (const [key, value] of Object.entries(assets.default)) {
      defaultAssets[key] = Assets.cache.get(value)
    }
    const children = Object.keys(buildings).map(key => menu.getBuildingButton(key))
    const gatheringRate = {
      forager: 1/0.45,
      hunter: 1/0.4725,
      fisherman: 1/0.6,
      farmer: 1/0.45,
      woodcutter: 1/0.55,
      stoneminer: 1/0.5175,
      goldminer: 1/0.5175,
    }

    super(
      {
        i,
        j,
        owner,
        type,
        gatheringRate,
        ...data,
        speed: data.speed * accelerator,
        ...defaultAssets,
        assets,
        interface: {
          info: element => {
            const { owner } = this
            this.setDefaultInterface(element, data)
            if (owner.isPlayed) {
              element.appendChild(this.getLoadingElement())
            }
          },
          menu: owner.isPlayed
            ? [
                {
                  icon: 'interface/50721/002_50721.png',
                  children,
                },
              ]
            : [],
        },
      },
      context
    )
  }

  updateInterfaceLoading() {
    const {
      context: { menu },
    } = this
    if (this.selected && this.owner.isPlayed && this.owner.selectedUnit === this) {
      if (this.loading === 1) {
        menu.updateInfo('loading', element => (element.innerHTML = this.getLoadingElement().outerHTML))
      } else if (this.loading > 1) {
        menu.updateInfo('loading-text', element => (element.textContent = this.loading))
      } else {
        menu.updateInfo('loading', element => (element.innerHTML = ''))
      }
    }
  }

  getLoadingElement() {
    const {
      context: { menu },
    } = this
    const loadingDiv = document.createElement('div')
    loadingDiv.className = 'unit-loading'
    loadingDiv.id = 'loading'
    if (this.loading) {
      const iconImg = document.createElement('img')
      iconImg.className = 'unit-loading-icon'
      iconImg.src = menu.icons[loadingFoodTypes.includes(this.loadingType) ? 'food' : this.loadingType]
      const textDiv = document.createElement('div')
      textDiv.id = 'loading-text'
      textDiv.textContent = this.loading
      loadingDiv.appendChild(iconImg)
      loadingDiv.appendChild(textDiv)
    }
    return loadingDiv
  }

  sendToAttack(target) {
    this.updateInterfaceLoading()
    this.work = 'attacker'
    this.actionSheet = Assets.cache.get(assets.attack.actionSheet)
    this.standingSheet = Assets.cache.get(assets.attack.standingSheet)
    if (!this.loading) {
      this.walkingSheet = Assets.cache.get(assets.attack.dyingSheet)
    }
    this.previousDest = null
    return this.sendTo(target, 'attack')
  }

  sendToTakeMeat(target) {
    if (!loadingFoodTypes.includes(this.loadingType)) {
      this.loading = 0
      this.updateInterfaceLoading()
    }
    if (this.work !== 'hunter' || this.action !== 'takemeat') {
      this.work = 'hunter'
      this.actionSheet = Assets.cache.get(assets.hunter.harvestSheet)
      this.standingSheet = Assets.cache.get(assets.hunter.standingSheet)
      if (!this.loading) {
        this.walkingSheet = Assets.cache.get(assets.hunter.walkingSheet)
        this.dyingSheet = Assets.cache.get(assets.hunter.dyingSheet)
        this.corpseSheet = Assets.cache.get(assets.hunter.corpseSheet)
      }
    }
    this.previousDest = null
    return this.sendTo(target, 'takemeat')
  }

  sendToHunt(target) {
    if (!loadingFoodTypes.includes(this.loadingType)) {
      this.loading = 0
      this.updateInterfaceLoading()
    }
    if (this.work !== 'hunter' || this.action !== 'hunt') {
      this.work = 'hunter'
      this.actionSheet = Assets.cache.get(assets.hunter.actionSheet)
      this.standingSheet = Assets.cache.get(assets.hunter.standingSheet)
      if (!this.loading) {
        this.walkingSheet = Assets.cache.get(assets.hunter.walkingSheet)
        this.dyingSheet = Assets.cache.get(assets.hunter.dyingSheet)
        this.corpseSheet = Assets.cache.get(assets.hunter.corpseSheet)
      }
    }
    this.previousDest = null
    return this.sendTo(target, 'hunt')
  }

  sendToDelivery() {
    const {
      context: { map },
    } = this
    let buildingType = null
    const buildings = Assets.cache.get('config').buildings
    for (const [key, value] of Object.entries(buildings)) {
      if (key !== 'TownCenter' && value.accept && value.accept.includes(this.loadingType)) {
        buildingType = key
        break
      }
    }
    const targets = this.owner.buildings.filter(building =>
      getActionCondition(this, building, 'delivery', { buildingType })
    )
    const target = getClosestInstance(this, targets)
    if (this.dest) {
      this.previousDest = this.dest
    } else {
      this.previousDest = map.grid[this.i][this.j]
    }
    this.sendTo(target, 'delivery')
  }

  sendToBuilding(building) {
    if (this.work !== 'builder') {
      this.updateInterfaceLoading()
      this.work = 'builder'
      this.actionSheet = Assets.cache.get(assets.builder.actionSheet)
      if (!this.loading) {
        this.standingSheet = Assets.cache.get(assets.builder.standingSheet)
        this.walkingSheet = Assets.cache.get(assets.builder.walkingSheet)
        this.dyingSheet = Assets.cache.get(assets.builder.dyingSheet)
        this.corpseSheet = Assets.cache.get(assets.builder.corpseSheet)
      }
    }
    this.previousDest = null
    return this.sendTo(building, 'build')
  }

  sendToFarm(farm) {
    if (!loadingFoodTypes.includes(this.loadingType)) {
      this.loading = 0
      this.updateInterfaceLoading()
    }
    if (this.work !== 'farmer') {
      this.work = 'farmer'
      this.actionSheet = Assets.cache.get(assets.farmer.actionSheet)
      if (!this.loading) {
        this.standingSheet = Assets.cache.get(assets.farmer.standingSheet)
        this.walkingSheet = Assets.cache.get(assets.farmer.walkingSheet)
        this.dyingSheet = Assets.cache.get(assets.farmer.dyingSheet)
        this.corpseSheet = Assets.cache.get(assets.farmer.corpseSheet)
      }
    }
    this.previousDest = null
    return this.sendTo(farm, 'farm')
  }

  sendToTree(tree) {
    if (this.work !== 'woodcutter') {
      this.loading = 0
      this.updateInterfaceLoading()
      this.work = 'woodcutter'
      this.actionSheet = Assets.cache.get(assets.woodcutter.actionSheet)
      this.standingSheet = Assets.cache.get(assets.woodcutter.standingSheet)
      this.walkingSheet = Assets.cache.get(assets.woodcutter.walkingSheet)
      this.dyingSheet = Assets.cache.get(assets.woodcutter.dyingSheet)
      this.corpseSheet = Assets.cache.get(assets.woodcutter.corpseSheet)
    }
    this.previousDest = null
    return this.sendTo(tree, 'chopwood')
  }

  sendToBerrybush(berrybush) {
    if (!loadingFoodTypes.includes(this.loadingType)) {
      this.loading = 0
      this.updateInterfaceLoading()
    }
    if (this.work !== 'forager') {
      this.work = 'forager'
      this.actionSheet = Assets.cache.get(assets.forager.actionSheet)
      if (!this.loading) {
        this.standingSheet = Assets.cache.get(assets.forager.standingSheet)
        this.walkingSheet = Assets.cache.get(assets.forager.walkingSheet)
        this.dyingSheet = Assets.cache.get(assets.forager.dyingSheet)
        this.corpseSheet = Assets.cache.get(assets.forager.corpseSheet)
      }
    }
    this.previousDest = null
    return this.sendTo(berrybush, 'forageberry')
  }

  sendToStone(stone) {
    if (this.work !== 'stoneminer') {
      this.loading = 0
      this.updateInterfaceLoading()
      this.work = 'stoneminer'
      this.actionSheet = Assets.cache.get(assets.stoneminer.actionSheet)
      this.standingSheet = Assets.cache.get(assets.stoneminer.standingSheet)
      this.walkingSheet = Assets.cache.get(assets.stoneminer.walkingSheet)
      this.dyingSheet = Assets.cache.get(assets.stoneminer.dyingSheet)
      this.corpseSheet = Assets.cache.get(assets.stoneminer.corpseSheet)
    }
    this.previousDest = null
    return this.sendTo(stone, 'minestone')
  }

  sendToGold(gold) {
    if (this.work !== 'goldminer') {
      this.loading = 0
      this.updateInterfaceLoading()
      this.work = 'goldminer'
      this.actionSheet = Assets.cache.get(assets.goldminer.actionSheet)
      this.standingSheet = Assets.cache.get(assets.goldminer.standingSheet)
      this.walkingSheet = Assets.cache.get(assets.goldminer.walkingSheet)
      this.dyingSheet = Assets.cache.get(assets.goldminer.dyingSheet)
      this.corpseSheet = Assets.cache.get(assets.goldminer.corpseSheet)
    }
    this.previousDest = null
    return this.sendTo(gold, 'minegold')
  }
}
