const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

const DEBUG = process.env.NODE_ENV !== 'production'

module.exports = {
  entry: './app/entry.js',
  output: {
    filename: DEBUG ? '[name].js' : '[name].[contenthash].js',
    path: path.resolve(__dirname, 'build'),
    clean: true,
  },
  mode: DEBUG ? 'development' : 'production',
  devtool: DEBUG ? 'source-map' : false,
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(jpe?g|png|svg)$/,
        type: 'asset/resource',
      },
      {
        test: /\.(shader|vert|frag|geom)$/i,
        use: 'raw-loader',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
    new CopyWebpackPlugin({
      patterns: [{ from: 'public/assets', to: 'assets' }],
    }),
  ],
  optimization: {
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: Infinity,
      minSize: 20000,
      cacheGroups: {
        pixi: {
          test: /[\\/]node_modules[\\/]pixi\.js[\\/]/,
          name: 'pixi',
          chunks: 'all',
        },
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
    runtimeChunk: 'single',
    minimize: !DEBUG,
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'build'),
    },
    compress: true,
    port: 8080,
    hot: true,
    historyApiFallback: true,
  },
}
