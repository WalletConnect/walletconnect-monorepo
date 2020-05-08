import "./assets/style.css";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Modal from "./components/Modal";
import {
  ANIMATION_DURATION,
  WALLETCONNECT_WRAPPER_ID,
  WALLETCONNECT_MODAL_ID,
  WALLETCONNECT_CLOSE_BUTTON_ID,
} from "./constants";
import { safeGetFromWindow } from "./helpers";

function renderModalWrapper(): HTMLDivElement {
  const doc = safeGetFromWindow<Document>("document");
  const wrapper = doc.createElement("div");
  wrapper.setAttribute("id", WALLETCONNECT_WRAPPER_ID);
  doc.body.appendChild(wrapper);
  return wrapper;
}

function triggerCloseAnimation(): void {
  const doc = safeGetFromWindow<Document>("document");
  const elm = doc.getElementById(WALLETCONNECT_MODAL_ID);
  if (elm) {
    elm.className = elm.className.replace("fadeIn", "fadeOut");
    setTimeout(() => {
      const wrapper = doc.getElementById(WALLETCONNECT_WRAPPER_ID);
      if (wrapper) {
        doc.body.removeChild(wrapper);
      }
    }, ANIMATION_DURATION);
  }
}

function registerCloseEvent(cb: any): void {
  const doc = safeGetFromWindow<Document>("document");
  const closeButton = doc.getElementById(WALLETCONNECT_CLOSE_BUTTON_ID);
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      triggerCloseAnimation();
      if (cb) {
        cb();
      }
    });
  }
}

export function open(uri: string, cb: any) {
  const wrapper = renderModalWrapper();
  wrapper.innerHTML = Modal({ uri });
  registerCloseEvent(cb);
}

export function close() {
  triggerCloseAnimation();
}
