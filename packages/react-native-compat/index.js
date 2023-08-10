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
    console.error("react-native-compat: react-native.NetInfo is not available", e);
  }
}
