const animationDuration = 300

export default {
  animationDuration,
  animation: `
  <style>
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    .animated {
      animation-duration: ${animationDuration}ms;
      animation-fill-mode: both;
    }
    .fadeIn {
      animation-name: fadeIn;
    }
    .fadeOut {
      animation-name: fadeOut;
    }
  </style>
  `,
  modal: {
    base: `
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
        width: 100%;
        max-width: 500px;
      `,
    header: `
        position: relative;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      `,
    headerLogo: `
      width: 100%;
      max-width: 320px;
      margin: 20px auto;
      height: 100%;
    `,
    close: {
      wrapper: `
        position: absolute;
        top: 15px;
        right: 15px;
        z-index: 10000;
      `,
      icon: `
        width: 25px;
        height: 25px;
        position: relative;
        top: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(45deg);
      `,
      line1: `
        position: absolute;
        width: 90%;
        border: 1px solid #7C828B;
      `,
      line2: `
        position: absolute;
        width: 90%;
        border: 1px solid #7C828B;
        transform: rotate(90deg);
      `
    }
  },
  qrcode: {
    base: `
      position:fixed;
      top: 0;
      width:100%;
      height:100%;
      z-index:100;
      background-color:rgba(0,0,0,0.5);
      text-align:center;
    `,
    text: `
      color: #7C828B;
      font-family: Avenir;
      font-size: 18px;
      text-align: center;
      margin: 0 auto;
      padding: 0 30px;
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    `,
    image: `
      width: 100%;
      padding: 30px;
    `
  }
}
