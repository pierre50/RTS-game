#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const root = path.resolve(__dirname, '../..')
const args = process.argv.slice(2)
const serve = args.includes('--serve')
const portIndex = args.indexOf('--port')
const port = portIndex < 0 ? 8880 : Number(args[portIndex + 1])
if (args.includes('--help')) {
  console.log(
    'pnpm interiors:preview [--serve] [--port 8880]\nGénère reports/interiors/index.html à partir du code et des sprites actuels.'
  )
  process.exit(0)
}
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port') {
    i++
    continue
  }
  if (args[i] !== '--serve') throw new Error(`Option inconnue : ${args[i]}`)
}
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port invalide')
const out = path.join(root, 'reports/interiors')
const compiler = webpack({
  mode: 'development',
  devtool: false,
  context: root,
  entry: path.join(__dirname, 'index.ts'),
  output: { path: out, filename: 'preview.js' },
  resolve: { extensions: ['.ts', '.js', '.json'] },
  module: {
    rules: [
      { test: /\.ts$/, exclude: /node_modules/, use: 'babel-loader' },
      { test: /\.png$/, type: 'asset/inline' },
    ],
  },
  plugins: [new HtmlWebpackPlugin({ template: path.join(__dirname, 'index.html') })],
})
compiler.run((error, stats) => {
  compiler.close(() => {})
  if (error || stats.hasErrors()) {
    console.error(error || stats.toString({ all: false, errors: true }))
    process.exitCode = 1
    return
  }
  console.log(`Rapport : ${path.join(out, 'index.html')}`)
  if (!serve) return
  const api = require('./layout-store.cjs').createLayoutApi(port)
  const server = http.createServer(async (req, res) => {
    if (await api(req, res)) return
    const pathname = new URL(req.url, 'http://localhost').pathname
    const file =
      pathname === '/' || pathname === '/index.html' ? 'index.html' : pathname === '/preview.js' ? 'preview.js' : null
    if (!file) {
      res.writeHead(404).end()
      return
    }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    fs.createReadStream(path.join(out, file)).pipe(res)
  })
  server.on('error', error => {
    console.error(error.message)
    process.exitCode = 1
  })
  server.listen(port, '127.0.0.1', () => console.log(`Aperçu : http://127.0.0.1:${port}`))
})
