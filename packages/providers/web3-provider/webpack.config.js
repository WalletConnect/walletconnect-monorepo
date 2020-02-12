const path = require('path')

module.exports = {
  mode: 'production',
  entry: {
    index: path.resolve(__dirname, 'dist', 'es6', 'index.js')
  },
  output: {
    path: path.resolve(__dirname, 'dist', 'umd'),
    filename: '[name].min.js',
    libraryTarget: 'umd',
    library: 'WalletConnectProvider',
    umdNamedDefine: true,
    globalObject: 'this'
  }
}
