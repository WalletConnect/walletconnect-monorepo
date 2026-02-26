import { describe, expect, it } from "vitest";
import {
  createEncodedRecap,
  createRecap,
  decodeRecap,
  encodeRecap,
  formatMessage,
  getChainsFromRecap,
  getCommonValuesInArrays,
  getDecodedRecapFromResources,
  getMethodsFromRecap,
  isValidRecap,
  mergeRecaps,
  populateAuthPayload,
} from "../src";

describe("URI", () => {
  describe("merge recaps", () => {
    it("should merge recaps", () => {
      const recap1 = {
        att: {
          "https://notify.walletconnect.com": { "manage/all-apps-notifications": [{}] },
        },
      };
      const recap2 = {
        att: {
          eip155: {
            "request/eth_chainId": [{}],
            "request/eth_signTypedData_v4": [{}],
            "request/personal_sign": [{}],
          },
        },
      };
      const recap = mergeRecaps(recap1, recap2);

      const expected = {
        att: {
          eip155: {
            "request/eth_chainId": [{}],
            "request/eth_signTypedData_v4": [{}],
            "request/personal_sign": [{}],
          },
          "https://notify.walletconnect.com": { "manage/all-apps-notifications": [{}] },
        },
      };
      expect(JSON.stringify(recap)).to.eql(JSON.stringify(expected));
    });
    it("should merge recaps with different keys", () => {
      const recap1 = createRecap("https://web3inbox.com", "push", ["notifications", "alerts"]);
      const recap2 = createRecap("eip155", "request", ["personal_sign", "eth_sendTransaction"]);
      const expected = {
        att: {
          eip155: {
            "request/eth_sendTransaction": [{}],
            "request/personal_sign": [{}],
          },
          "https://web3inbox.com": {
            "push/alerts": [{}],
            "push/notifications": [{}],
          },
        },
      };
      const mergedRecap = mergeRecaps(recap1, recap2);
      expect(JSON.stringify(mergedRecap)).to.eql(JSON.stringify(expected));
    });
    it("should merge recaps with same resource", () => {
      const recap1 = createRecap("eip155", "push", ["notifications", "alerts"]);
      const recap2 = createRecap("eip155", "request", ["personal_sign", "eth_sendTransaction"]);
      const expected = {
        att: {
          eip155: {
            "push/alerts": [{}],
            "push/notifications": [{}],
            "request/eth_sendTransaction": [{}],
            "request/personal_sign": [{}],
          },
        },
      };
      const mergedRecap = mergeRecaps(recap1, recap2);
      expect(JSON.stringify(mergedRecap)).to.eql(JSON.stringify(expected));
    });
    it("should merge recaps with same resource & actions", () => {
      const recap1 = createRecap("eip155", "request", ["personal_sign", "notifications"]);
      const recap2 = createRecap("eip155", "request", ["alerts", "eth_sendTransaction"]);
      const expected = {
        att: {
          eip155: {
            "request/alerts": [{}],
            "request/eth_sendTransaction": [{}],
            "request/notifications": [{}],
            "request/personal_sign": [{}],
          },
        },
      };
      const mergedRecap = mergeRecaps(recap1, recap2);
      expect(JSON.stringify(mergedRecap)).to.eql(JSON.stringify(expected));
    });
  });

  it("should encode recap", () => {
    const recap = createRecap("eip155", "request", ["personal_sign", "eth_signTypedData_v4"]);
    isValidRecap(recap);
    const encoded = encodeRecap(recap);
    expect(encoded).to.be.a("string");
    expect(encoded).to.include("urn:recap:");
    const decoded = decodeRecap(encoded);
    expect(decoded).to.eql(recap);
  });

  it("should get methods from recap DONE", () => {
    const recap = {
      att: {
        eip155: {
          "push/eth_signTypedData": [{}],
          "push/personal_sign": [{}],
        },
      },
    };

    const methods = getMethodsFromRecap(encodeRecap(recap));
    expect(methods).to.eql(["eth_signTypedData", "personal_sign"]);
  });

  it("should get chains from recap", () => {
    const recap = {
      att: {
        eip155: {
          "push/messages": [{ chains: ["eip155:1", "eip155:2"] }],
          "push/test": [{ chains: ["eip155:2", "eip155:3"] }],
        },
      },
    };
    const chains = getChainsFromRecap(encodeRecap(recap));
    expect(chains).to.eql(["eip155:1", "eip155:2", "eip155:3"]);
  });

  it("should find common values in two arrays", () => {
    const arr1 = ["eip155:1", "eip155:2"];
    const arr2 = ["eip155:1", "eip155:3"];
    const result = getCommonValuesInArrays(arr1, arr2);
    expect(result).to.eql(["eip155:1"]);
  });
  it("should get recap from resources", () => {
    const resources = [
      "https://example.com",
      "urn:recap:eyJhdHQiOnsiZWlwMTU1Ijp7InJlcXVlc3QvZXRoX2NoYWluSWQiOlt7fV0sInJlcXVlc3QvZXRoX3NpZ25UeXBlZERhdGFfdjQiOlt7fV0sInB1c2gvcGVyc29uYWxfc2lnbiI6W3t9XX0sImh0dHBzOi8vbm90aWZ5LndhbGxldGNvbm5lY3QuY29tIjp7Im1hbmFnZS9hbGwtYXBwcy1ub3RpZmljYXRpb25zIjpbe31dLCJlbWl0L2FsZXJ0cyI6W3t9XX19fQ==",
    ];
    const result = getDecodedRecapFromResources(resources);
    expect(result).to.exist;
    expect(result).to.be.an("object");

    const expectFail = ["https://example.com"];
    const resFail = getDecodedRecapFromResources(expectFail);
    expect(resFail).to.eql(undefined);
  });
  it("should populate authPayload with supported chains/methods", () => {
    const encoded = createEncodedRecap("eip155", "request", [
      "personal_sign",
      "eth_signTypedData_v4",
    ]);

    const requestedChains = ["eip155:1", "eip155:2"];
    const authPayload = {
      chains: requestedChains,
      aud: "aud",
      domain: "localhost",
      version: "1",
      nonce: "1",
      iat: "2023-12-14T08:48:37.902Z",
      resources: ["https://example.com", encoded],
    };

    const supportedChains = ["eip155:2", "eip155:3"];
    const supportedMethods = ["personal_sign", "eth_signTypedData"];
    const updatedAuthPayload = populateAuthPayload({
      authPayload,
      chains: supportedChains,
      methods: supportedMethods,
    });

    const approvedChains = ["eip155:2"];
    expect(updatedAuthPayload.chains).to.eql(approvedChains);
    const recap = getDecodedRecapFromResources(updatedAuthPayload.resources);
    expect(recap).to.exist;
    isValidRecap(recap);

    const approvedMethods = ["personal_sign"];
    expect(getMethodsFromRecap(encodeRecap(recap))).to.eql(approvedMethods);
  });

  it("should populate authPayload with supported chains/methods for siwe", () => {
    const requestedChains = ["eip155:1", "eip155:2"];
    const authPayload = {
      chains: requestedChains,
      aud: "aud",
      domain: "localhost",
      version: "1",
      nonce: "1",
      iat: "2023-12-14T08:48:37.902Z",
      resources: [
        "https://example.com",
        "urn:recap:eyJhdHQiOnsiaHR0cHM6Ly9ub3RpZnkud2FsbGV0Y29ubmVjdC5jb20iOnsibWFuYWdlL2FsbC1hcHBzLW5vdGlmaWNhdGlvbnMiOlt7fV19fX0",
      ],
    };

    const supportedChains = ["eip155:2", "eip155:3"];
    const supportedMethods = ["personal_sign", "eth_signTypedData"];
    const updatedAuthPayload = populateAuthPayload({
      authPayload,
      chains: supportedChains,
      methods: supportedMethods,
    });

    const approvedChains = ["eip155:2"];
    expect(updatedAuthPayload.chains).to.eql(approvedChains);
    const recap = getDecodedRecapFromResources(updatedAuthPayload.resources);
    expect(recap).to.exist;
    isValidRecap(recap);

    // it's siwe so no methods should be added
    const approvedMethods = [];
    expect(getMethodsFromRecap(encodeRecap(recap))).to.eql(approvedMethods);
  });

  it("should numerate unique recap abilities correctly", () => {
    const request = {
      type: "caip122",
      chains: ["eip155:1"],
      statement: "I accept the ServiceOrg Terms of Service: https://app.web3inbox.com/tos",
      aud: "https://app.web3inbox.com/login",
      domain: "app.web3inbox",
      version: "1",
      nonce: "32891756",
      iat: "2024-03-13T09:00:43.888Z",
      resources: [
        "urn:recap:eyJhdHQiOnsiZWlwMTU1Ijp7InJlcXVlc3QvZXRoX3NlbmRUcmFuc2FjdGlvbiI6W3t9XSwicmVxdWVzdC9wZXJzb25hbF9zaWduIjpbe31dfSwiaHR0cHM6Ly9ub3RpZnkud2FsbGV0Y29ubmVjdC5jb20iOnsibWFuYWdlL2FsbC1hcHBzLW5vdGlmaWNhdGlvbnMiOlt7fV19fX0",
      ],
    };

    const message = formatMessage(
      request,
      "did:pkh:eip155:1:0x3613699A6c5D8BC97a08805876c8005543125F09",
    );

    // the above resources[] should produce 2 capability statements
    expect(message).to.include("(1)");
    expect(message).to.include("(2)");
    expect(message).to.include(
      "I further authorize the stated URI to perform the following actions on my behalf: (1) 'request': 'eth_sendTransaction', 'personal_sign' for 'eip155'. (2) 'manage': 'all-apps-notifications' for 'https://notify.walletconnect.com'.",
    );

    expect(message).to.include("Version: 1");
    expect(message).to.include("Nonce: 32891756");
    expect(message).to.include(`URI: ${request.aud}`);
  });
  describe("resources", () => {
    it("should not add resources to siwe message when missing from request", () => {
      const request = {
        type: "caip122",
        chains: ["eip155:1"],
        aud: "https://example.com",
        domain: "http://localhost:3000",
        version: "1",
        nonce: "1",
        iat: "2024-02-19T09:29:21.394Z",
        statement: "Requesting access to your account",
      };

      const message = formatMessage(
        request as any,
        "did:pkh:eip155:1:0x3613699A6c5D8BC97a08805876c8005543125F09",
      );

      expect(message).to.include("Version: 1");
      expect(message).to.include("Nonce: 1");
      expect(message).to.include(`URI: ${request.aud}`);
      expect(message).to.not.include(`Resources:`);
    });
    it("should add resources to siwe message when is empty array DONE", () => {
      const request = {
        type: "caip122",
        chains: ["eip155:1"],
        aud: "https://example.com",
        domain: "http://localhost:3000",
        version: "1",
        nonce: "1",
        iat: "2024-02-19T09:29:21.394Z",
        statement: "Requesting access to your account",
        resources: [],
      };

      const message = formatMessage(
        request as any,
        "did:pkh:eip155:1:0x3613699A6c5D8BC97a08805876c8005543125F09",
      );

      expect(message).to.include("Version: 1");
      expect(message).to.include("Nonce: 1");
      expect(message).to.include(`URI: ${request.aud}`);
      expect(message).to.include(`Resources:`);
    });

    it("should add resources items to siwe message DONE", () => {
      const request = {
        type: "caip122",
        chains: ["eip155:1"],
        aud: "https://example.com",
        domain: "http://localhost:3000",
        version: "1",
        nonce: "1",
        iat: "2024-02-19T09:29:21.394Z",
        statement: "Requesting access to your account",
        resources: [
          "https://example.com",
          "urn:recap:eyJhdHQiOnsiZWlwMTU1Ijp7InJlcXVlc3QvZXRoX2NoYWluSWQiOlt7fV0sInJlcXVlc3QvZXRoX3NpZ25UeXBlZERhdGFfdjQiOlt7fV0sInB1c2gvcGVyc29uYWxfc2lnbiI6W3t9XX0sImh0dHBzOi8vbm90aWZ5LndhbGxldGNvbm5lY3QuY29tIjp7Im1hbmFnZS9hbGwtYXBwcy1ub3RpZmljYXRpb25zIjpbe31dLCJlbWl0L2FsZXJ0cyI6W3t9XX19fQ",
        ],
      };

      const message = formatMessage(
        request as any,
        "did:pkh:eip155:1:0x3613699A6c5D8BC97a08805876c8005543125F09",
      );

      expect(message).to.include("Version: 1");
      expect(message).to.include("Nonce: 1");
      expect(message).to.include(`URI: ${request.aud}`);
      expect(message).to.include(`Resources:`);
      expect(message).to.include(request.resources[0]);
    });

    it("should add optional params to siwe message", () => {
      const request = {
        type: "caip122",
        chains: ["eip155:1"],
        aud: "https://example.com",
        domain: "http://localhost:3000",
        version: "1",
        nonce: "1",
        iat: "2024-02-19T09:29:21.394Z",
        exp: "2024-02-25T09:29:21.394Z",
        nbf: "2024-02-20T09:29:21.394Z",
        requestId: "123",
        statement: "Requesting access to your account",
        resources: [
          "https://example.com",
          "urn:recap:eyJhdHQiOnsiZWlwMTU1Ijp7InJlcXVlc3QvZXRoX2NoYWluSWQiOlt7fV0sInJlcXVlc3QvZXRoX3NpZ25UeXBlZERhdGFfdjQiOlt7fV0sInB1c2gvcGVyc29uYWxfc2lnbiI6W3t9XX0sImh0dHBzOi8vbm90aWZ5LndhbGxldGNvbm5lY3QuY29tIjp7Im1hbmFnZS9hbGwtYXBwcy1ub3RpZmljYXRpb25zIjpbe31dLCJlbWl0L2FsZXJ0cyI6W3t9XX19fQ",
        ],
      };

      const message = formatMessage(
        request as any,
        "did:pkh:eip155:1:0x3613699A6c5D8BC97a08805876c8005543125F09",
      );

      expect(message).to.include("Version: 1");
      expect(message).to.include("Nonce: 1");
      expect(message).to.include(`URI: ${request.aud}`);
      expect(message).to.include(`Issued At: ${request.iat}`);
      expect(message).to.include(`Expiration Time: ${request.exp}`);
      expect(message).to.include(`Not Before: ${request.nbf}`);
      expect(message).to.include(`Request ID: ${request.requestId}`);
      expect(message).to.include(`Resources:`);
      expect(message).to.include(request.resources[0]);
    });
  });
});
