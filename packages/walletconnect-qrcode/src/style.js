const animate = `
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

const QRCode = `
  position:fixed;
  top: 0;
  width:100%;
  height:100%;
  z-index:100;
  background-color:rgba(0,0,0,0.5);
  text-align:center;
`

const Modal = `
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

const ModalHeader = `
  width: 100%;
  height: 45px;
`

const ModalHeaderClose = `
  float: right;
  height: 25px;
  width: 25px;
  margin: 15px;
  cursor: pointer;
`

const QRCodeInstructions = `
  color: #7C828B;
  font-family: Avenir;
  font-size: 18px;
  text-align: center;
  margin-top: 0;
`

const QRCodeIMG = `
  z-index:102;
  margin-bottom: 35px;
`

export {
  animate,
  QRCode,
  Modal,
  ModalHeader,
  ModalHeaderClose,
  QRCodeInstructions,
  QRCodeIMG
}
