function parseRequiredParams(path) {
  const config = {
    erc681: {
      prefix: 'pay',
      separators: ['@', '/'],
      keys: ['targetAddress', 'chainId', 'functionName']
    },
    erc1328: {
      prefix: 'wc',
      separators: ['@'],
      keys: ['sessionId', 'version']
    }
  }

  let standard = ''

  if (path.startsWith('pay')) {
    standard = 'erc681'
  } else if (path.startsWith('wc')) {
    standard = 'erc1328'
  } else if (
    path.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)
  ) {
    standard = 'erc1328'
  } else {
    standard = 'erc681'
  }

  const requiredParams = { prefix: config[standard].prefix }

  path = path.replace(`${config[standard].prefix}-`, '')

  const indexes = []

  config[standard].separators.reverse().forEach((separator, idx, arr) => {
    let fallback
    if (idx === arr.length) {
      fallback = path.length
    } else {
      fallback = indexes[0]
    }
    let index =
      path.indexOf(separator) && path.indexOf(separator) !== -1
        ? path.indexOf(separator)
        : fallback
    indexes.unshift(index)
  })

  config[standard].keys.forEach((key, idx, arr) => {
    let startIndex = idx !== 0 ? indexes[idx - 1] + 1 : 0
    let endIndex = idx !== arr.length ? indexes[idx] : null
    requiredParams[key] =
      idx !== 0 && indexes[idx - 1] === indexes[idx]
        ? ''
        : path.substring(startIndex, endIndex)
  })

  return requiredParams
}

function parseQueryParams(queryString) {
  if (!queryString) return {}

  let parameters = {}

  let pairs = (queryString[0] === '?'
    ? queryString.substr(1)
    : queryString
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

  let path =
    string.indexOf('?') !== -1
      ? string.substring(pathStart + 1, pathEnd)
      : string.substring(pathStart + 1)

  let requiredParams = parseRequiredParams(path)

  const queryString =
    string.indexOf('?') !== -1 ? string.substring(pathEnd) : ''

  const queryParams = parseQueryParams(queryString)

  return { protocol, ...requiredParams, ...queryParams }
}

export default parseStandardURI
