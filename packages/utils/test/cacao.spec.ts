import { describe, expect, it } from "vitest";
import {
  base64Encode,
  buildNamespacesFromAuth,
  createEncodedRecap,
  createRecap,
  decodeRecap,
  encodeRecap,
  formatMessage,
  formatStatementFromRecap,
  getChainsFromRecap,
  getCommonValuesInArrays,
  getDecodedRecapsFromResources,
  getMethodsFromRecap,
  isValidRecap,
  populateAuthPayload,
} from "../src";

describe("URI", () => {
  it("formatStatementFromRecap", async () => {
    const payload = {
      chains: ["eip155:1", "eip155:2"],
      aud: "aud",
      domain: "localhost",
      version: "1",
      nonce: "1",
      iat: "2024-02-16T10:37:48.988Z",
      resources: [
        "urn:recap:eyJhdHQiOnsiZWlwMTU1IjpbeyJyZXF1ZXN0L2V0aF9jaGFpbklkIjpbe31dfSx7InJlcXVlc3QvZXRoX3NpZ25UeXBlZERhdGFfdjQiOlt7fV19LHsicmVxdWVzdC9wZXJzb25hbF9zaWduIjpbe31dfV19fQ==",
        "urn:recap:eyJhdHQiOnsiaHR0cHM6Ly9leGFtcGxlLmNvbSI6W3sicHVzaC9ub3RpZmljYXRpb24iOlt7fV19XX19",
      ],
    };
    const statement = formatMessage(
      payload,
      "did:pkh:eip155:1:0x1234567890123456789012345678901234567890",
    );
    console.log("statement", statement);

    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  });

  it.only("shoud create a recap with given resource DONW", async () => {
    const recap = createRecap("https://web3inbox.com", "push", ["notifications", "alerts"]);
    isValidRecap(recap);

    const encoded = encodeRecap(recap);
    console.log("encoded", encoded);
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  });

  it("shoud encode recap DONE", async () => {
    const recap = createRecap("eip155", "request", ["personal_sign", "eth_signTypedData_v4"]);
    isValidRecap(recap);
    const encoded = encodeRecap(recap);
    expect(encoded).to.be.a("string");
    expect(encoded).to.include("urn:recap:");
    console.log("encoded", encoded);
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  });

  it("should build recap statement from encoded recap DONE", async () => {
    const recap = createRecap("eip155", "request", ["personal_sign", "eth_signTypedData_v4"]);
    isValidRecap(recap);
    console.log("recap", recap);
    const statement = formatStatementFromRecap(
      {
        att: {
          eip155: {
            "request/personal_sign": [{}],
            "request/eth_signTypedData_v4": [{}],
          },
        },
      },
      1,
    );
    console.log("statement", statement);
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  });

  it("should get methods from recap DONE", async () => {
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
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  });

  it("should get chains from recap", async () => {
    const recap = {
      att: {
        eip155: {
          "push/messages": [{ chains: ["eip155:1", "eip155:2"] }],
          "push/test": [{ chains: ["eip155:2", "eip155:3"] }],
        },
      },
    };
    const chains = getChainsFromRecap(encodeRecap(recap));
    console.log("chains", chains);
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  });

  it("should build namespaces from auth", async () => {
    const accounts = [
      "did:pkh:eip155:1:0x3613699A6c5D8BC97a08805876c8005543125F09",
      "did:pkh:eip155:2:0x3613699A6c5D8BC97a08805876c8005543125F09",
    ];
    const methods = ["personal_sign", "eth_signTypedData_v4"];

    const namespace = buildNamespacesFromAuth(methods, accounts);
  });
  it("sort recap abilities alphabetically", async () => {
    // const recap = formatRecapFromNamespaces("https://example.com", "push", [
    //   "personal_sign",
    //   "eth_sendTransaction",
    //   "eth_signTypedData_v4",
    // ]);
    const recap = {
      att: {
        "https://notify.walletconnect.com/all-apps": {
          "crud/notifications": [{}],
          "crud/subscriptions": [{}],
        },
      },
    };

    const encoded = encodeRecap(recap);
    const encodedExpected =
      "urn:recap:eyJhdHQiOnsiaHR0cHM6Ly9ub3RpZnkud2FsbGV0Y29ubmVjdC5jb20vYWxsLWFwcHMiOnsiY3J1ZC9ub3RpZmljYXRpb25zIjpbe31dLCJjcnVkL3N1YnNjcmlwdGlvbnMiOlt7fV19fX0K";
    console.log("recap", encoded);
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    const decoded = decodeRecap(encodedExpected);
    console.log("decoded", decoded);
    expect(decoded).to.eql(recap);
    expect(encoded).to.eql(encodedExpected);
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  });
  it("should find common values in two arrays", async () => {
    const arr1 = ["eip155:1", "eip155:2"];
    const arr2 = ["eip155:1", "eip155:3"];
    const res = getCommonValuesInArrays(arr1, arr2);
    console.log("res", res);
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  });
  it("should get decoded recaps from resources", async () => {
    const resources = [
      "urn:recap:eyJhdHQiOnsiZWlwMTU1IjpbeyJyZXF1ZXN0L3BlcnNvbmFsX3NpZ24iOltdfSx7InJlcXVlc3QvZXRoX3NpZ25UeXBlZERhdGFfdjQiOltdfV19fQ==",
      "https://example.com",
    ];

    const res = getDecodedRecapsFromResources(resources);

    console.log("res", JSON.stringify(res));
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  });
  it("should populate authPayload with supported chains/methods", async () => {
    const encoded = createEncodedRecap("eip155", "request", [
      "personal_sign",
      "eth_signTypedData_v4",
    ]);
    console.log("encoded1", encoded);
    const encoded2 = createEncodedRecap("eip155", "push", ["messages", "notification"]);
    console.log("encoded2", encoded2);
    const encoded3 = createEncodedRecap("eip155", "receive", ["messages", "notification"]);
    console.log("encoded3", encoded3);

    const requestedChains = ["eip155:1", "eip155:2"];
    const authPayload = {
      chains: requestedChains,
      aud: "aud",
      domain: "localhost",
      version: "1",
      nonce: "1",
      iat: "2023-12-14T08:48:37.902Z",
      resources: [encoded, "https://example.com"],
    };

    const suppportedChains = ["eip155:2", "eip155:3"];
    const supportedMethods = ["personal_sign", "eth_signTypedData"];
    const updatedAuthPayload = populateAuthPayload({
      authPayload,
      chains: suppportedChains,
      methods: supportedMethods,
    });

    const approvedChains = ["eip155:2"];
    expect(updatedAuthPayload.chains).to.eql(approvedChains);
    const recaps = getDecodedRecapsFromResources(updatedAuthPayload.resources);
    expect(recaps.length).to.eql(1);
    const recap = recaps[0];
    isValidRecap(recap);

    const approvedMethods = ["personal_sign"];
    console.log("recap", recap);
    expect(getMethodsFromRecap(encodeRecap(recap))).to.eql(approvedMethods);
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  });

  it("should numerate unique recap abilities correctly DONE", async () => {
    const request = {
      type: "caip122",
      chains: ["eip155:1"],
      aud: "https://example.com",
      domain: "http://localhost:3000",
      version: "1",
      nonce: "1",
      iat: "2024-02-19T09:29:21.394Z",
      // statement: "Requesting access to your account",
      resources: [
        "urn:recap:eyJhdHQiOnsiZWlwMTU1Ijp7InJlcXVlc3QvZXRoX3NpZ25UeXBlZERhdGFfdjQiOlt7fV0sInJlcXVlc3QvcGVyc29uYWxfc2lnbiI6W3t9XX19fQ==",
        "https://example.com",
        "urn:recap:eyJhdHQiOnsiZWlwMTU1Ijp7InB1c2gvbWVzc2FnZXMiOlt7fV0sInB1c2gvbm90aWZpY2F0aW9uIjpbe31dfX19",
        "urn:recap:eyJhdHQiOnsiZWlwMTU1Ijp7InB1c2gvbWVzc2FnZXMiOlt7fV0sInB1c2gvbm90aWZpY2F0aW9uIjpbe31dfX19",
        "urn:recap:eyJhdHQiOnsiZWlwMTU1Ijp7InB1c2gvbWVzc2FnZXMiOlt7fV0sInB1c2gvbm90aWZpY2F0aW9uIjpbe31dfX19",
        "urn:recap:eyJhdHQiOnsiZWlwMTU1Ijp7InJlY2VpdmUvbWVzc2FnZXMiOlt7fV0sInJlY2VpdmUvbm90aWZpY2F0aW9uIjpbe31dfX19",
      ],
    };

    const message = formatMessage(
      request as any,
      "did:pkh:eip155:1:0x3613699A6c5D8BC97a08805876c8005543125F09",
    );
    console.log("message", message);

    // the above resources[] should produce 5 capability statements
    expect(message).to.include("(1)");
    expect(message).to.include("(2)");
    expect(message).to.include("(3)");
    expect(message).to.include("(4)");
    expect(message).to.include("(5)");
    expect(message).to.not.include("(6)");

    expect(message).to.include("Version: 1");
    expect(message).to.include("Nonce: 1");
    expect(message).to.include(`URI: ${request.aud}`);
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  });
  describe("resurces", () => {
    it("should not add resources to siwe message when missing from request DONE", async () => {
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
      console.log("message", message);

      expect(message).to.include("Version: 1");
      expect(message).to.include("Nonce: 1");
      expect(message).to.include(`URI: ${request.aud}`);
      expect(message).to.not.include(`Resources:`);
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    });
    it("should add resources to siwe message when is empty array DONE", async () => {
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
      console.log("message", message);

      expect(message).to.include("Version: 1");
      expect(message).to.include("Nonce: 1");
      expect(message).to.include(`URI: ${request.aud}`);
      expect(message).to.include(`Resources:`);
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    });
    it("should add resources items to siwe message DONE", async () => {
      const request = {
        type: "caip122",
        chains: ["eip155:1"],
        aud: "https://example.com",
        domain: "http://localhost:3000",
        version: "1",
        nonce: "1",
        iat: "2024-02-19T09:29:21.394Z",
        statement: "Requesting access to your account",
        resources: ["https://example.com"],
      };

      const message = formatMessage(
        request as any,
        "did:pkh:eip155:1:0x3613699A6c5D8BC97a08805876c8005543125F09",
      );
      console.log("message", message);

      expect(message).to.include("Version: 1");
      expect(message).to.include("Nonce: 1");
      expect(message).to.include(`URI: ${request.aud}`);
      expect(message).to.include(`Resources:`);
      expect(message).to.include(request.resources[0]);
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    });
  });
});
