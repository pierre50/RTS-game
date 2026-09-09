const fs = require('node:fs')
const path = require('node:path')
// Each test worker owns its output; the parent merges counters after all workers exit.
process.on('exit', () => {
  if (process.env.HEALTH_COVERAGE_DIR && global.__coverage__) {
    fs.writeFileSync(
      path.join(process.env.HEALTH_COVERAGE_DIR, `${process.pid}.json`),
      JSON.stringify(global.__coverage__)
    )
  }
})
