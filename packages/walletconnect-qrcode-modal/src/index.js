/* global window */

let document = null
if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
  document = window.document
}

import qrImage from 'qr-image'
import style from './style'
import asset from './asset'

/**
 *  @desc     Returns QR Code Data String for given image type
 *  @param    {String}     data
 *  @param    {String}     type
 *  @return   {String}
 */
function getDataString(data, type = 'png') {
  let buffer = qrImage.imageSync(data, { type })
  if (type === 'png') {
    return 'data:image/png;charset=utf-8;base64, ' + buffer.toString('base64')
  }
  return buffer
}

/**
 *  @desc     Open WalletConnect QR Code Modal
 *  @param    {String}     uri
 *  @param    {Function}   cb
 */
function open(uri, cb) {
  let wrapper = document.createElement('div')
  wrapper.setAttribute('id', 'walletconnect-wrapper')

  let qrImageUri = getDataString(uri)

  wrapper.innerHTML = formatQRCodeModal(qrImageUri)

  function cancelClick() {
    const elm = document.getElementById('walletconnect-qrcode-modal-base')
    elm.className = elm.className.replace('fadeIn', 'fadeOut')
    close()
    cb()
  }

  document.body.appendChild(wrapper)
  document
    .getElementById('walletconnect-qrcode-cancel')
    .addEventListener('click', cancelClick)
}

/**
 *  @desc     Close WalletConnect QR Code Modal
 */
function close() {
  const Wrapper = document.getElementById('walletconnect-wrapper')
  document.body.removeChild(Wrapper)
}

/**
 *  @desc     QR Code Modal HTML String
 *  @param    {String}     qrImageUri
 *  @return   {String}
 */
function formatQRCodeModal(qrImageUri) {
  const callToAction = 'Scan QR code with a WalletConnect-compatible wallet'
  return `
    <div id="walletconnect-qrcode-modal" style="${style.QRCode.base}">
      <div id="walletconnect-qrcode-modal-base" style="${
        style.Modal.base
      }" class="animated fadeIn">
        <div style="${style.Modal.header}">
          <img src="${asset.logo}" style="${style.modal.headerLogo}" />
          <div style=${style.Modal.close.wrapper}>
            <div
              id="walletconnect-qrcode-cancel"
              style="${style.Modal.close.icon}"
            >
              <div style=${style.Modal.close.line1}></div>
              <div style=${style.Modal.close.line2}></div>
            </div>
          </div>
        </div>
        <div>
          <div>
            <p id="walletconnect-qrcode-text" style="${style.QRCode.text}">
              ${callToAction}
            </p>
            <img src="${qrImageUri}" style="${style.QRCode.image}" />
          </div>
        </div>
      </div>
      ${style.animate}
    </div>
`
}

export default { close, open, getDataString }
