import { AuthTypes } from "@walletconnect/types";
import { describe, expect, it } from "vitest";
import { verifySignature } from "../src";

describe("utils/signature", () => {
  describe("EIP-1271 signatures", () => {
    const chainId = "eip155:1";
    const projectId = process.env.TEST_PROJECT_ID!;
    const address = "0x2faf83c542b68f1b4cdc0e770e8cb9f567b08f71";
    const reconstructedMessage = `localhost wants you to sign in with your Ethereum account:
0x2faf83c542b68f1b4cdc0e770e8cb9f567b08f71

URI: http://localhost:3000/
Version: 1
Chain ID: 1
Nonce: 1665443015700
Issued At: 2022-10-10T23:03:35.700Z
Expiration Time: 2022-10-11T23:03:35.700Z`;

    it("passes for a valid signature", async () => {
      const cacaoSignature: AuthTypes.CacaoSignature = {
        t: "eip1271",
        s: "0xc1505719b2504095116db01baaf276361efd3a73c28cf8cc28dabefa945b8d536011289ac0a3b048600c1e692ff173ca944246cf7ceb319ac2262d27b395c82b1c",
      };

      const isValid = await verifySignature(
        address,
        reconstructedMessage,
        cacaoSignature,
        chainId,
        projectId,
      );
      expect(isValid).toBe(true);
    });
    it("fails for a bad signature", async () => {
      const cacaoSignature: AuthTypes.CacaoSignature = {
        t: "eip1271",
        s: "0xdead5719b2504095116db01baaf276361efd3a73c28cf8cc28dabefa945b8d536011289ac0a3b048600c1e692ff173ca944246cf7ceb319ac2262d27b395c82b1c",
      };

      const isValid = await verifySignature(
        address,
        reconstructedMessage,
        cacaoSignature,
        chainId,
        projectId,
      );
      expect(isValid).toBe(false);
    });
  });
});
