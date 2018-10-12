/* eslint-disable */

const path = require('path')
const pkg = require('./package.json')

module.exports = {
  mode: 'production',
  entry: ['./src/index.js'],
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: `${pkg.name}.js`,
    library: pkg.name,
    libraryTarget: 'commonjs2'
  },
  devtool: 'nosources-source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  }
}
