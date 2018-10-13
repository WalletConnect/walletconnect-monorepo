/* global window setTimeout */

let document = null
if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
  document = window.document
}

import qrImage from 'qr-image'
import style from './style'
import asset from './asset'

/**
 *  @desc     Format QR Code Image HTML String
 *  @param    {String}     data
 *  @return   {String}
 */
function formatQRCodeImage(data) {
  const dataString = qrImage.imageSync(data, { type: 'svg' })
  return dataString.replace('<svg', `<svg style="${style.qrcode.image}"`)
}

/**
 *  @desc     Format QR Code Modal HTML String
 *  @param    {String}     qrCode
 *  @return   {String}
 */
function formatQRCodeModal(qrCodeImage) {
  const callToAction = 'Scan QR code with a WalletConnect-compatible wallet'
  return `
    <div
      id="walletconnect-qrcode-modal"
      style="${style.qrcode.base}"
      class="animated fadeIn"
    >
      <div style="${style.modal.base}">
        <div style="${style.modal.header}">
          <img src="${asset.logo}" style="${style.modal.headerLogo}" />
          <div style="${style.modal.close.wrapper}">
            <div
              id="walletconnect-qrcode-close"
              style="${style.modal.close.icon}"
            >
              <div style="${style.modal.close.line1}"></div>
              <div style="${style.modal.close.line2}"></div>
            </div>
          </div>
        </div>
        <div>
          <div>
            <p id="walletconnect-qrcode-text" style="${style.qrcode.text}">
              ${callToAction}
            </p>
            ${qrCodeImage}
          </div>
        </div>
      </div>
      ${style.animation}
    </div>
`
}

/**
 *  @desc     Open WalletConnect QR Code Modal
 *  @param    {String}     uri
 *  @param    {Function}   cb
 */
function open(uri, cb) {
  const wrapper = document.createElement('div')
  wrapper.setAttribute('id', 'walletconnect-wrapper')

  const qrCodeImage = formatQRCodeImage(uri)

  wrapper.innerHTML = formatQRCodeModal(qrCodeImage)

  document.body.appendChild(wrapper)
  document
    .getElementById('walletconnect-qrcode-close')
    .addEventListener('click', () => {
      close()
      cb()
    })
}

/**
 *  @desc     Close WalletConnect QR Code Modal
 */
function close() {
  const elm = document.getElementById('walletconnect-qrcode-modal')
  elm.className = elm.className.replace('fadeIn', 'fadeOut')
  setTimeout(() => {
    const Wrapper = document.getElementById('walletconnect-wrapper')
    document.body.removeChild(Wrapper)
  }, style.animationDuration)
}

export default { close, open }
