/* eslint-disable */

var path = require('path')

module.exports = {
  mode: 'production',
  entry: ['@babel/polyfill', './src/index.js'],
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'walletconnect.js',
    library: 'walletconnect',
    libraryTarget: 'commonjs2'
  },
  module: {
    rules: [{ test: /\.(js)$/, use: 'babel-loader' }]
  },
  node: {
    Buffer: true,
    crypto: true
  }
}
