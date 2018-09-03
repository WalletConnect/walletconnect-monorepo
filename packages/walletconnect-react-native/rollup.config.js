/* global require */
const resolve = require('rollup-plugin-node-resolve')
const commonjs = require('rollup-plugin-commonjs')
const globals = require('rollup-plugin-node-globals')
const builtins = require('rollup-plugin-node-builtins')
const json = require('rollup-plugin-json')
const babel = require('rollup-plugin-babel')
// const uglify = require('rollup-plugin-uglify')

const pkg = require('./package.json')

export default [
  // browser-friendly UMD build
  {
    input: 'src/index.js',
    external: ['crypto'],
    output: {
      name: pkg.name,
      file: pkg.browser,
      format: 'umd',
      globals: { crypto: 'crypto' }
    },
    plugins: [
      resolve({
        modulesOnly: true,
        browser: true,
        preferBuiltins: false
      }),
      commonjs(), // so Rollup can convert `crypto` to an ES module
      globals(),
      builtins(),
      json(),
      babel({
        exclude: ['node_modules/**'] // only transpile our source code
      })
      // uglify(),
    ]
  },

  // CommonJS (for Node) and ES module (for bundlers) build.
  {
    input: 'src/index.js',
    external: ['crypto'],
    output: [
      { file: pkg.main, format: 'cjs' },
      { file: pkg.module, format: 'es' }
    ],
    plugins: [
      resolve({
        modulesOnly: true,
        preferBuiltins: false
      }), // so Rollup can find `crypto`
      commonjs(), // so Rollup can convert `crypto` to an ES module
      globals(),
      json()
    ]
  }
]
