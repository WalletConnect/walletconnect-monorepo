import BigNumber from 'bignumber.js'
import {
  isHexString as _isHexString,
  hexlify,
  arrayify
} from '@ethersproject/bytes'
import { getAddress } from '@ethersproject/address'
import { toUtf8Bytes, toUtf8String } from '@ethersproject/strings'

import {
  ITxData,
  IClientMeta,
  IParseURIResult,
  IRequiredParamsResult,
  IQueryParamsResult,
  IJsonRpcResponseSuccess,
  IJsonRpcResponseError,
  IJsonRpcErrorMessage
} from '@walletconnect/types'

// -- ArrayBuffer ------------------------------------------ //

export function convertArrayBufferToBuffer (arrayBuffer: ArrayBuffer): Buffer {
  const hex = convertArrayBufferToHex(arrayBuffer)
  const result = convertHexToBuffer(hex)
  return result
}

export function convertArrayBufferToUtf8 (arrayBuffer: ArrayBuffer): string {
  const utf8 = toUtf8String(new Uint8Array(arrayBuffer))
  return utf8
}

export function convertArrayBufferToHex (
  arrayBuffer: ArrayBuffer,
  noPrefix?: boolean
): string {
  let hex = hexlify(new Uint8Array(arrayBuffer))
  if (noPrefix) {
    hex = removeHexPrefix(hex)
  }
  return hex
}

export function convertArrayBufferToNumber (arrayBuffer: ArrayBuffer): number {
  const hex = convertArrayBufferToHex(arrayBuffer)
  const num = convertHexToNumber(hex)
  return num
}

export function concatArrayBuffers (...args: ArrayBuffer[]): ArrayBuffer {
  const hex: string = args.map(b => convertArrayBufferToHex(b, true)).join('')
  const result: ArrayBuffer = convertHexToArrayBuffer(hex)
  return result
}

// -- Buffer ----------------------------------------------- //

export function convertBufferToArrayBuffer (buffer: Buffer): ArrayBuffer {
  const hex = convertBufferToHex(buffer)
  const result = convertHexToArrayBuffer(hex)
  return result
}

export function convertBufferToUtf8 (buffer: Buffer): string {
  const result = buffer.toString('utf8')
  return result
}

export function convertBufferToHex (buffer: Buffer, noPrefix?: boolean): string {
  let hex = buffer.toString('hex')
  if (!noPrefix) {
    hex = addHexPrefix(hex)
  }
  return hex
}

export function convertBufferToNumber (buffer: Buffer): number {
  const hex = convertBufferToHex(buffer)
  const num = convertHexToNumber(hex)
  return num
}

export function concatBuffers (...args: Buffer[]): Buffer {
  const hex: string = args.map(b => convertBufferToHex(b, true)).join('')
  const result: Buffer = convertHexToBuffer(hex)
  return result
}

// -- Utf8 ------------------------------------------------- //

export function convertUtf8ToArrayBuffer (utf8: string): ArrayBuffer {
  const arrayBuffer = toUtf8Bytes(utf8).buffer
  return arrayBuffer
}

export function convertUtf8ToBuffer (utf8: string): Buffer {
  const result = new Buffer(utf8, 'utf8')
  return result
}

export function convertUtf8ToHex (utf8: string, noPrefix?: boolean): string {
  const arrayBuffer = convertUtf8ToArrayBuffer(utf8)
  const hex = convertArrayBufferToHex(arrayBuffer, noPrefix)
  return hex
}

export function convertUtf8ToNumber (utf8: string): number {
  const num = new BigNumber(utf8).toNumber()
  return num
}

// -- Number ----------------------------------------------- //

export function convertNumberToBuffer (num: number): Buffer {
  const hex = convertNumberToHex(num)
  const buffer = convertHexToBuffer(hex)
  return buffer
}

export function convertNumberToArrayBuffer (num: number): ArrayBuffer {
  const hex = convertNumberToHex(num)
  const arrayBuffer = convertHexToArrayBuffer(hex)
  return arrayBuffer
}

export function convertNumberToUtf8 (num: number): string {
  const utf8 = new BigNumber(num).toString()
  return utf8
}

export function convertNumberToHex (
  num: number | string,
  noPrefix?: boolean
): string {
  let hex = new BigNumber(num).toString(16)
  hex = sanitizeHex(hex)
  if (noPrefix) {
    hex = removeHexPrefix(hex)
  }
  return hex
}

// -- Hex -------------------------------------------------- //

export function convertHexToBuffer (hex: string): Buffer {
  hex = removeHexPrefix(hex)
  const buffer = new Buffer(hex, 'hex')
  return buffer
}

export function convertHexToArrayBuffer (hex: string): ArrayBuffer {
  hex = addHexPrefix(hex)
  const arrayBuffer = arrayify(hex).buffer
  return arrayBuffer
}

