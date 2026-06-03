const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { buildWebpackEnv } = require('./webpack.env')

module.exports = (_env, argv = {}) => {
  const env = buildWebpackEnv(argv.mode)

  return {
    mode: env.mode,
    entry: env.entryFile,
    output: {
      filename: env.isProduction ? '[name].[contenthash].js' : '[name].js',
      path: env.buildDir,
      clean: true,
    },
    devtool: env.isDevelopment ? 'source-map' : false,
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
        template: env.htmlTemplate,
      }),
      new CopyWebpackPlugin({
        patterns: [{ from: env.staticAssetsDir, to: 'assets' }],
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
      minimize: env.isProduction,
    },
    devServer: {
      static: {
        directory: env.buildDir,
      },
      compress: true,
      port: env.devServerPort,
      hot: true,
      historyApiFallback: true,
    },
  }
}
