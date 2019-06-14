'use strict'

// updates title to display package version
updateTitle()

const WalletConnect = window.WalletConnect.default
const WalletConnectQRCodeModal = window.WalletConnectQRCodeModal.default

const bridge = 'https://bridge.walletconnect.org'

let walletConnector = null

function onInit() {
  // Create a walletConnector
  walletConnector = new WalletConnect({
    bridge: 'https://bridge.walletconnect.org' // Required
  })

  // Check if connection is already established
  if (!walletConnector.connected) {
    // create new session
    walletConnector.createSession().then(() => {
      // get uri for QR Code modal
      const uri = walletConnector.uri
      // display QR Code modal
      WalletConnectQRCodeModal.open(uri, () => {
        console.log('QR Code Modal closed')
      })
    })
  } else {
    const { accounts, chainId } = walletConnector
    updateSessionDetails({ accounts, chainId })
  }

  onSubscribe()
}

function onSubscribe() {
  if (!walletConnector) {
    throw new Error(`walletConnector hasn't been created yet`)
  }
  // Subscribe to connection events
  walletConnector.on('connect', (error, payload) => {
    if (error) {
      throw error
    }

    // Close QR Code Modal
    WalletConnectQRCodeModal.close()

    // Get provided accounts and chainId
    const { accounts, chainId } = payload.params[0]

    updateSessionDetails({ accounts, chainId })
  })

  walletConnector.on('session_update', (error, payload) => {
    if (error) {
      throw error
    }

    // Get updated accounts and chainId
    const { accounts, chainId } = payload.params[0]

    updateSessionDetails({ accounts, chainId })
  })

  walletConnector.on('disconnect', (error, payload) => {
    if (error) {
      throw error
    }

    // Delete walletConnector
    walletConnector = null

    onDisconnect()
  })
}

async function updateSessionDetails({ accounts, chainId }) {
  const containerEl = document.getElementById('page-actions')
  const pTags = containerEl.getElementsByTagName('p')
  if (pTags.length === 1) {
    const textEl = containerEl.getElementsByTagName('p')[0]
    textEl.innerHTML = 'Connected!'

    const accountEl = document.createElement('p')
    accountEl.innerHTML = `Account: ${accounts[0]}`
    insertAfter(accountEl, textEl)

    const chainData = await getChainData(chainId)

    const chainEl = document.createElement('p')
    chainEl.innerHTML = `Chain: ${chainData.name}`
    insertAfter(chainEl, accountEl)

    const buttonEl = containerEl.getElementsByTagName('button')[0]
    buttonEl.innerText = 'Send Transaction'
    buttonEl.onclick = sendTestTransaction
  } else {
    const accountEl = containerEl.getElementsByTagName('p')[1]
    accountEl.innerHTML = `Account: ${accounts[0]}`

    const chainData = await getChainData(chainId)

    const chainEl = containerEl.getElementsByTagName('p')[2]
    chainEl.innerHTML = `Chain: ${chainData.name}`
  }
}

async function onDisconnect() {
  const containerEl = document.getElementById('page-actions')
  const pTags = containerEl.getElementsByTagName('p')

  const textEl = containerEl.getElementsByTagName('p')[0]
  textEl.innerHTML = 'Disconnected!'

  const buttonEl = containerEl.getElementsByTagName('button')[0]
  buttonEl.innerText = 'WalletConnect'
  buttonEl.onclick = onInit
  if (pTags.length > 1) {
    const accountEl = containerEl.getElementsByTagName('p')[1]
    accountEl.remove()

    const chainEl = containerEl.getElementsByTagName('p')[1]
    chainEl.remove()
  }
}

function sendTestTransaction() {
  if (!walletConnector) {
    throw new Error(`walletConnector hasn't been created yet`)
  }

  // Draft transaction
  const tx = {
    from: walletConnector.accounts[0],
    to: walletConnector.accounts[0],
    data: '0x' // Required
  }

  // Send transaction
  walletConnector
    .sendTransaction(tx)
    .then(result => {
      // Returns transaction id (hash)
      console.log(result)
    })
    .catch(error => {
      // Error returned when rejected
      console.error(error)
    })
}

let supportedChains = null

async function getChainData(chainId) {
  if (!supportedChains) {
    supportedChains = await getJsonFile('./chains.json')
  }

  const chainData = supportedChains.filter(
    chain => chain.chain_id === chainId
  )[0]

  if (!chainData) {
    throw new Error('ChainId missing or not supported')
  }

  return chainData
}

async function getJsonFile(path) {
  const res = await fetch(path)
  const json = await res.json()
  return json
}

async function updateTitle() {
  const { version } = await getJsonFile('../../lerna.json')
  const title = document.getElementById('page-title')
  title.innerHTML =
    title.innerHTML.replace(/\sv(\w.)+.\w+/gi, '') + ` v${version}`
}

function insertAfter(newNode, referenceNode) {
  referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling)
}
