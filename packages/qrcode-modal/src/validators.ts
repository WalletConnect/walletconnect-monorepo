import { detectEnv } from '@walletconnect/utils'

export { isMobile } from '@walletconnect/utils'

export function isIOS (): boolean {
  const env = detectEnv()
  const result = env && env.os ? env.os.toLowerCase() === 'ios' : false
  return result
}

export function isNode (): boolean {
  const env = detectEnv()
  const result = env && env.name ? env.name.toLowerCase() === 'node' : false
  return result
}
