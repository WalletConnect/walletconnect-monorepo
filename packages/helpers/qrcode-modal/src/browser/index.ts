import * as utils from "@walletconnect/utils";

import "./assets/style.css";
import Modal from "./components/Modal";
import * as constants from "./constants";

export function open(uri: string, cb: any) {
  const doc = utils.safeGetFromWindow<Document>("document");
  const wrapper = doc.createElement("div");
  wrapper.setAttribute("id", "walletconnect-wrapper");

  wrapper.innerHTML = Modal({ uri });

  doc.body.appendChild(wrapper);
  const closeButton = doc.getElementById("walletconnect-qrcode-close");

  if (closeButton) {
    closeButton.addEventListener("click", () => {
      close();
      if (cb) {
        cb();
      }
    });
  }
}

export function close() {
  const doc = utils.safeGetFromWindow<Document>("document");
  const elm = doc.getElementById("walletconnect-qrcode-modal");
  if (elm) {
    elm.className = elm.className.replace("fadeIn", "fadeOut");
    setTimeout(() => {
      const wrapper = doc.getElementById("walletconnect-wrapper");
      if (wrapper) {
        doc.body.removeChild(wrapper);
      }
    }, constants.animationDuration);
  }
}
