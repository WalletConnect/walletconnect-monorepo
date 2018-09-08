function parseRequiredParams(path, prefix, keys) {
  const required = { prefix }
  path = path.replace(`${prefix}-`, '')
  const values = path.split('@')
  keys.forEach((key, idx) => (required[key] = values[idx] || ''))
  return required
}

function parseRequiredFallback(path) {
  let required = {}
  let prefix = ''
  const values = path.split('@')
  values.forEach((value, idx) => {
    if (idx === 0) {
      if (
        value.match(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
        )
      ) {
        prefix = 'wc'
        required.prefix = prefix
        required.sessionId = value
      } else {
        prefix = 'pay'
        required.prefix = prefix
        required.targetAddress = value
      }
    } else if (idx === 1) {
      if (prefix === 'wc') {
        required.version = value
      } else if (prefix === 'pay') {
        required.chainID = value
      }
    }
  })
  return required
}

function parseParamsString(paramsString) {
  if (!paramsString) return {}

  let parameters = {}

  let pairs = (paramsString[0] === '?'
    ? paramsString.substr(1)
    : paramsString
  ).split('&')

  for (let i = 0; i < pairs.length; i++) {
    const key = pairs[i].match(/\w+(?==)/i)
      ? pairs[i].match(/\w+(?==)/i)[0]
      : null
    const value = pairs[i].match(/=.+/i)
      ? pairs[i].match(/=.+/i)[0].substr(1)
      : ''
    if (key) {
      parameters[decodeURIComponent(key)] = decodeURIComponent(value)
    }
  }
  return parameters
}

function parseStandardURI(string) {
  if (!string || typeof string !== 'string') {
    throw new Error('URI is not a string')
  }

  const pathStart = string.indexOf(':')

  const pathEnd = string.indexOf('?')

  const protocol = string.substring(0, pathStart)

  let required = {}

  let path =
    string.indexOf('?') !== -1
      ? string.substring(pathStart + 1, pathEnd)
      : string.substring(pathStart + 1)

  if (path.startsWith('pay')) {
    required = parseRequiredParams(path, 'pay', ['targetAddress', 'chainID'])
  } else if (path.startsWith('wc')) {
    required = parseRequiredParams(path, 'wc', ['sessionId', 'version'])
  } else {
    required = parseRequiredFallback(path)
  }

  const paramsString =
    string.indexOf('?') !== -1 ? string.substring(pathEnd) : ''

  const parameters = parseParamsString(paramsString)

  return { protocol, ...required, ...parameters }
}

export default parseStandardURI
