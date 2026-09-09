const fs = require('node:fs')
const path = require('node:path')
const babel = require('@babel/core')
const { createCoverageMap } = require('istanbul-lib-coverage')

const TARGETS = ['app/lib/combat/', 'app/lib/units/', 'app/classes/unit/movement/', 'app/serialization/']
function collectCoverage(root, directory, files) {
  root = fs.realpathSync(root)
  const map = createCoverageMap({})
  const targets = files.filter(file => TARGETS.some(prefix => file.file.startsWith(prefix)))
  if (!targets.length) throw new Error('No critical coverage targets found')
  for (const file of targets) {
    let instrumented = false
    babel.transformFileSync(path.join(root, file.file), {
      envName: 'development',
      babelrc: false,
      configFile: false,
      presets: [
        require.resolve('@babel/preset-env'),
        [require.resolve('@babel/preset-typescript'), { allowDeclareFields: true }],
      ],
      plugins: [
        [
          'babel-plugin-istanbul',
          {
            cwd: root,
            extension: ['.ts'],
            exclude: [],
            onCover: (_filename, coverage) => {
              map.addFileCoverage(coverage)
              instrumented = true
            },
          },
        ],
      ],
    })
    if (!instrumented) throw new Error(`Coverage instrumentation missing: ${file.file}`)
  }
  let workers = 0
  for (const filename of fs.readdirSync(directory).filter(file => file.endsWith('.json'))) {
    const coverage = JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8'))
    for (const [filename, data] of Object.entries(coverage)) {
      if (map.files().includes(filename)) map.merge({ [filename]: data })
    }
    workers++
  }
  if (!workers) throw new Error('No test worker produced coverage')
  const perFile = map
    .files()
    .sort()
    .map(filename => ({
      file: path.relative(root, filename).split(path.sep).join('/'),
      ...map.fileCoverageFor(filename).toSummary().toJSON(),
    }))
  return { targets: TARGETS, workers, summary: map.getCoverageSummary().toJSON(), files: perFile }
}
module.exports = { collectCoverage, TARGETS }
