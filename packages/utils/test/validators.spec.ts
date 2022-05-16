import "mocha";
import { expect } from "chai";
import {
  TEST_CHAINS,
  TEST_ETHEREUM_CHAIN_A,
  TEST_ETHEREUM_NAMESPACE,
  TEST_EVENTS,
  TEST_METHODS,
  TEST_SESSION,
} from "./shared/values";

import { isSessionCompatible } from "../src";

describe("Validators", () => {
  it("isSessionCompatible", () => {
    // exact
    expect(
      isSessionCompatible(TEST_SESSION, {
        requiredNamespaces: {
          [TEST_ETHEREUM_NAMESPACE]: {
            chains: TEST_CHAINS,
            methods: TEST_METHODS,
            events: TEST_EVENTS,
          },
        },
      }),
    ).to.be.true;
    // chains
    expect(
      isSessionCompatible(TEST_SESSION, {
        requiredNamespaces: {
          [TEST_ETHEREUM_NAMESPACE]: {
            chains: [TEST_ETHEREUM_CHAIN_A],
            methods: TEST_METHODS,
            events: TEST_EVENTS,
          },
        },
      }),
    ).to.be.true;
    expect(
      isSessionCompatible(TEST_SESSION, {
        requiredNamespaces: {
          [TEST_ETHEREUM_NAMESPACE]: {
            chains: [...TEST_CHAINS, "eip155:100"],
            methods: TEST_METHODS,
            events: TEST_EVENTS,
          },
        },
      }),
    ).to.be.false;
    // methods
    expect(
      isSessionCompatible(TEST_SESSION, {
        requiredNamespaces: {
          [TEST_ETHEREUM_NAMESPACE]: {
            chains: TEST_CHAINS,
            methods: ["personal_sign"],
            events: TEST_EVENTS,
          },
        },
      }),
    ).to.be.true;
    expect(
      isSessionCompatible(TEST_SESSION, {
        requiredNamespaces: {
          [TEST_ETHEREUM_NAMESPACE]: {
            chains: TEST_CHAINS,
            methods: [...TEST_METHODS, "blockchain_signMessage"],
            events: TEST_EVENTS,
          },
        },
      }),
    ).to.be.false;
    // events
    expect(
      isSessionCompatible(TEST_SESSION, {
        requiredNamespaces: {
          [TEST_ETHEREUM_NAMESPACE]: {
            chains: TEST_CHAINS,
            methods: TEST_METHODS,
            events: ["accountsChanged"],
          },
        },
      }),
    ).to.be.true;
    expect(
      isSessionCompatible(TEST_SESSION, {
        requiredNamespaces: {
          [TEST_ETHEREUM_NAMESPACE]: {
            chains: TEST_CHAINS,
            methods: TEST_METHODS,
            events: [...TEST_EVENTS, `colorChanged`],
          },
        },
      }),
    ).to.be.false;
    // wrong namespace
    expect(
      isSessionCompatible(TEST_SESSION, {
        requiredNamespaces: {
          ["cosmos"]: {
            chains: TEST_CHAINS,
            methods: TEST_METHODS,
            events: TEST_EVENTS,
          },
        },
      }),
    ).to.be.false;
  });
});
