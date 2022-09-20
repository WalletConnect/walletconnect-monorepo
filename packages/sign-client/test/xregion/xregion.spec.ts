import { expect, describe, it } from "vitest";
import SignClient from "../../src";
import {
  TEST_SIGN_CLIENT_OPTIONS,
  TEST_RELAY_URL,
  TEST_RELAY_URL_US,
  TEST_SIGN_CLIENT_OPTIONS_USA,
  TEST_RELAY_URL_AP,
  TEST_RELAY_URL_EU,
  TEST_SIGN_CLIENT_OPTIONS_AP,
  TEST_SIGN_CLIENT_OPTIONS_EU,
} from "../shared";

describe("X Region", () => {
  it("init", async () => {
    const client = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS);
    expect(client).to.be.exist;
  });

  describe("connect", () => {
    it("connect with default region: ", async () => {
      const client = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS);
      const defaultRelayerRegion = await client.opts?.relayUrl;
      expect(defaultRelayerRegion).to.be.equal(TEST_RELAY_URL);
    });
    it("connect with default region, then switch to USA", async () => {
      const defaultRelayerClient = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS);
      await defaultRelayerClient.disconnect;
      const usRelayerClient = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS_USA);
      const usRelayerRegion = await usRelayerClient.opts?.relayUrl;
      expect(usRelayerRegion).to.be.equal(TEST_RELAY_URL_US);
    });
    it("connect with default region, then switch to EU", async () => {
      const defaultRelayerClient = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS);
      await defaultRelayerClient.disconnect;
      const usRelayerClient = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS_EU);
      const usRelayerRegion = await usRelayerClient.opts?.relayUrl;
      expect(usRelayerRegion).to.be.equal(TEST_RELAY_URL_EU);
    });
    it("connect with default region, then switch to AP", async () => {
      const defaultRelayerClient = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS);
      await defaultRelayerClient.disconnect;
      const usRelayerClient = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS_AP);
      const usRelayerRegion = await usRelayerClient.opts?.relayUrl;
      expect(usRelayerRegion).to.be.equal(TEST_RELAY_URL_AP);
    });
    it("connect with default region, switch to US, then back to default", async () => {
      const defaultRelayerClient = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS);
      await defaultRelayerClient.disconnect;
      const usRelayerClient = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS_AP);
      await usRelayerClient.disconnect;
      const defaultRelayerClientTwo = await SignClient.init(TEST_SIGN_CLIENT_OPTIONS);
      const defaultRelayerRegion = await defaultRelayerClientTwo.opts?.relayUrl;
      expect(defaultRelayerRegion).to.be.equal(TEST_RELAY_URL);
    });
  });
});
