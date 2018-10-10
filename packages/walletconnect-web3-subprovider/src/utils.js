/* global Promise */

export function promisify(originalFn, thisArg) {
  const promisifiedFunction = async(...callArgs) => {
    return new Promise((resolve, reject) => {
      const callback = (err, data) => {
        err === null ? resolve(data) : reject(err)
      }
      originalFn.apply(thisArg, [...callArgs, callback])
    })
  }
  return promisifiedFunction
}
