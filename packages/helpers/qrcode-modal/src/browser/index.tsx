// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as React from "react";
// @ts-ignore
import * as ReactDOM from "react-dom";
import { getDocument } from "@walletconnect/utils";

import { WALLETCONNECT_STYLE_SHEET } from "./assets/style";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Modal from "./components/Modal";
import {
  ANIMATION_DURATION,
  WALLETCONNECT_WRAPPER_ID,
  WALLETCONNECT_MODAL_ID,
  WALLETCONNECT_STYLE_ID,
} from "./constants";

function injectStyleSheet() {
  const doc = getDocument();
  const style = doc.getElementById(WALLETCONNECT_STYLE_ID) || doc.createElement("style");
  style.setAttribute("id", WALLETCONNECT_STYLE_ID);
  style.innerText = WALLETCONNECT_STYLE_SHEET;
  doc.head.appendChild(style);
}

function renderWrapper(): HTMLDivElement {
  const doc = getDocument();
  const wrapper = doc.createElement("div");
  wrapper.setAttribute("id", WALLETCONNECT_WRAPPER_ID);
  doc.body.appendChild(wrapper);
  return wrapper;
}

function triggerCloseAnimation(): void {
  const doc = getDocument();
  const modal = doc.getElementById(WALLETCONNECT_MODAL_ID);
  if (modal) {
    modal.className = modal.className.replace("fadeIn", "fadeOut");
    setTimeout(() => {
      const wrapper = doc.getElementById(WALLETCONNECT_WRAPPER_ID);
      if (wrapper) {
        doc.body.removeChild(wrapper);
      }
    }, ANIMATION_DURATION);
  }
}

function getWrappedCallback(cb: any): any {
  return () => {
    triggerCloseAnimation();
    if (cb) {
      cb();
    }
  };
}

export function open(uri: string, cb: any) {
  injectStyleSheet();
  const wrapper = renderWrapper();
  const onClose = getWrappedCallback(cb);
  ReactDOM.render(<Modal uri={uri} onClose={onClose} />, wrapper);
}

export function close() {
  triggerCloseAnimation();
}
