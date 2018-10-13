/* global window setTimeout */

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
function getDataString(data, type = 'svg') {
  const dataString = qrImage.imageSync(data, { type })
  if (type === 'png') {
    return 'data:image/png;charset=utf-8;base64, ' + dataString.toString('base64')
  }
  return dataString
}


/**
 *  @desc     Format QR Code Image HTML String
 *  @param    {String}     data
 *  @param    {String}     type
 *  @return   {String}
 */
function formatQRCodeImage(data, type = 'svg') {
  const dataString = getDataString(data, type)
  if (type === 'png') {
    return `<img src="${dataString}" style="${style.qrcode.image}" />`
  }
  return dataString
}


/**
 *  @desc     Open WalletConnect QR Code Modal
 *  @param    {String}     uri
 *  @param    {Function}   cb
 *  @param    {String}     type
 */
function open(uri, cb, type = 'svg') {
  const wrapper = document.createElement('div')
  wrapper.setAttribute('id', 'walletconnect-wrapper')

  const qrCodeImage = formatQRCodeImage(uri, type)

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
  const elm = document.getElementById('walletconnect-qrcode-modal-base')
  elm.className = elm.className.replace('fadeIn', 'fadeOut')
  setTimeout(() => {
    const Wrapper = document.getElementById('walletconnect-wrapper')
    document.body.removeChild(Wrapper)
  }, 1000)
}

/**
 *  @desc     Format QR Code Modal HTML String
 *  @param    {String}     qrCode
 *  @return   {String}
 */
function formatQRCodeModal(qrCodeImage) {
  const callToAction = 'Scan QR code with a WalletConnect-compatible wallet'
  return `
    <div id="walletconnect-qrcode-modal" style="${style.qrcode.base}">
      <div id="walletconnect-qrcode-modal-base" style="${
        style.modal.base
      }" class="animated fadeIn">
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
      ${style.animate}
    </div>
`
}

export default { close, open, getDataString }
