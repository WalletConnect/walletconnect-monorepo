/* global __dirname, require, module */

const path = require('path')
const env = require('yargs').argv.env // use --env with webpack 2
const pkg = require('./package.json')

const libraryName = pkg.name

// let plugins = []
let outputFile

if (env === 'build') {
  outputFile = `${libraryName}.min.js`
} else {
  outputFile = `${libraryName}.js`
}

const config = {
  entry: [path.join(__dirname, '/src/index.js')],
  mode: env === 'build' ? 'production' : 'development',
  devtool: env === 'build' ? 'source-map' : 'inline-source-map',
  output: {
    path: path.join(__dirname, '/dist'),
    filename: outputFile,
    library: 'WalletConnect',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  module: {
    rules: [
      {
        test: /(\.jsx|\.js)$/,
        loader: 'babel-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    modules: [path.resolve('./node_modules'), path.resolve('./src')],
    extensions: ['.json', '.js']
  },
  plugins: []
}

module.exports = config
