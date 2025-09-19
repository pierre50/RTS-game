const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

const DEBUG = process.env.NODE_ENV !== 'production'

module.exports = {
  entry: './app/entry.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'build'),
    clean: true, // nettoie le dossier build à chaque build
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
      template: './public/index.html', // prend ton HTML existant
    }),
    new CopyWebpackPlugin({
      patterns: [{ from: 'public/assets', to: 'assets' }], // si tu as des assets supplémentaires
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'build'), // sert le dossier build
    },
    compress: true,
    port: 8080,
    hot: true,
    historyApiFallback: true, // permet de servir index.html pour toutes les routes (utile pour SPA)
  },
}
