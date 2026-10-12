const { loadTsModule } = require('./loadTsModule.cjs')

function attachWindowControls(instance) {
  const { GameWindowControls } = loadTsModule('app/lib/ui/GameWindowControls.ts', {
    mocks: { '../lang': { t: key => key }, '../audio/settings': {} },
  })
  instance.controls = new GameWindowControls(instance)
  return instance
}
module.exports = { attachWindowControls }
