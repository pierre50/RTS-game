// Builds an isolated UI review page. No game save or world is loaded.
const path = require('node:path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const root = path.resolve(__dirname, '../..')
webpack(
  {
    mode: 'development',
    context: root,
    entry: path.join(__dirname, 'index.ts'),
    output: { path: path.join(root, 'build/ui-gallery'), filename: 'gallery.js' },
    resolve: { extensions: ['.ts', '.js'] },
    module: {
      rules: [
        { test: /\.ts$/, exclude: /node_modules/, use: 'babel-loader' },
        { test: /\.css$/, use: ['style-loader', 'css-loader'] },
        { test: /\.(png|svg|woff2?|ttf)$/, type: 'asset/resource' },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        title: 'Kaelor — contrôle des interfaces',
        templateContent:
          '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>',
      }),
    ],
  },
  (error, stats) => {
    if (error || stats.hasErrors()) {
      console.error(error || stats.toString({ all: false, errors: true }))
      process.exitCode = 1
    } else console.log('UI gallery built: build/ui-gallery/index.html')
  }
)
