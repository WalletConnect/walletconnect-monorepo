import crypto from 'crypto'

export default async function generateKey(n = 256 / 8) {
  const b = crypto.randomBytes(n)
  const result = await b
  return result
}
