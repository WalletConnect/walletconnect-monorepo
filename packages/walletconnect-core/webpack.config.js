/* eslint-disable */

const path = require('path')
const pkg = require('./package.json')

module.exports = {
  mode: 'production',
  entry: ['@babel/polyfill', './src/index.js'],
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: `${pkg.name}.js`,
    library: pkg.name,
    libraryTarget: 'commonjs2'
  },
  devtool: 'nosources-source-map',
  externals: {
    crypto: 'crypto',
    Buffer: 'buffer'
  },
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
  },
  node: {
    Buffer: true,
    crypto: true
  }
}
