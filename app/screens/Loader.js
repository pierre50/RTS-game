import { Assets, Container } from 'pixi.js'

/**
 * Loading Screen
 *
 * @exports LoaderScreen
 */

export default class LoaderScreen extends Container {
  constructor() {
    super()
    this.app

    this.loadingDiv = document.createElement('div')
    this.loadingDiv.className = 'loading'
    document.body.prepend(this.loadingDiv)
    this.done = () => {}
  }

  async start() {
    Assets.addBundle('config', {
      config: 'config.json',
    })

    Assets.addBundle('interface', {
      50405: 'interface/50405/texture.json',
    })

    Assets.addBundle('seeds', {
      0: 'seeds/0.txt',
    })

    Assets.addBundle('terrain', {
      15000: 'terrain/15000/texture.json',
      15001: 'terrain/15001/texture.json',
      15002: 'terrain/15002/texture.json',
    })

    Assets.addBundle('border', {
      20000: 'border/20000/texture.json',
      20002: 'border/20002/texture.json',
    })

    const graphics = [
      '64',
      '83',
      '154',
      '155',
      '212',
      '218',
      '224',
      '230',
      '233',
      '235',
      '240',
      '254',
      '261',
      '273',
      '274',
      '280',
      '281',
      '292',
      '293',
      '294',
      '295',
      '296',
      '297',
      '298',
      '299',
      '300',
      '301',
      '314',
      '321',
      '339',
      '347',
      '400',
      '418',
      '419',
      '425',
      '432',
      '440',
      '441',
      '450',
      '452',
      '463',
      '464',
      '465',
      '466',
      '481',
      '489',
      '492',
      '493',
      '494',
      '503',
      '509',
      '527',
      '531',
      '532',
      '533',
      '534',
      '622',
      '623',
      '625',
      '628',
      '632',
      '633',
      '636',
      '657',
      '658',
      '664',
      '672',
      '682',
      '683',
    ]

    Assets.addBundle(
      'graphics',
      graphics.reduce(
        (acc, g) => ({
          ...acc,
          [g]: `graphics/${g}/texture.json`,
        }),
        {}
      )
    )

    this.loadingDiv.innerHTML = 'Loading config..'
    await Assets.loadBundle('config')
    this.loadingDiv.innerHTML = 'Loading interface..'
    await Assets.loadBundle('interface')
    this.loadingDiv.innerHTML = 'Loading seeds..'
    await Assets.loadBundle('seeds')
    this.loadingDiv.innerHTML = 'Loading terrain..'
    await Assets.loadBundle('terrain')
    this.loadingDiv.innerHTML = 'Loading border..'
    await Assets.loadBundle('border')
    this.loadingDiv.innerHTML = 'Loading graphics..'
    await Assets.loadBundle('graphics')

    this.onComplete()
  }

  onComplete() {
    this.loadingDiv.remove()
    this.done()
  }

  onLoaded(callback = () => {}) {
    this.done = callback
  }
}
