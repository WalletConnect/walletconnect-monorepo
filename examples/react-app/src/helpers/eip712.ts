const example = (chainId: number) => {
  return {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "verifyingContract", type: "address" },
      ],
      RelayRequest: [
        { name: "target", type: "address" },
        { name: "encodedFunction", type: "bytes" },
        { name: "gasData", type: "GasData" },
        { name: "relayData", type: "RelayData" },
      ],
      GasData: [
        { name: "gasLimit", type: "uint256" },
        { name: "gasPrice", type: "uint256" },
        { name: "pctRelayFee", type: "uint256" },
        { name: "baseRelayFee", type: "uint256" },
      ],
      RelayData: [
        { name: "senderAddress", type: "address" },
        { name: "senderNonce", type: "uint256" },
        { name: "relayWorker", type: "address" },
        { name: "paymaster", type: "address" },
      ],
    },
    domain: {
      name: "GSN Relayed Transaction",
      version: "1",
      chainId,
      verifyingContract: "0x6453D37248Ab2C16eBd1A8f782a2CBC65860E60B",
    },
    primaryType: "RelayRequest",
    message: {
      target: "0x9cf40ef3d1622efe270fe6fe720585b4be4eeeff",
      encodedFunction:
        "0xa9059cbb0000000000000000000000002e0d94754b348d208d64d52d78bcd443afa9fa520000000000000000000000000000000000000000000000000000000000000007",
      gasData: { gasLimit: "39507", gasPrice: "1700000000", pctRelayFee: "70", baseRelayFee: "0" },
      relayData: {
        senderAddress: "0x22d491bde2303f2f43325b2108d26f1eaba1e32b",
        senderNonce: "3",
        relayWorker: "0x3baee457ad824c94bd3953183d725847d023a2cf",
        paymaster: "0x957F270d45e9Ceca5c5af2b49f1b5dC1Abb0421c",
      },
    },
  }
};

export const eip712 = {
  example,
};
