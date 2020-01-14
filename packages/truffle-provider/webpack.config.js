const path = require('path')

module.exports = {
  mode: 'production',
  entry: {
    index: './src/index.ts'
  },
  output: {
    path: path.resolve(__dirname, 'lib'),
    filename: '[name].js',
    libraryTarget: 'umd',
    library: 'WalletConnectTruffleProvider',
    umdNamedDefine: true,
    globalObject: 'this'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },
  devtool: 'source-map',
  optimization: {
    minimize: true
  },
  module: {
    rules: [{ test: /\.tsx?$/, loader: 'ts-loader' }]
  },
  externals: {
    ora: 'ora',
    web3: 'web3',
    url: 'url',
    crypto: 'crypto',
    ws: 'ws',
    'web3-provider-engine': 'web3-provider-engine',
    'web3-provider-engine/subproviders/filters': 'web3-provider-engine/subproviders/filters',
    'web3-provider-engine/subproviders/nonce-tracker': 'web3-provider-engine/subproviders/nonce-tracker',
    'web3-provider-engine/subproviders/hooked-wallet': 'web3-provider-engine/subproviders/hooked-wallet',
    'web3-provider-engine/subproviders/provider': 'web3-provider-engine/subproviders/provider'
  }
}
