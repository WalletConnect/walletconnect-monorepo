// Polyfill TextEncode / TextDecode
import "fast-text-encoding";

// Polyfill crypto.getRandomvalues
import "react-native-get-random-values";

// Polyfill Buffer
if (typeof Buffer === "undefined") {
  global.Buffer = require("buffer").Buffer;
}
