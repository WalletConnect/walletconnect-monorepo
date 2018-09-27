/* global document */

import qrImage from 'qr-image'

/**
 *  Given a string of data it returns a image URI which is a QR code. An image
 *  URI can be displayed in a img html tag by setting the src attrbiute to the
 *  the image URI.
 *
 *  @param    {String}     data      data string
 *  @return   {String}               image URI
 */
const getQRDataURI = data => {
  let pngBuffer = qrImage.imageSync(data, { type: 'png' })
  return 'data:image/png;charset=utf-8;base64, ' + pngBuffer.toString('base64')
}

/**
 *  A default QR pop over display, which injects the neccessary html
 *
 *  @param    {String}     data       data which is displayed in QR code
 *  @param    {Function}   cancel     a function called when the cancel button is clicked
 *  @param    {String}     appName    name of the users app
 *  @param    {Boolean}    introModal a flag for displaying the intro
 */
const openQr = (data, cancel) => {
  let wrapper = document.createElement('div')
  wrapper.setAttribute('id', '-wrapper')

  wrapper.innerHTML = QRDisplay({ qrImageUri: getQRDataURI(data), cancel })

  const cancelClick = () => {
    document.getElementById('-qr-text').innerHTML = 'Cancelling'
    cancel()
  }

  document.body.appendChild(wrapper)
  document.getElementById('-qr-cancel').addEventListener('click', cancelClick)
}

/**
 *  Closes the default QR pop over
 */
const closeQr = () => {
  const Wrapper = document.getElementById('-wrapper')
  document.body.removeChild(Wrapper)
}

/**
 *  A html pop over QR display template
 *
 *  @param    {Object}     args
 *  @param    {String}     args.qrImageUri    a image URI for the QR code
 */
const QRDisplay = ({ qrImageUri }) =>
  Modal(`
  <div>
    <p id="-qr-text" style="${QRInstructions}">Scan QR code with WalletConnect</p>
    <img src="${qrImageUri}" style="${QRIMG}" />
  </div>
`)

/**
 *  Modal skeleton
 *
 *  @param    {String}     innerHTML    content of modal
 */
const Modal = innerHTML => `
  <div id="-qr" style="${QRCSS}">
    <div style="${ModalCSS}" class="animated fadeIn">
      <div style="${ModalHeaderCSS}">
        <div id="-qr-cancel" style="${ModalHeaderCloseCSS}">
          <p>Close</p>
        </div>
      </div>
      <div>
        ${innerHTML}
      </div>
    </div>
    ${animateCSS}
  </div>
`

/**
 *  animateCSS CSS
 */
const animateCSS = `
<style>
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .animated {
    animation-duration: 1s;
    animation-fill-mode: both;
  }
  .fadeIn {
    animation-name: fadeIn;
  }
</style>
`

/**
 *  QRCSS CSS
 */
const QRCSS = `
  position:fixed;
  top: 0;
  width:100%;
  height:100%;
  z-index:100;
  background-color:rgba(0,0,0,0.5);
  text-align:center;
`

/**
 *  ModalCSS CSS
 */
const ModalCSS = `
  position:relative;
  top:50%;
  display:inline-block;
  z-index:101;
  background:#fff;
  transform:translateY(-50%);
  margin:0 auto;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 12px 24px 0 rgba(0,0,0,0.1);
  min-width: 400px;
  max-width: 100%;
`

/**
 *  ModalHeaderCSS CSS
 */
const ModalHeaderCSS = `
  width: 100%;
  height: 45px;
`

/**
 *  ModalHeaderCloseCSS CSS
 */
const ModalHeaderCloseCSS = `
  float: right;
  height: 25px;
  width: 25px;
  margin: 15px;
  cursor: pointer;
`

/**
 *  QRInstructions CSS
 */
const QRInstructions = `
  color: #7C828B;
  font-family: Avenir;
  font-size: 18px;
  text-align: center;
  margin-top: 0;
`

/**
 *  QRIMG CSS
 */
const QRIMG = `
  z-index:102;
  margin-bottom: 35px;
`

/**
 *  export
 */
export { closeQr, openQr, getQRDataURI, QRDisplay }
