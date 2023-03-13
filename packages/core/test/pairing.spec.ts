import { expect, describe, it, beforeEach, afterEach } from "vitest";
import { ICore } from "@walletconnect/types";
import { Core, CORE_PROTOCOL, CORE_VERSION } from "../src";
import { TEST_CORE_OPTIONS, disconnectSocket } from "./shared";
import { generateRandomBytes32 } from "@walletconnect/utils";

const waitForEvent = async (checkForEvent: (...args: any[]) => boolean) => {
  await new Promise((resolve) => {
    const intervalId = setInterval(() => {
      if (checkForEvent()) {
        clearInterval(intervalId);
        resolve({});
      }
    }, 100);
  });
};

const createCoreClients: () => Promise<{ coreA: ICore; coreB: ICore }> = async () => {
  const coreA = new Core(TEST_CORE_OPTIONS);
  const coreB = new Core(TEST_CORE_OPTIONS);
  await coreA.start();
  await coreB.start();
  return { coreA, coreB };
};

describe("Pairing", () => {
  let coreA: ICore;
  let coreB: ICore;

  beforeEach(async () => {
    const coreClients = await createCoreClients();
    coreA = coreClients.coreA;
    coreB = coreClients.coreB;
  });

  afterEach(async () => {
    await disconnectSocket(coreA.relayer);
    await disconnectSocket(coreB.relayer);
  });

  describe("init", () => {
    it("initializes", () => {
      expect(coreA.pairing.pairings).toBeDefined();
      expect(coreB.pairing.pairings).toBeDefined();
    });
  });

  describe("create", () => {
    it("returns the pairing topic and URI in expected format", async () => {
      const { topic, uri } = await coreA.pairing.create();
      expect(topic.length).toBe(64);
      expect(uri.startsWith(`${CORE_PROTOCOL}:${topic}@${CORE_VERSION}`)).toBe(true);
    });
  });

  describe("pair", () => {
    it("can pair via provided URI", async () => {
      const { uri } = await coreA.pairing.create();
      await coreB.pairing.pair({ uri });

      expect(coreA.pairing.pairings.keys.length).toBe(1);
      expect(coreB.pairing.pairings.keys.length).toBe(1);
      expect(coreA.pairing.pairings.keys).to.deep.equal(coreB.pairing.pairings.keys);
      expect(coreA.pairing.getPairings()[0].active).toBe(false);
      expect(coreB.pairing.getPairings()[0].active).toBe(false);
    });

    it("can auto-activate the pairing on pair step", async () => {
      const { uri } = await coreA.pairing.create();
      await coreB.pairing.pair({ uri, activatePairing: true });

      expect(coreA.pairing.getPairings()[0].active).toBe(false);
      expect(coreB.pairing.getPairings()[0].active).toBe(true);
    });

    it("throws when pairing is attempted on topic that already exists", async () => {
      const { topic, uri } = await coreA.pairing.create();
      await expect(coreA.pairing.pair({ uri })).rejects.toThrowError(
        `Pairing already exists: ${topic}`,
      );
    });

    it("throws when keychain already exists", async () => {
      const maliciousTopic = generateRandomBytes32();
      let { topic, uri } = await coreA.pairing.create();
      coreA.crypto.keychain.set(maliciousTopic, maliciousTopic);
      uri = uri.replace(topic, maliciousTopic);
      await expect(coreA.pairing.pair({ uri })).rejects.toThrowError(
        `Keychain already exists: ${maliciousTopic}`,
      );
    });
  });

  describe("activate", () => {
    it("can activate a pairing", async () => {
      const { topic } = await coreA.pairing.create();

      const inactivePairing = coreA.pairing.pairings.get(topic);
      expect(inactivePairing.active).toBe(false);
      await coreA.pairing.activate({ topic });
      expect(coreA.pairing.pairings.get(topic).active).toBe(true);
      expect(coreA.pairing.pairings.get(topic).expiry > inactivePairing.expiry).toBe(true);
    });
  });

  describe("updateExpiry", () => {
    it("can update a pairing's expiry", async () => {
      const mockExpiry = 11111111;
      const { topic } = await coreA.pairing.create();

      await coreA.pairing.updateExpiry({ topic, expiry: mockExpiry });
      expect(coreA.pairing.pairings.get(topic).expiry).toBe(mockExpiry);
    });
  });

  describe("updateMetadata", () => {
    it("can update a pairing's `peerMetadata`", async () => {
      const mockMetadata = {
        name: "Mock",
        description: "Mock Metadata",
        url: "https://mockurl.com",
        icons: [],
      };
      const { topic } = await coreA.pairing.create();

      expect(coreA.pairing.pairings.get(topic).peerMetadata).toBeUndefined();
      await coreA.pairing.updateMetadata({ topic, metadata: mockMetadata });
      expect(coreA.pairing.pairings.get(topic).peerMetadata).toEqual(mockMetadata);
    });
  });

  describe("ping", () => {
    it("clients can ping each other", async () => {
      const { uri, topic } = await coreA.pairing.create();
      let gotPing = false;

      coreB.pairing.events.on("pairing_ping", () => {
        gotPing = true;
      });

      await coreB.pairing.pair({ uri });
      await coreA.pairing.ping({ topic });
      await waitForEvent(() => gotPing);

      expect(gotPing).toBe(true);
    });
  });

  describe("disconnect", () => {
    it("can disconnect a known pairing", async () => {
      const { uri, topic } = await coreA.pairing.create();
      let hasDeleted = false;

      coreA.pairing.events.on("pairing_delete", () => {
        hasDeleted = true;
      });

      await coreB.pairing.pair({ uri });
      await coreB.pairing.disconnect({ topic });
      await waitForEvent(() => hasDeleted);

      expect(coreA.pairing.pairings.keys.length).toBe(0);
      expect(coreB.pairing.pairings.keys.length).toBe(0);
      expect(coreA.pairing.pairings.keys).to.deep.equal(coreB.pairing.pairings.keys);
    });
  });

  describe("validations", () => {
    describe("pair", () => {
      it("throws when no params are passed", async () => {
        // @ts-expect-error - ignore TS error to test runtime validation
        await expect(coreA.pairing.pair()).rejects.toThrowError(
          "Missing or invalid. pair() params: undefined",
        );
      });

      it("throws when empty uri is provided", async () => {
        await expect(coreA.pairing.pair({ uri: "" })).rejects.toThrowError(
          "Missing or invalid. pair() uri: ",
        );
      });

      it("throws when invalid uri is provided", async () => {
        // @ts-expect-error - ignore TS error to test runtime validation
        await expect(coreA.pairing.pair({ uri: 123 })).rejects.toThrowError(
          "Missing or invalid. pair() uri: 123",
        );
      });

      it("throws when no uri is provided", async () => {
        // @ts-expect-error - ignore TS error to test runtime validation
        await expect(coreA.pairing.pair({ uri: undefined })).rejects.toThrowError(
          "Missing or invalid. pair() uri: undefined",
        );
      });
    });

    describe("ping", () => {
      it("throws when no params are passed", async () => {
        // @ts-expect-error - ignore TS error to test runtime validation
        await expect(coreA.pairing.ping()).rejects.toThrowError(
          "Missing or invalid. ping() params: undefined",
        );
      });

      it("throws when invalid topic is provided", async () => {
        // @ts-expect-error - ignore TS error to test runtime validation
        await expect(coreA.pairing.ping({ topic: 123 })).rejects.toThrowError(
          "Missing or invalid. pairing topic should be a string: 123",
        );
      });

      it("throws when empty topic is provided", async () => {
        await expect(coreA.pairing.ping({ topic: "" })).rejects.toThrowError(
          "Missing or invalid. pairing topic should be a string: ",
        );
      });

      it("throws when no topic is provided", async () => {
        // @ts-expect-error - ignore TS error to test runtime validation
        await expect(coreA.pairing.ping({ topic: undefined })).rejects.toThrowError(
          "Missing or invalid. pairing topic should be a string: undefined",
        );
      });

      it("throws when non existent topic is provided", async () => {
        await expect(coreA.pairing.ping({ topic: "none" })).rejects.toThrowError(
          "No matching key. pairing topic doesn't exist: none",
        );
      });
    });

    describe("disconnect", () => {
      it("throws when no params are passed", async () => {
        // @ts-expect-error - ignore TS error to test runtime validation
        await expect(coreA.pairing.disconnect()).rejects.toThrowError(
          "Missing or invalid. disconnect() params: undefined",
        );
      });

      it("throws when invalid topic is provided", async () => {
        // @ts-expect-error - ignore TS error to test runtime validation
        await expect(coreA.pairing.disconnect({ topic: 123 })).rejects.toThrowError(
          "Missing or invalid. pairing topic should be a string: 123",
        );
      });

      it("throws when empty topic is provided", async () => {
        await expect(coreA.pairing.disconnect({ topic: "" })).rejects.toThrowError(
          "Missing or invalid. pairing topic should be a string: ",
        );
      });

      it("throws when no topic is provided", async () => {
        // @ts-expect-error - ignore TS error to test runtime validation
        await expect(coreA.pairing.disconnect({ topic: undefined })).rejects.toThrowError(
          "Missing or invalid. pairing topic should be a string: undefined",
        );
      });

      it("throws when non existent topic is provided", async () => {
        await expect(coreA.pairing.disconnect({ topic: "none" })).rejects.toThrowError(
          "No matching key. pairing topic doesn't exist: none",
        );
      });
    });
  });
});
