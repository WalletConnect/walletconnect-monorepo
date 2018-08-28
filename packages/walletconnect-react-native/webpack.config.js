/* global __dirname, require, module */

const webpack = require('webpack')
const path = require('path')
const env = require('yargs').argv.env // use --env with webpack 2
const pkg = require('./package.json')

let libraryName = pkg.name

let outputFile

if (env === 'build') {
  outputFile = `${libraryName}.min.js`
} else {
  outputFile = `${libraryName}.js`
}

const config = {
  entry: [__dirname + '/src/index.js'],
  mode: env === 'build' ? 'production' : 'development',
  devtool: env === 'build' ? 'source-map' : 'inline-source-map',
  externals: {
    crypto: 'crypto'
  },
  output: {
    path: __dirname + '/dist',
    filename: outputFile,
    library: libraryName,
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  module: {
    rules: [
      {
        test: /(\.jsx|\.js)$/,
        loader: 'babel-loader',
        exclude: /(node_modules|bower_components)/
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
