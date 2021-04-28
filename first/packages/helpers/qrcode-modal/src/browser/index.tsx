// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as React from "react";
// @ts-ignore
import * as ReactDOM from "react-dom";
import { getDocumentOrThrow, getNavigatorOrThrow } from "@walletconnect/browser-utils";

import { WALLETCONNECT_STYLE_SHEET } from "./assets/style";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Modal from "./components/Modal";
import Languages from "./languages";
import {
  ANIMATION_DURATION,
  WALLETCONNECT_WRAPPER_ID,
  WALLETCONNECT_MODAL_ID,
  WALLETCONNECT_STYLE_ID,
} from "./constants";
import { IQRCodeModalOptions } from "@walletconnect/types";
import { TextMap } from "./types";

function injectStyleSheet() {
  const doc = getDocumentOrThrow();
  const prev = doc.getElementById(WALLETCONNECT_STYLE_ID);
  if (prev) {
    doc.head.removeChild(prev);
  }
  const style = doc.createElement("style");
  style.setAttribute("id", WALLETCONNECT_STYLE_ID);
  style.innerText = WALLETCONNECT_STYLE_SHEET;
  doc.head.appendChild(style);
}

function renderWrapper(): HTMLDivElement {
  const doc = getDocumentOrThrow();
  const wrapper = doc.createElement("div");
  wrapper.setAttribute("id", WALLETCONNECT_WRAPPER_ID);
  doc.body.appendChild(wrapper);
  return wrapper;
}

function triggerCloseAnimation(): void {
  const doc = getDocumentOrThrow();
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

function getText(): TextMap {
  const lang = getNavigatorOrThrow().language.split("-")[0] || "en";
  return Languages[lang] || Languages["en"];
}

export function open(uri: string, cb: any, qrcodeModalOptions?: IQRCodeModalOptions) {
  injectStyleSheet();
  const wrapper = renderWrapper();
  ReactDOM.render(
    <Modal
      text={getText()}
      uri={uri}
      onClose={getWrappedCallback(cb)}
      qrcodeModalOptions={qrcodeModalOptions}
    />,
    wrapper,
  );
}

export function close() {
  triggerCloseAnimation();
}
