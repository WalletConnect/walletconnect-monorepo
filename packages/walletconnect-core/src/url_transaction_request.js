/*
EIP681: http://eips.ethereum.org/EIPS/eip-681

request                 = "ethereum" ":" [ "pay-" ]target_address [ "@" chain_id ] [ "/" function_name ] [ "?" parameters ]
target_address          = ethereum_address
chain_id                = 1*DIGIT
function_name           = STRING
ethereum_address        = ( "0x" 40*40HEXDIG ) / ENS_NAME
parameters              = parameter *( "&" parameter )
parameter               = key "=" value
key                     = "value" / "gas" / "gasLimit" / "gasPrice" / TYPE
value                   = number / ethereum_address / STRING
number                  = [ "-" / "+" ] *DIGIT [ "." 1*DIGIT ] [ ( "e" / "E" ) [ 1*DIGIT ] [ "+" UNIT ]
*/

export default class URLTransactionRequest {
  static decode(url) {
    let protocol = 'ethereum:'
    let params = ''
    let tmp = decodeURIComponent(url)

    let i = tmp.indexOf('?')
    // first reduction, strip params
    if (i !== -1) {
      params = tmp.substring(i + 1, tmp.length)
      tmp = tmp.substring(0, i)
    }

    // second reduction, strip 'ethereum:' if applicable
    if (tmp.startsWith(protocol)) {
      tmp = tmp.substring(protocol.length, tmp.length)
    }

    // third reduction, strip 'pay-' if applicable
    if (tmp.startsWith('pay-')) {
      tmp = tmp.substring(4, tmp.length)
    }

    // now we should have target_address [ '@' chain_id ] [ '/' function_name ]

    // fourth reduction, strip 'function_name' if applicable
    let functionName = ''
    i = tmp.indexOf('/')
    if (i !== -1) {
      functionName = tmp.substring(i + 1, tmp.length)
      tmp = tmp.substring(0, i)
    }

    // fifth reduction, strip 'chain_id' if applicable
    // https://github.com/ethereum/EIPs/blob/master/EIPS/eip-155.md
    let chainId = 1
    i = tmp.indexOf('@')
    if (i !== -1) {
      chainId = parseInt(tmp.substring(i + 1, tmp.length))
      if (Number.isNaN(chainId)) {
        throw new Error('Expected chain_id to be a Integer')
      }
      tmp = tmp.substring(0, i)
    }

    // now, the only thing left should be 'target_address' or 'ens_name'
    if (!tmp) {
      throw new Error('Expected target_address or ens_name')
    }

    let targetAddress = tmp

    let paramsObj = {}

    if (params) {
      i = 0
      while (i !== -1) {
        let n = params.indexOf('=', i + 1)
        if (n === -1) {
          break
        }
        let key = params.substring(i, n)
        i = n
        n = params.indexOf('&', n + 1)
        if (n === -1) {
          n = params.length
        }

        let value = params.substring(i + 1, n)
        if (key === 'value' ||
            key === 'gasLimit' ||
            key === 'gasPrice' ||
            key === 'gas') {
          // Applications that have no access to the blockchain
          // should refuse accepting requests with a non-empty UNIT, if it is not ETH.
          //
          // If UNIT is ETH, it always means a multiplier of 10^18.
          // If it is something else AND the addressed contract has a symbol field
          // exactly matching this string AND the contract has a decimals field,
          // then 10 to that power is used as a multiplier.
          // Otherwise, the payment request is deemed invalid.
          // Applications that have no access to the blockchain
          // should refuse accepting requests with a non-empty UNIT,
          // if it is not ETH.
          let valueFloat = parseFloat(value)
          if (Number.isNaN(valueFloat)) {
            throw new Error('Parameter \'' + key + '\' must be a Number')
          }

          // multiplication of big numbers
          // is not safe here unless we pull BigInt support.
          let maybeUnitOffset = value.lastIndexOf('+')
          if (maybeUnitOffset > 0) {
            throw new Error('Units are not supported at the moment')
            /*
            let unit = value.substring(maybeUnitOffset + 1, value.length);
            if (unit === 'ETH') {
              valueFloat *= 10 ** 18;
            } else {
              throw new Error('Units other than \'ETH\' are not supported at the moment');
            }
            */
          }

          paramsObj[key] = valueFloat
        } else {
          paramsObj[key] = value
        }

        i = n + 1
      }
    }

    let res = {}
    res['target_address'] = targetAddress
    res['chain_id'] = chainId
    res.parameters = paramsObj

    if (functionName) {
      res['function_name'] = functionName
    }

    return res
  }

  static encode(obj) {
    if (!obj['target_address']) {
      throw new Error('Transactions should at least have a \'target_address\' parameter')
    }

    let res = 'ethereum:' + obj['target_address']

    if (obj['chain_id']) {
      res += '@' + obj['chain_id']
    }

    if (obj.function_name) {
      res += '/' + obj.function_name
    }

    if (obj.parameters) {
      let params = ''
      let keys = Object.keys(obj.parameters)
      while (keys.length) {
        let key = keys.pop()
        let val = obj.parameters[key]
        // do not use Number.toExponential for safety
        params += key + '=' + val.toString()
        if (keys.length) {
          params += '&'
        }
      }
      res += '?' + params
    }

    return encodeURIComponent(res)
  }
}
