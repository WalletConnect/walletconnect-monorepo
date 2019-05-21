import 'mocha'

import { expect } from 'chai'

import {
  //   convertArrayBufferToBuffer,
  // convertArrayBufferToUtf8,
  convertArrayBufferToHex,
  // convertArrayBufferToNumber,
  // convertBufferToArrayBuffer,
  // convertBufferToUtf8,
  convertBufferToHex,
  // convertBufferToNumber,
  // convertUtf8ToArrayBuffer,
  // convertUtf8ToBuffer,
  convertUtf8ToHex,
  // convertUtf8ToNumber,
  // convertNumberToBuffer,
  // convertNumberToArrayBuffer,
  // convertNumberToUtf8,
  convertNumberToHex,
  convertHexToBuffer,
  convertHexToArrayBuffer,
  convertHexToUtf8,
  convertHexToNumber
} from '../src/index'

describe('// --------------- @walletconnect/utils --------------- //', () => {
  describe('convertHexToNumber', () => {
    it('returns number', () => {
      const input = '0x03'
      const result = convertHexToNumber(input)
      expect(result).to.be.a('number')
    })
  })
})
