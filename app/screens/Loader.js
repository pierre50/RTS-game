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
      greek: 'greek.json',
      technology: 'technology.json',
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
      '60',
      '61',
      '62',
      '63',
      '64',
      '65',
      '66',
      '67',
      '68',
      '69',
      '70',
      '71',
      '72',
      '73',
      '75',
      '78',
      '79',
      '80',
      '81',
      '82',
      '83',
      '84',
      '85',
      '86',
      '87',
      '88',
      '89',
      '90',
      '91',
      '92',
      '94',
      '153',
      '154',
      '155',
      '203',
      '205',
      '206',
      '212',
      '215',
      '217',
      '218',
      '219',
      '222',
      '224',
      '227',
      '230',
      '231',
      '232',
      '233',
      '234',
      '235',
      '236',
      '237',
      '239',
      '240',
      '254',
      '256',
      '258',
      '261',
      '272',
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
      '308',
      '311',
      '312',
      '314',
      '315',
      '321',
      '324',
      '326',
      '328',
      '330',
      '331',
      '332',
      '333',
      '336',
      '339',
      '343',
      '347',
      '367',
      '370',
      '371',
      '373',
      '374',
      '380',
      '386',
      '388',
      '389',
      '390',
      '391',
      '392',
      '394',
      '397',
      '399',
      '400',
      '403',
      '413',
      '415',
      '416',
      '418',
      '419',
      '425',
      '428',
      '430',
      '431',
      '432',
      '433',
      '435',
      '436',
      '440',
      '441',
      '445',
      '447',
      '450',
      '452',
      '463',
      '464',
      '465',
      '466',
      '478',
      '479',
      '480',
      '481',
      '489',
      '492',
      '493',
      '494',
      '497',
      '500',
      '503',
      '509',
      '527',
      '531',
      '532',
      '533',
      '534',
      '593',
      '609',
      '622',
      '623',
      '624',
      '625',
      '626',
      '628',
      '630',
      '632',
      '633',
      '636',
      '651',
      '652',
      '654',
      '655',
      '657',
      '658',
      '664',
      '667',
      '670',
      '672',
      '673',
      '676',
      '677',
      '680',
      '682',
      '683',
      '688',
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

    Assets.addBundle('audio', {
      'test': 'audio/test.mp3',
    })

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
    this.loadingDiv.innerHTML = 'Loading Audio..'
    await Assets.loadBundle('audio')


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
