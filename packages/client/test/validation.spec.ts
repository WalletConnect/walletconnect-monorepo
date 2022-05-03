import "mocha";
import {
  expect,
  initTwoClients,
  testConnectMethod,
  TEST_APPROVE_PARAMS,
  TEST_CONNECT_PARAMS,
} from "./shared";

describe("Client Validation", () => {
  const clients = await initTwoClients();
  await testConnectMethod(clients);
  const { A } = clients;
  const pairingTopic = A.pairing.keys[0];

  describe("connect", () => {
    it("throws when no params are passed", async () => {
      // @ts-expect-error
      await expect(A.connect()).to.eventually.be.rejectedWith("Missing or invalid connect params");
    });
    it("throws when non existant pairingTopic is provided", async () => {
      await expect(
        A.connect({ ...TEST_CONNECT_PARAMS, pairingTopic: "none" }),
      ).to.eventually.be.rejectedWith("No matching pairing with topic: none");
    });
    it("throws when empty namespaces are provided", async () => {
      await expect(
        A.connect({ ...TEST_CONNECT_PARAMS, pairingTopic, namespaces: [] }),
      ).to.eventually.be.rejectedWith("Missing or invalid namespaces");
    });
    it("throws when invalid namespaces are provided", async () => {
      await expect(
        // @ts-expect-error
        A.connect({ ...TEST_CONNECT_PARAMS, pairingTopic, namespaces: {} }),
      ).to.eventually.be.rejectedWith("Missing or invalid namespaces");
    });
  });

  describe("pair", () => {
    it("throws when undefined params are passed", async () => {
      // @ts-expect-error
      await expect(A.pair()).to.eventually.be.rejectedWith("Missing or invalid uri");
    });
    it("throws when empty uri is provided", async () => {
      await expect(A.pair({ uri: "" })).to.eventually.be.rejectedWith("Missing or invalid uri");
    });
    it("throws when invalid uri is provided", async () => {
      // @ts-expect-error
      await expect(A.pair({ uri: 123 })).to.eventually.be.rejectedWith("Missing or invalid uri");
    });
  });

  describe("approve", () => {
    it("throws when undefined params are passed", async () => {
      // @ts-expect-error
      await expect(A.approve()).to.eventually.be.rejectedWith("Missing or invalid uri");
    });
    it("throws when invalid id is provided", async () => {
      await expect(
        // @ts-expect-error
        A.approve({ ...TEST_APPROVE_PARAMS, id: "123" }),
      ).to.eventually.be.rejectedWith("balegdeh");
    });
  });
});
