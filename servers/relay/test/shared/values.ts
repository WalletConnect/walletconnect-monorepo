export const TEST_RELAY_URL = process.env.TEST_RELAY_URL
  ? process.env.TEST_RELAY_URL
  : "ws://localhost:5555";

export const TEST_WAKU_URL = process.env.TEST_WAKU_URL
  ? process.env.TEST_WAKU_URL
  : "http://localhost:8546";

export const WAKU_TOPIC = "5848da3a49a920942963650c86c8ffe556dccd6b6922abe43220b7fdfc90f395";
export const TEST_TOPIC = "f5d3f03946b6a2a3b22661fae1385cd1639bfb6f6c070115699b0a2ec1decd8c";
export const TEST_MESSAGE = "08ca02463e7c45383d43efaee4bbe33f700df0658e99726a755fd77f9a040988";
