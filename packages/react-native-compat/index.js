import { getApplicationModule } from "./module";

// Polyfill TextEncode / TextDecode
import "fast-text-encoding";

// Polyfill crypto.getRandomvalues
import "react-native-get-random-values";

// Polyfill URL()
import "react-native-url-polyfill/auto";

// Polyfill Buffer
if (typeof Buffer === "undefined") {
  global.Buffer = require("buffer").Buffer;
}

// Polyfill btoa
if (typeof btoa === "undefined") {
  global.btoa = function (str) {
    return Buffer.alloc(str.length, str, "binary").toString("base64");
  };
}

// Polyfill atob
if (typeof atob === "undefined") {
  global.atob = function (b64Encoded) {
    return Buffer.alloc(
      Buffer.from(b64Encoded, "base64").length,
      Buffer.from(b64Encoded, "base64"),
      "binary",
    ).toString("binary");
  };
}

if (typeof global?.Linking === "undefined") {
  try {
    global.Linking = require("react-native").Linking;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("react-native-compat: react-native.Linking is not available");
  }
}

if (typeof global?.Platform === "undefined") {
  try {
    global.Platform = require("react-native").Platform;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("react-native-compat: react-native.Platform is not available");
  }
}

if (typeof global?.NetInfo === "undefined") {
  try {
    global.NetInfo = require("@react-native-community/netinfo");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("react-native-compat: @react-native-community/netinfo is not available");
  }
}

if (typeof global?.Application === "undefined") {
  try {
    const module = getApplicationModule();
    if (typeof module.getConstants === "function") {
      global.Application = {
        ...module.getConstants(),
        isAppInstalled: module.isAppInstalled,
      };
    } else {
      global.Application = module;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("react-native-compat: Application module is not available");
  }
}
