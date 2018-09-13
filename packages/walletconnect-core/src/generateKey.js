import crypto from 'crypto'

export default async function generateKey(s = 256) {
  const n = s / 8
  const b = crypto.randomBytes(n)
  const result = await b
  return result
}
