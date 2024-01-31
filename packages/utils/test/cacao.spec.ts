import { describe, it } from "vitest";
import {
  buildNamespacesFromAuth,
  formatMessage,
  formatRecapFromNamespaces,
  getMethodsFromRecap,
} from "../src";

describe("URI", () => {
  it("formatStatementFromRecap", async () => {
    const payload = {
      chains: ["eip155:1", "eip155:2"],
      aud: "aud",
      domain: "localhost",
      version: "1",
      nonce: "1",
      iat: "2023-12-14T08:48:37.902Z",
      resources: [
        "urn:recap:eyJhdHQiOnsiZWlwMTU1IjpbeyJyZXF1ZXN0L3BlcnNvbmFsX3NpZ24iOltdfSx7InJlcXVlc3QvZXRoX3NpZ25UeXBlZERhdGFfdjQiOltdfV19fQ==",
      ],
    };
    const statement = formatMessage(
      payload,
      "did:pkh:eip155:1:0x1234567890123456789012345678901234567890",
    );
    console.log("statement", statement);

    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  });

  it("should get methods from recap", async () => {
    const recap =
      "urn:recap:eyJhdHQiOnsiZWlwMTU1IjpbeyJyZXF1ZXN0L3BlcnNvbmFsX3NpZ24iOltdfSx7InJlcXVlc3QvZXRoX3NpZ25UeXBlZERhdGFfdjQiOltdfV19fQ==";
    const methods = getMethodsFromRecap(recap);
    console.log("methods", methods);
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
    const recap = formatRecapFromNamespaces("eip155", "request", [
      "personal_sign",
      "eth_sendTransaction",
      "eth_signTypedData_v4",
    ]);
    console.log("recap", recap);
  });
});
