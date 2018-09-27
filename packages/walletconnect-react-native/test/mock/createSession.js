export async function mockCreateSession(connector) {
  connector.symKey = await connector.generateKey()
  const { sessionId } = await connector._fetchBridge('/session/new', {
    method: 'POST'
  })
  connector.sessionId = sessionId
  const uri = connector._formatWalletConnectURI()
  return uri
}
