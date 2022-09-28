import { expect, describe, it, beforeEach } from "vitest";
import { getDefaultLoggerOptions } from "@walletconnect/logger";
import { IPairing } from "@walletconnect/types";
import pino from "pino";
import { Core, CORE_DEFAULT, CORE_PROTOCOL, CORE_VERSION, Pairing } from "../src";
import { TEST_CORE_OPTIONS } from "./shared";

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

const createPairingClient: () => Promise<IPairing> = async () => {
  const core = new Core(TEST_CORE_OPTIONS);
  await core.start();
  return core.pairing;
};

describe("Pairing", () => {
  describe("init", () => {
    it("initializes", async () => {
      const pairing = await createPairingClient();
      expect(pairing.pairings).toBeDefined();
    });
  });

  describe("create", () => {
    it("returns the pairing topic and URI in expected format", async () => {
      const pairing = await createPairingClient();
      const { topic, uri } = await pairing.create();
      expect(topic.length).toBe(64);
      expect(uri.startsWith(`${CORE_PROTOCOL}:${topic}@${CORE_VERSION}`)).toBe(true);
    });
  });

  describe("pair", () => {
    it("can pair via provided URI", async () => {
      const pairing = await createPairingClient();
      const pairingPeer = await createPairingClient();
      const { uri } = await pairing.create();
      await pairingPeer.pair({ uri });

      expect(pairing.pairings.keys.length).toBe(1);
      expect(pairingPeer.pairings.keys.length).toBe(1);
      expect(pairing.pairings.keys).to.deep.equal(pairingPeer.pairings.keys);
    });
  });

  describe("activate", () => {
    it("can activate a pairing", async () => {
      const pairing = await createPairingClient();
      const { topic } = await pairing.create();

      const inactivePairing = pairing.pairings.get(topic);
      expect(inactivePairing.active).toBe(false);
      await pairing.activate({ topic });
      expect(pairing.pairings.get(topic).active).toBe(true);
      expect(pairing.pairings.get(topic).expiry > inactivePairing.expiry).toBe(true);
    });
  });

  describe("updateExpiry", () => {
    it("can update a pairing's expiry", async () => {
      const mockExpiry = 11111111;
      const pairing = await createPairingClient();
      const { topic } = await pairing.create();

      await pairing.updateExpiry({ topic, expiry: mockExpiry });
      expect(pairing.pairings.get(topic).expiry).toBe(mockExpiry);
    });
  });

  describe("updateMetadata", () => {
    it("can update a pairing's `peerMetadata`", async () => {
      const mockMetadata = { name: "Mock", description: "Mock Metadata" };
      const pairing = await createPairingClient();
      const { topic } = await pairing.create();

      expect(pairing.pairings.get(topic).peerMetadata).toBeUndefined();
      await pairing.updateMetadata({ topic, metadata: mockMetadata });
      expect(pairing.pairings.get(topic).peerMetadata).toEqual(mockMetadata);
    });
  });

  describe("ping", () => {
    it("clients can ping each other", async () => {
      const pairing = await createPairingClient();
      const pairingPeer = await createPairingClient();
      const { uri, topic } = await pairing.create();
      let gotPing = false;

      pairingPeer.events.on("pairing_ping", () => {
        gotPing = true;
      });

      await pairingPeer.pair({ uri });
      await pairing.ping({ topic });
      await waitForEvent(() => gotPing);

      expect(gotPing).toBe(true);
    });
  });

  describe("disconnect", () => {
    it("can disconnect a known pairing", async () => {
      const pairing = await createPairingClient();
      const pairingPeer = await createPairingClient();
      const { uri, topic } = await pairing.create();
      let hasDeleted = false;

      pairing.events.on("pairing_delete", () => {
        hasDeleted = true;
      });

      await pairingPeer.pair({ uri });
      await pairingPeer.disconnect({ topic });
      await waitForEvent(() => hasDeleted);

      expect(pairing.pairings.keys.length).toBe(0);
      expect(pairingPeer.pairings.keys.length).toBe(0);
      expect(pairing.pairings.keys).to.deep.equal(pairingPeer.pairings.keys);
    });
  });
});
