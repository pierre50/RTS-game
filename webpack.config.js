var path = require('path')
var DEBUG = process.env.NODE_ENV !== 'production'
const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
  entry: {
    index: ['./app/entry.js'],
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'build'),
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [{ from: 'public' }],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/,
        use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
      },
      {
        test: /\.html$/,
        use: {
          loader: 'file-loader',
          options: {
            name: 'index.html',
          },
        },
      },
      {
        test: /\.jpe?g$|\.svg$|\.png$/,
        use: {
          loader: 'file-loader',
        },
      },
      {
        test: /\.(shader|vert|frag|geom)$/i,
        use: 'raw-loader',
      },
    ],
  },
  devServer: {
    static: path.join(__dirname, 'build'),
    compress: true,
    port: 8080,
  },
  mode: DEBUG ? 'development' : 'production',
  devtool: DEBUG ? 'source-map' : false,
}