export function convertHexToUtf8 (hex: string): string {
  const arrayBuffer = convertHexToArrayBuffer(hex)
  const utf8 = convertArrayBufferToUtf8(arrayBuffer)
  return utf8
}

export function convertHexToNumber (hex: string): number {
  const num = new BigNumber(hex).toNumber()
  return num
}

// -- Misc ------------------------------------------------- //

export function sanitizeHex (hex: string): string {
  hex = removeHexPrefix(hex)
  hex = hex.length % 2 !== 0 ? '0' + hex : hex
  if (hex) {
    hex = addHexPrefix(hex)
  }
  return hex
}

export function addHexPrefix (hex: string): string {
  if (hex.toLowerCase().substring(0, 2) === '0x') {
    return hex
  }
  return '0x' + hex
}

export function removeHexPrefix (hex: string): string {
  if (hex.toLowerCase().substring(0, 2) === '0x') {
    return hex.substring(2)
  }
  return hex
}

export function isHexString (value: any): boolean {
  return _isHexString(value)
}

export function isEmptyString (value: string): boolean {
  return value === '' || (typeof value === 'string' && value.trim() === '')
}

export function payloadId (): number {
  const datePart: number = new Date().getTime() * Math.pow(10, 3)
  const extraPart: number = Math.floor(Math.random() * Math.pow(10, 3))
  const id: number = datePart + extraPart
  return id
}

export function uuid (): string {
  const result: string = ((a?: any, b?: any) => {
    for (
      b = a = '';
      a++ < 36;
      b +=
        (a * 51) & 52
          ? (a ^ 15 ? 8 ^ (Math.random() * (a ^ 20 ? 16 : 4)) : 4).toString(16)
          : '-'
    ) {
      // empty
    }
    return b
  })()
  return result
}

export const toChecksumAddress = (address: string) => {
  return getAddress(address)
}

export const isValidAddress = (address?: string) => {
  if (!address) {
    return false
  } else if (address.toLowerCase().substring(0, 2) !== '0x') {
    return false
  } else if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
    return false
  } else if (
    /^(0x)?[0-9a-f]{40}$/.test(address) ||
    /^(0x)?[0-9A-F]{40}$/.test(address)
  ) {
    return true
  } else {
    return address === toChecksumAddress(address)
  }
}

export function getMeta (): IClientMeta | null {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof window.location === 'undefined'
  ) {
    return null
  }

  function getIcons (): string[] {
    const links: HTMLCollectionOf<
    HTMLLinkElement
    > = document.getElementsByTagName('link')
    const icons: string[] = []

    for (let i = 0; i < links.length; i++) {
      const link: HTMLLinkElement = links[i]

      const rel: string | null = link.getAttribute('rel')
      if (rel) {
        if (rel.toLowerCase().indexOf('icon') > -1) {
          const href: string | null = link.getAttribute('href')

          if (href) {
            if (
              href.toLowerCase().indexOf('https:') === -1 &&
              href.toLowerCase().indexOf('http:') === -1 &&
              href.indexOf('//') !== 0
            ) {
              let absoluteHref: string =
                window.location.protocol + '//' + window.location.host

              if (href.indexOf('/') === 0) {
                absoluteHref += href
              } else {
                const path: string[] = window.location.pathname.split('/')
                path.pop()
                const finalPath: string = path.join('/')
                absoluteHref += finalPath + '/' + href
              }

              icons.push(absoluteHref)
            } else if (href.indexOf('//') === 0) {
              const absoluteUrl: string = window.location.protocol + href

              icons.push(absoluteUrl)
            } else {
              icons.push(href)
            }
          }
        }
      }
    }

    return icons
  }

  function getMetaOfAny (...args: string[]): string {
    const metaTags: HTMLCollectionOf<
    HTMLMetaElement
    > = document.getElementsByTagName('meta')

    for (let i = 0; i < metaTags.length; i++) {
      const tag: HTMLMetaElement = metaTags[i]
      const attributes: Array<string | null> = ['itemprop', 'property', 'name']
        .map(target => tag.getAttribute(target))
        .filter(attr => {
          if (attr) {
            args.includes(attr)
          }
        })

      if (attributes.length && attributes) {
        const content: string | null = tag.getAttribute('content')
        if (content) {
          return content
        }
      }
    }

    return ''
  }

  function getName (): string {
    let name: string = getMetaOfAny(
      'name',
      'og:site_name',
      'og:title',
      'twitter:title'
    )

    if (!name) {
      name = document.title
    }

    return name
  }

  function getDescription (): string {
    const description: string = getMetaOfAny(
      'description',
      'og:description',
      'twitter:description',
      'keywords'
    )

    return description
  }

  const name: string = getName()
  const description: string = getDescription()
  const url: string = window.location.origin
  const icons: string[] = getIcons()

  const meta: IClientMeta = {
    description,
    url,
    icons,
    name
  }

  return meta
}

