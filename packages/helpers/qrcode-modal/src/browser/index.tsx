// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as React from "react";
// @ts-ignore
import * as ReactDOM from "react-dom";

import "./style.css";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Modal from "./components/Modal";
import {
  ANIMATION_DURATION,
  WALLETCONNECT_WRAPPER_ID,
  WALLETCONNECT_MODAL_ID,
  WALLETCONNECT_CLOSE_BUTTON_ID,
} from "./constants";
import { getDocument } from "./helpers";

function renderWrapperElement(): HTMLDivElement {
  const doc = getDocument();
  const elm = doc.createElement("div");
  elm.setAttribute("id", WALLETCONNECT_WRAPPER_ID);
  doc.body.appendChild(elm);
  return elm;
}

function triggerCloseAnimation(): void {
  const doc = getDocument();
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
  const closeButton = getDocument().getElementById(WALLETCONNECT_CLOSE_BUTTON_ID);
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
  const wrapper = renderWrapperElement();
  ReactDOM.render(<Modal uri={uri} />, wrapper);
  registerCloseEvent(cb);
}

export function close() {
  triggerCloseAnimation();
}
