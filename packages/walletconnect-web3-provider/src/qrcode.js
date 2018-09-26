/* global document */

// import qrcode from 'qrcode'

async function toggleModal() {
  var elem = document.createElement('div')
  elem.style.cssText =
    'position:fixed;width:100%;height:100%; top:0; bottom: 0; left: 0; right: 0;opacity:0.3;z-index:100000000000000000000000000000000;background:#000'
  document.body.appendChild(elem)
}

async function displayQRCode(uri) {
  console.log(uri) // eslint-disable-line
  toggleModal()
}

export default displayQRCode