export function parseQueryString (queryString: string): any {
  const result: any = {}

  const pairs = (queryString[0] === '?'
    ? queryString.substr(1)
    : queryString
  ).split('&')

  for (let i = 0; i < pairs.length; i++) {
    const keyArr: string[] = pairs[i].match(/\w+(?==)/i) || []
    const valueArr: string[] = pairs[i].match(/=.+/i) || []
    if (keyArr[0]) {
      result[decodeURIComponent(keyArr[0])] = decodeURIComponent(
        valueArr[0].substr(1)
      )
    }
  }

  return result
}

export function parseWalletConnectUri (str: string): IParseURIResult {
  const pathStart: number = str.indexOf(':')

  const pathEnd: number | undefined =
    str.indexOf('?') !== -1 ? str.indexOf('?') : undefined

  const protocol: string = str.substring(0, pathStart)

  const path: string = str.substring(pathStart + 1, pathEnd)

  function parseRequiredParams (path: string): IRequiredParamsResult {
    const separator = '@'

    const values = path.split(separator)

    const requiredParams = {
      handshakeTopic: values[0],
      version: parseInt(values[1], 10)
    }

    return requiredParams
  }

  const requiredParams: IRequiredParamsResult = parseRequiredParams(path)

  const queryString: string =
    typeof pathEnd !== 'undefined' ? str.substr(pathEnd) : ''

  function parseQueryParams (queryString: string): IQueryParamsResult {
    const result = parseQueryString(queryString)

    const parameters: IQueryParamsResult = {
      key: result.key || '',
      bridge: result.bridge || ''
    }

    return parameters
  }

  const queryParams: IQueryParamsResult = parseQueryParams(queryString)

  const result: IParseURIResult = {
    protocol,
    ...requiredParams,
    ...queryParams
  }

  return result
}

export function promisify (
  originalFn: (...args: any[]) => void,
  thisArg?: any
): (
    ...callArgs: any[]
  ) => Promise<IJsonRpcResponseSuccess | IJsonRpcResponseError> {
  const promisifiedFunction = async (
    ...callArgs: any[]
  ): Promise<IJsonRpcResponseSuccess | IJsonRpcResponseError> => {
    return new Promise((resolve, reject) => {
      const callback = (
        err: Error | null,
        data: IJsonRpcResponseSuccess | IJsonRpcResponseError
      ) => {
        if (err === null || typeof err === 'undefined') {
          reject(err)
        }
        resolve(data)
      }
      originalFn.apply(thisArg, [...callArgs, callback])
    })
  }
  return promisifiedFunction
}

export function parsePersonalSign (params: string[]): string[] {
  if (!isHexString(params[0])) {
    params[0] = convertUtf8ToHex(params[0])
  }
  return params
}

export function parseTransactionData (
  txData: Partial<ITxData>
): Partial<ITxData> {
  if (typeof txData.from === 'undefined' || !isValidAddress(txData.from)) {
    throw new Error(`Transaction object must include a valid 'from' value.`)
  }

  function parseHexValues (value: number | string) {
    let result = value
    if (
      typeof value === 'number' ||
      (typeof value === 'string' && !isEmptyString(value))
    ) {
      if (!isHexString(value)) {
        result = convertNumberToHex(value)
      } else if (typeof value === 'string') {
        result = sanitizeHex(value)
      }
    }
    return result
  }

  const txDataRPC = {
    from: sanitizeHex(txData.from),
    to: typeof txData.to === 'undefined' ? '' : sanitizeHex(txData.to),
    gasPrice:
      typeof txData.gasPrice === 'undefined'
        ? ''
        : parseHexValues(txData.gasPrice),
    gasLimit:
      typeof txData.gasLimit === 'undefined'
        ? typeof txData.gas === 'undefined'
          ? ''
          : parseHexValues(txData.gas)
        : parseHexValues(txData.gasLimit),
    value:
      typeof txData.value === 'undefined' ? '' : parseHexValues(txData.value),
    nonce:
      typeof txData.nonce === 'undefined' ? '' : parseHexValues(txData.nonce),
    data:
      typeof txData.data === 'undefined' ? '' : sanitizeHex(txData.data) || '0x'
  }

  const prunable = ['gasPrice', 'gasLimit', 'value', 'nonce']
  Object.keys(txDataRPC).forEach((key: string) => {
    if (!txDataRPC[key].trim().length && prunable.includes(key)) {
      delete txDataRPC[key]
    }
  })

  return txDataRPC
}

export function formatRpcError (
  error: Partial<IJsonRpcErrorMessage>
): { code: number; message: string } {
  const message = error.message || 'Failed or Rejected Request'
  let code: number = -32000
  if (error && !error.code) {
    switch (message) {
      case 'Parse error':
        code = -32700
        break
      case 'Invalid request':
        code = -32600
        break
      case 'Method not found':
        code = -32601
        break
      case 'Invalid params':
        code = -32602
        break
      case 'Internal error':
        code = -32603
        break
      default:
        code = -32000
        break
    }
  }
  const result = {
    code,
    message
  }
  return result
}
