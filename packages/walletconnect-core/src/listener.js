/* global setTimeout clearTimeout */

export default class Listener {
  // options => fn, cb, timeout, pollInterval
  constructor(connector, options = {}) {
    this.pollId = null
    this.timeoutId = null

    // options
    this.options = options

    // stop timeout
    this.timeoutId = setTimeout(() => {
      this.stop()
      if (!this._success) {
        this.options.cb(new Error(), null)
      }
    }, this.options.timeout)

    // call fn
    this._callFn()
  }

  async _callFn() {
    this.pollId = setTimeout(() => {
      this._callFn()
    }, this.options.pollInterval)

    try {
      const result = await this.options.fn()
      if (result) {
        this.stop()
        this._success = true
        this.options.cb(null, result)
      }
    } catch (e) {
      // continue regardless of error
    }
  }

  stop() {
    this.pollId && clearTimeout(this.pollId)
    this.timeoutId && clearTimeout(this.timeoutId)
  }
}
