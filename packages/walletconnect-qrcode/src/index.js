/* global document */

import qrImage from 'qr-image'
import * as style from './style'

/**
 *  Given a string of data it returns a image URI which is a QR code. An image
 *  URI can be displayed in a img html tag by setting the src attrbiute to the
 *  the image URI.
 *
 *  @param    {String}     data      data string
 *  @param    {String}     type      type string
 *  @return   {String}               image URI
 */
const getQRCodeDataURI = (data, type = 'png') => {
  let buffer = qrImage.imageSync(data, { type })
  return 'data:image/png;charset=utf-8;base64, ' + buffer.toString('base64')
}

/**
 *  A default QR pop over display, which injects the neccessary html
 *
 *  @param    {String}     data       data which is displayed in QR code
 *  @param    {Function}   cancel     a function called when the cancel button is clicked
 *  @param    {String}     appName    name of the users app
 *  @param    {Boolean}    introModal a flag for displaying the intro
 */
const openQRCode = (data, cancel) => {
  let wrapper = document.createElement('div')
  wrapper.setAttribute('id', 'walletconnect-wrapper')

  wrapper.innerHTML = QRCodeDisplay({
    qrImageUri: getQRCodeDataURI(data),
    cancel
  })

  const cancelClick = () => {
    document.getElementById('walletconnect-qr-text').innerHTML = 'Cancelling'
    cancel()
  }

  document.body.appendChild(wrapper)
  document
    .getElementById('walletconnect-qr-cancel')
    .addEventListener('click', cancelClick)
}

/**
 *  Closes the default QR pop over
 */
const closeQRCode = () => {
  const Wrapper = document.getElementById('walletconnect-wrapper')
  document.body.removeChild(Wrapper)
}

/**
 *  A html pop over QR display template
 *
 *  @param    {Object}     args
 *  @param    {String}     args.qrImageUri    a image URI for the QR code
 */
const QRCodeDisplay = ({ qrImageUri }) =>
  Modal(`
  <div>
    <p id="walletconnect-qr-text" style="${
      style.QRCodeInstructions
    }">Scan QR code with WalletConnect</p>
    <img src="${qrImageUri}" style="${style.QRCodeIMG}" />
  </div>
`)

/**
 *  Modal skeleton
 *
 *  @param    {String}     innerHTML    content of modal
 */
const Modal = innerHTML => `
  <div id="walletconnect-qr" style="${style.QRCode}">
    <div style="${style.Modal}" class="animated fadeIn">
      <div style="${style.ModalHeader}">
        <div id="walletconnect-qr-cancel" style="${style.ModalHeaderClose}">
          <p>Close</p>
        </div>
      </div>
      <div>
        ${innerHTML}
      </div>
    </div>
    ${style.animate}
  </div>
`

export { closeQRCode, openQRCode, getQRCodeDataURI }
