/* global window */

let document = null
if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
  document = window.document
}

import qrImage from 'qr-image'
import style from './style'

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

  let data = getDataString(uri)

  wrapper.innerHTML = formatQRCodeModal({
    qrImageUri: getDataString(data),
    cb
  })

  function cancelClick() {
    document.getElementById('walletconnect-qrcode-text').innerHTML =
      'Cancelling'
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
 *  @param    {Object}     args     { qrImageUri}
 *  @return   {String}
 */
function formatQRCodeModal({ qrImageUri }) {
  return `
    <div id="walletconnect-qrcode-modal" style="${style.QRCode.base}">
      <div style="${style.Modal.base}" class="animated fadeIn">
        <div style="${style.Modal.header}">
          <div id="walletconnect-qrcode-cancel" style="${style.Modal.close}">
            <p>Close</p>
          </div>
        </div>
        <div>
          <div>
            <p id="walletconnect-qrcode-text" style="${
              style.QRCode.text
            }">Scan QR code with WalletConnect</p>
            <img src="${qrImageUri}" style="${style.QRCode.image}" />
          </div>
        </div>
      </div>
      ${style.animate}
    </div>
`
}

export { close, open, getDataString }
