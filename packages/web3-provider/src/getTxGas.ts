import { Query } from './query'
import { sanitizeHex, removeHexPrefix } from '@walletconnect/utils'
import { BN } from 'ethereumjs-util'

const BASE_GAS_COST = 21000

export async function getTxGas (query: Query, txParams) {
  const block = await query.getBlockByNumber('latest', false)
  const { safeGas, simpleSend, gasLimitSpecified } = await safeTxGas(
    query,
    txParams,
    block.gasLimit
  )

  if (simpleSend || gasLimitSpecified) {
    return safeGas
  }

  try {
    const gas = await estimateTxGas(query, txParams, block.gasLimit, safeGas)
    return gas
  } catch (error) {
    return safeGas
  }
}

async function safeTxGas (query: Query, txParams, blockGasLimitHex) {
  // check if gasLimit is already specified
  const gasLimitSpecified = Boolean(txParams.gas)

  // if it is, use that value
  if (gasLimitSpecified) {
    return { safeGas: txParams.gas, simpleSend: false, gasLimitSpecified: true }
  }

  const recipient = txParams.to
  const hasRecipient = Boolean(recipient)

  // see if we can set the gas based on the recipient
  if (hasRecipient) {
    const code = await query.getCode(recipient)
    // For an address with no code, geth will return '0x', and ganache-core v2.2.1 will return '0x0'
    const codeIsEmpty = !code || code === '0x' || code === '0x0'

    if (codeIsEmpty) {
      // if there's data in the params, but there's no contract code, it's not a valid transaction
      if (txParams.data) {
        const err = new Error(
          'Trying to call a function on a non-contract address'
        )
        throw err
      }

      // This is a standard ether simple send, gas requirement is exactly 21k
      return {
        safeGas: bnToHex(BASE_GAS_COST),
        simpleSend: true,
        gasLimitSpecified: false
      }
    }
  }

  // fallback to block gasLimit
  const blockGasLimitBN = hexToBn(blockGasLimitHex)
  const saferGasLimitBN = BnMultiplyByFraction(blockGasLimitBN, 19, 20)
  return {
    safeGas: bnToHex(saferGasLimitBN),
    simpleSend: false,
    gasLimitSpecified: false
  }
}

async function estimateTxGas (
  query: Query,
  txParams: any,
  blockGasLimitHex: any,
  safeGas: any
) {
  txParams.gas = safeGas
  const estimatedGas = sanitizeHex(await query.estimateGas(txParams))
  return addGasBuffer(estimatedGas, blockGasLimitHex)
}

function addGasBuffer (initialGasLimitHex: any, blockGasLimitHex: any) {
  const initialGasLimitBn = hexToBn(initialGasLimitHex)
  const blockGasLimitBn = hexToBn(blockGasLimitHex)
  const upperGasLimitBn = blockGasLimitBn.muln(0.9)
  const bufferedGasLimitBn = initialGasLimitBn.muln(1.5)

  // if initialGasLimit is above blockGasLimit, dont modify it
  if (initialGasLimitBn.gt(upperGasLimitBn)) return bnToHex(initialGasLimitBn)
  // if bufferedGasLimit is below blockGasLimit, use bufferedGasLimit
  if (bufferedGasLimitBn.lt(upperGasLimitBn)) return bnToHex(bufferedGasLimitBn)
  // otherwise use blockGasLimit
  return bnToHex(upperGasLimitBn)
}

function hexToBn (inputHex) {
  return new BN(removeHexPrefix(inputHex), 16)
}

function bnToHex (inputBn) {
  return sanitizeHex(inputBn.toString(16))
}

function BnMultiplyByFraction (targetBN, numerator, denominator) {
  const numBN = new BN(numerator)
  const denomBN = new BN(denominator)
  return targetBN.mul(numBN).div(denomBN)
}
