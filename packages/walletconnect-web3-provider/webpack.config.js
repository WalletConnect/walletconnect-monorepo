/* global __dirname, require, module */

const webpack = require('webpack')
const UglifyJsPlugin = webpack.optimize.UglifyJsPlugin
const path = require('path')
const env = require('yargs').argv.env // use --env with webpack 2
const pkg = require('./package.json')

let libraryName = pkg.name
let plugins = []

if (env === 'build') {
  plugins.push(new UglifyJsPlugin({minimize: true}))
}

const config = {
  entry: {
    'web3-provider': __dirname + '/src/web3-provider.js'
  },
  devtool: 'source-map',
  output: {
    path: __dirname + '/lib',
    filename: env === 'build' ? '[name].min.js' : '[name].js',
    library: '[name]',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  module: {
    rules: [
      {
        test: /(\.jsx|\.js)$/,
        loader: 'babel-loader',
        exclude: /(node_modules|bower_components)/
      },
      {
        test: /(\.jsx|\.js)$/,
        loader: 'eslint-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    modules: [path.resolve('./node_modules'), path.resolve('./src')],
    extensions: ['.json', '.js']
  },
  plugins: plugins
}

module.exports = config
