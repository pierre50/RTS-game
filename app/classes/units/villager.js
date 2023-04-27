import { Unit } from './unit'
import { Assets } from 'pixi.js'
import { loadingFoodTypes } from '../../constants'
import { getClosestInstance, getActionCondition } from '../../lib'

const allAssets = {
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
    walkingSheet: '657', // missing
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
    loadedSheet: '672',
  },
  forager: {
    actionSheet: '632',
    standingSheet: '432',
    walkingSheet: '672',
    dyingSheet: '328',
    corpseSheet: '390',
    loadedSheet: '672',
  },
  stoneminer: {
    actionSheet: '633',
    standingSheet: '441',
    walkingSheet: '683',
    dyingSheet: '315', // missing
    corpseSheet: '400',
    loadedSheet: '274',
  },
  goldminer: {
    actionSheet: '633',
    standingSheet: '441',
    walkingSheet: '683',
    dyingSheet: '315', // missing
    corpseSheet: '400',
    loadedSheet: '281',
  },
  woodcutter: {
    actionSheet: '625',
    standingSheet: '440',
    walkingSheet: '682',
    dyingSheet: '315', // missing
    corpseSheet: '399',
    loadedSheet: '273',
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
    const children = Object.keys(buildings).map(key => menu.getBuildingButton(key))
    const gatheringRate = {
      forager: 1 / 0.45,
      hunter: 1 / 0.4725,
      fisherman: 1 / 0.6,
      farmer: 1 / 0.45,
      woodcutter: 1 / 0.55,
      stoneminer: 1 / 0.5175,
      goldminer: 1 / 0.5175,
    }

    super(
      {
        i,
        j,
        owner,
        type,
        gatheringRate,
        ...data,
        assets: allAssets.default,
        allAssets,
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
    this.actionSheet = Assets.cache.get(allAssets.attack.actionSheet)
    this.standingSheet = Assets.cache.get(allAssets.attack.standingSheet)
    if (!this.loading) {
      this.walkingSheet = Assets.cache.get(allAssets.attack.walkingSheet)
      this.dyingSheet = Assets.cache.get(allAssets.attack.dyingSheet)
      this.corpseSheet = Assets.cache.get(allAssets.attack.corpseSheet)
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
      this.actionSheet = Assets.cache.get(allAssets.hunter.harvestSheet)
      this.standingSheet = Assets.cache.get(allAssets.hunter.standingSheet)
      if (!this.loading) {
        this.walkingSheet = Assets.cache.get(allAssets.hunter.walkingSheet)
        this.dyingSheet = Assets.cache.get(allAssets.hunter.dyingSheet)
        this.corpseSheet = Assets.cache.get(allAssets.hunter.corpseSheet)
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
      this.actionSheet = Assets.cache.get(allAssets.hunter.actionSheet)
      this.standingSheet = Assets.cache.get(allAssets.hunter.standingSheet)
      if (!this.loading) {
        this.walkingSheet = Assets.cache.get(allAssets.hunter.walkingSheet)
        this.dyingSheet = Assets.cache.get(allAssets.hunter.dyingSheet)
        this.corpseSheet = Assets.cache.get(allAssets.hunter.corpseSheet)
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
      this.actionSheet = Assets.cache.get(allAssets.builder.actionSheet)
      if (!this.loading) {
        this.standingSheet = Assets.cache.get(allAssets.builder.standingSheet)
        this.walkingSheet = Assets.cache.get(allAssets.builder.walkingSheet)
        this.dyingSheet = Assets.cache.get(allAssets.builder.dyingSheet)
        this.corpseSheet = Assets.cache.get(allAssets.builder.corpseSheet)
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
      this.actionSheet = Assets.cache.get(allAssets.farmer.actionSheet)
      if (!this.loading) {
        this.standingSheet = Assets.cache.get(allAssets.farmer.standingSheet)
        this.walkingSheet = Assets.cache.get(allAssets.farmer.walkingSheet)
        this.dyingSheet = Assets.cache.get(allAssets.farmer.dyingSheet)
        this.corpseSheet = Assets.cache.get(allAssets.farmer.corpseSheet)
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
      this.actionSheet = Assets.cache.get(allAssets.woodcutter.actionSheet)
      this.standingSheet = Assets.cache.get(allAssets.woodcutter.standingSheet)
      this.walkingSheet = Assets.cache.get(allAssets.woodcutter.walkingSheet)
      this.dyingSheet = Assets.cache.get(allAssets.woodcutter.dyingSheet)
      this.corpseSheet = Assets.cache.get(allAssets.woodcutter.corpseSheet)
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
      this.actionSheet = Assets.cache.get(allAssets.forager.actionSheet)
      if (!this.loading) {
        this.standingSheet = Assets.cache.get(allAssets.forager.standingSheet)
        this.walkingSheet = Assets.cache.get(allAssets.forager.walkingSheet)
        this.dyingSheet = Assets.cache.get(allAssets.forager.dyingSheet)
        this.corpseSheet = Assets.cache.get(allAssets.forager.corpseSheet)
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
      this.actionSheet = Assets.cache.get(allAssets.stoneminer.actionSheet)
      this.standingSheet = Assets.cache.get(allAssets.stoneminer.standingSheet)
      this.walkingSheet = Assets.cache.get(allAssets.stoneminer.walkingSheet)
      this.dyingSheet = Assets.cache.get(allAssets.stoneminer.dyingSheet)
      this.corpseSheet = Assets.cache.get(allAssets.stoneminer.corpseSheet)
    }
    this.previousDest = null
    return this.sendTo(stone, 'minestone')
  }

  sendToGold(gold) {
    if (this.work !== 'goldminer') {
      this.loading = 0
      this.updateInterfaceLoading()
      this.work = 'goldminer'
      this.actionSheet = Assets.cache.get(allAssets.goldminer.actionSheet)
      this.standingSheet = Assets.cache.get(allAssets.goldminer.standingSheet)
      this.walkingSheet = Assets.cache.get(allAssets.goldminer.walkingSheet)
      this.dyingSheet = Assets.cache.get(allAssets.goldminer.dyingSheet)
      this.corpseSheet = Assets.cache.get(allAssets.goldminer.corpseSheet)
    }
    this.previousDest = null
    return this.sendTo(gold, 'minegold')
  }
}
