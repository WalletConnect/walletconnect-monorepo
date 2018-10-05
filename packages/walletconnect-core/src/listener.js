/* global setTimeout clearTimeout */

export default class Listener {
  constructor(opts = {}) {
    if (!opts.fn) {
      throw new Error('Listener fn option is missing')
    }

    if (!opts.cb) {
      throw new Error('Listener cb option is missing')
    }

    this.pollId = null
    this.timeoutId = null

    this.opts = {
      fn: opts.fn,
      cb: opts.cb,
      interval: opts.interval || 1000,
      timeout: opts.timeout || 60000
    }

    this.timeoutId = setTimeout(() => {
      this.stop()
      if (!this._success) {
        this.opts.cb(new Error(), null)
      }
    }, this.opts.timeout)

    this._callFn()
  }

  async _callFn() {
    this.pollId = setTimeout(() => {
      this._callFn()
    }, this.opts.interval)

    try {
      const result = await this.opts.fn()
      if (result) {
        this.stop()
        this._success = true
        this.opts.cb(null, result)
      }
    } catch (err) {
      this.opts.cb(err)
    }
  }

  stop() {
    this.pollId && clearTimeout(this.pollId)
    this.timeoutId && clearTimeout(this.timeoutId)
  }
}
