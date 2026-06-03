const path = require('path')

function buildWebpackEnv(mode = 'development') {
  const isProduction = mode === 'production'

  return {
    mode,
    isProduction,
    isDevelopment: !isProduction,
    buildDir: path.resolve(__dirname, 'build'),
    entryFile: path.resolve(__dirname, 'app/entry.js'),
    htmlTemplate: path.resolve(__dirname, 'public/index.html'),
    staticAssetsDir: path.resolve(__dirname, 'public/assets'),
    devServerPort: Number(process.env.PORT || 8080),
  }
}

module.exports = { buildWebpackEnv }
