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
      globals: { crypto: 'crypto' },
    },
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false,
      }),
      commonjs(), // so Rollup can convert `crypto` to an ES module
      globals(),
      builtins(),
      json(),
      babel({
        exclude: ['node_modules/**'], // only transpile our source code
      }),
      // uglify(),
    ]
  },

  // CommonJS (for Node) and ES module (for bundlers) build.
  // (We could have three entries in the configuration array
  // instead of two, but it's quicker to generate multiple
  // builds from a single configuration where possible, using
  // an array for the `output` option, where we can specify
  // `file` and `format` for each target)
  {
    input: 'src/index.js',
    external: ['crypto'],
    output: [
      { file: pkg.main, format: 'cjs' },
      { file: pkg.module, format: 'es' }
    ],
    plugins: [
      resolve({
        preferBuiltins: false,
      }), // so Rollup can find `crypto`
      commonjs(), // so Rollup can convert `crypto` to an ES module
      globals(),
      json(),
    ],
  }
]
