/* global window setTimeout */

import * as qrImage from 'qr-image'
import logo from './logo.svg'
import constants from './constants'
import './style.css'

let document: Document
if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
  document = window.document
}

function formatQRCodeImage (data: string) {
  let result = ''
  const dataString = qrImage.imageSync(data, { type: 'svg' })
  if (typeof dataString === 'string') {
    result = dataString.replace('<svg', `<svg class="walletconnect-qrcode__image"`)
  }
  return result
}

function formatQRCodeModal (qrCodeImage: string) {
  const callToAction = 'Scan QR code with a WalletConnect-compatible wallet'
  return `
    <div
      id="walletconnect-qrcode-modal"
      class="walletconnect-qrcode__base animated fadeIn"
    >
      <div class="walletconnect-modal__base">
        <div class="walletconnect-modal__header">
          <img src="${logo}" class="walletconnect-modal__headerLogo" />
          <div class="walletconnect-modal__close__wrapper">
            <div
              id="walletconnect-qrcode-close"
              class="walletconnect-modal__close__icon"
            >
              <div class="walletconnect-modal__close__line1""></div>
              <div class="walletconnect-modal__close__line2"></div>
            </div>
          </div>
        </div>
        <div>
          <div>
            <p id="walletconnect-qrcode-text" class="walletconnect-qrcode__text">
              ${callToAction}
            </p>
            ${qrCodeImage}
          </div>
        </div>
      </div>
    </div>
`
}

function open (uri: string, cb: any) {
  const wrapper = document.createElement('div')
  wrapper.setAttribute('id', 'walletconnect-wrapper')
  const qrCodeImage = formatQRCodeImage(uri)

  wrapper.innerHTML = formatQRCodeModal(qrCodeImage)

  document.body.appendChild(wrapper)
  const closeButton = document.getElementById('walletconnect-qrcode-close')
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      close()
      if (cb) {
        cb()
      }
    })
  }
}

/**
 *  @desc     Close WalletConnect QR Code Modal
 */
function close () {
  const elm = document.getElementById('walletconnect-qrcode-modal')
  if (elm) {
    elm.className = elm.className.replace('fadeIn', 'fadeOut')
    setTimeout(() => {
      const wrapper = document.getElementById('walletconnect-wrapper')
      if (wrapper) {
        document.body.removeChild(wrapper)
      }
    }, constants.animationDuration)
  }
}

export default { close, open }
