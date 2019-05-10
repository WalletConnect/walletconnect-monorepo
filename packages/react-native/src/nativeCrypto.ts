import crypto from 'crypto'
import EthCrypto from 'eth-crypto'

import {
  IJsonRpcRequest,
  IJsonRpcResponseSuccess,
  IJsonRpcResponseError,
  IEncryptionPayload,
  IKeyPair,
  IKeyPairEncryptionPayload
} from '@walletconnect/types'

import {
  convertHexToArrayBuffer,
  convertArrayBufferToBuffer,
  convertUtf8ToBuffer,
  convertBufferToUtf8,
  convertBufferToHex,
  convertHexToBuffer,
  concatBuffers
} from '@walletconnect/utils'

const AES_ALGORITHM = 'AES-256-CBC'
const HMAC_ALGORITHM = 'SHA256'

export function randomBytes (length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(length, (error: any, result: any) => {
      if (error) {
        reject(error)
      }
      resolve(result)
    })
  })
}

export async function generateKey (length?: number): Promise<ArrayBuffer> {
  const _length = (length || 256) / 8
  const buffer: Buffer = await randomBytes(_length)
  const hex = convertBufferToHex(buffer)
  const result = convertHexToArrayBuffer(hex)

  return result
}

export async function createHmac (data: Buffer, key: Buffer): Promise<Buffer> {
  const hmac = crypto.createHmac(HMAC_ALGORITHM, key)
  hmac.update(data)
  const hex = hmac.digest('hex')
  const result = convertHexToBuffer(hex)

  return result
}

export async function verifyHmac (
  payload: IEncryptionPayload,
  key: Buffer
): Promise<boolean> {
  const cipherText: Buffer = convertHexToBuffer(payload.data)
  const iv: Buffer = convertHexToBuffer(payload.iv)
  const hmac: Buffer = convertHexToBuffer(payload.hmac)
  const hmacHex: string = convertBufferToHex(hmac)
  const unsigned: Buffer = concatBuffers(cipherText, iv)
  const chmac: Buffer = await createHmac(unsigned, key)
  const chmacHex: string = convertBufferToHex(chmac)

  if (hmacHex === chmacHex) {
    return true
  }

  return false
}

export async function aesCbcEncrypt (
  data: Buffer,
  key: Buffer,
  iv: Buffer
): Promise<Buffer> {
  const encoding = 'hex'
  const input: any = data.toString(encoding)
  const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv)
  let encrypted = cipher.update(input, encoding, encoding)
  encrypted += cipher.final(encoding)
  const result = new Buffer(encrypted, encoding)
  return result
}

export async function aesCbcDecrypt (
  data: Buffer,
  key: Buffer,
  iv: Buffer
): Promise<Buffer> {
  const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv)
  let decrypted = decipher.update(data)
  decrypted = concatBuffers(decrypted, decipher.final())
  const result = decrypted
  return result
}

export async function encrypt (
  data: IJsonRpcRequest | IJsonRpcResponseSuccess | IJsonRpcResponseError,
  key: ArrayBuffer
): Promise<IEncryptionPayload> {
  const _key: Buffer = convertArrayBufferToBuffer(key)

  const ivArrayBuffer: ArrayBuffer = await generateKey(128)
  const iv: Buffer = convertArrayBufferToBuffer(ivArrayBuffer)
  const ivHex: string = convertBufferToHex(iv)

  const contentString: string = JSON.stringify(data)
  const content: Buffer = convertUtf8ToBuffer(contentString)

  const cipherText: Buffer = await aesCbcEncrypt(content, _key, iv)
  const cipherTextHex: string = convertBufferToHex(cipherText)

  const unsigned: Buffer = concatBuffers(cipherText, iv)
  const hmac: Buffer = await createHmac(unsigned, _key)
  const hmacHex: string = convertBufferToHex(hmac)

  return {
    data: cipherTextHex,
    hmac: hmacHex,
    iv: ivHex
  }
}

export async function decrypt (
  payload: IEncryptionPayload,
  key: ArrayBuffer
): Promise<
  IJsonRpcRequest | IJsonRpcResponseSuccess | IJsonRpcResponseError | null
> {
  const _key: Buffer = convertArrayBufferToBuffer(key)

  if (!_key) {
    throw new Error('Missing key: required for decryption')
  }

  const verified: boolean = await verifyHmac(payload, _key)
  if (!verified) {
    return null
  }

  const cipherText: Buffer = convertHexToBuffer(payload.data)
  const iv: Buffer = convertHexToBuffer(payload.iv)
  const buffer: Buffer = await aesCbcDecrypt(cipherText, _key, iv)
  const utf8: string = convertBufferToUtf8(buffer)
  let data: IJsonRpcRequest
  try {
    data = JSON.parse(utf8)
  } catch (error) {
    throw new Error(`Failed to parse invalid JSON`)
  }

  return data
}

export async function generateKeyPair(): Promise<IKeyPair> {
  const identity = await EthCrypto.createIdentity()
  const keyPair: IKeyPair = {
    privateKey: sanitizeHex(identity.privateKey),
    publicKey: sanitizeHex(identity.publicKey)
  }
  return keyPair
}

export async function encryptWithPublicKey (
  publicKey: ArrayBuffer,
  message: ArrayBuffer
): Promise<IKeyPairEncryptionPayload> {
  const encrypted = await EthCrypto.encryptWithPublicKey(
    convertArrayBufferToHex(publicKey),
    convertArrayBufferToUtf8(message)
  )
  return encrypted
}

export async function decryptWithPrivateKey (
  privateKey: ArrayBuffer,
  encryptedMessage: IKeyPairEncryptionPayload
): Promise<ArrayBuffer> {
  const decrypted = await EthCrypto.decryptWithPrivateKey(
    convertArrayBufferToHex(privateKey),
    encryptedMessage
  )
  return convertUtf8ToArrayBuffer(decrypted)
}

export async function sign (
  privateKey: ArrayBuffer,
  message: ArrayBuffer
): Promise<ArrayBuffer> {
  const signature = await EthCrypto.sign(
    convertArrayBufferToHex(privateKey),
    EthCrypto.hash.keccak256(convertArrayBufferToUtf8(message))
  )
  return convertHexToArrayBuffer(signature)
}

export async function recoverPublicKey (
  signature: ArrayBuffer,
  message: ArrayBuffer
): Promise<ArrayBuffer> {
  const publicKey = await EthCrypto.recoverPublicKey(
    convertArrayBufferToHex(signature),
    EthCrypto.hash.keccak256(convertArrayBufferToUtf8(message))
  )
  return convertHexToArrayBuffer(publicKey)
}
