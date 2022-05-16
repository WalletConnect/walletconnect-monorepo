import "mocha";
import { expect } from "chai";
import {
  TEST_ACCOUNTS,
  TEST_CHAINS,
  TEST_ETHEREUM_ADDRESS,
  TEST_EVENTS,
  TEST_EXPIRY_30D,
  TEST_EXPIRY_7D,
  TEST_METHODS,
  TEST_SESSION,
} from "./shared/values";

import { isSessionCompatible } from "../src";

describe("Validators", () => {
  it("isSessionCompatible", () => {
    // chains
    expect(
      isSessionCompatible(TEST_SESSION, {
        chains: TEST_CHAINS,
      }),
    ).to.be.true;
    expect(
      isSessionCompatible(TEST_SESSION, {
        chains: ["eip155:100"],
      }),
    ).to.be.false;
    // accounts
    expect(
      isSessionCompatible(TEST_SESSION, {
        accounts: TEST_ACCOUNTS,
      }),
    ).to.be.true;
    expect(
      isSessionCompatible(TEST_SESSION, {
        accounts: [`eip155:100:${TEST_ETHEREUM_ADDRESS}`],
      }),
    ).to.be.false;
    // methods
    expect(
      isSessionCompatible(TEST_SESSION, {
        methods: TEST_METHODS,
      }),
    ).to.be.true;
    expect(
      isSessionCompatible(TEST_SESSION, {
        methods: [`blockchain_signMessage`],
      }),
    ).to.be.false;
    // events
    expect(
      isSessionCompatible(TEST_SESSION, {
        events: TEST_EVENTS,
      }),
    ).to.be.true;
    expect(
      isSessionCompatible(TEST_SESSION, {
        events: [`colorChanged`],
      }),
    ).to.be.false;
    // expiry
    expect(
      isSessionCompatible(TEST_SESSION, {
        expiry: TEST_EXPIRY_7D,
      }),
    ).to.be.true;
    expect(
      isSessionCompatible(TEST_SESSION, {
        expiry: TEST_EXPIRY_30D,
      }),
    ).to.be.false;
    // chains & methods
    expect(
      isSessionCompatible(TEST_SESSION, {
        chains: TEST_CHAINS,
        methods: TEST_METHODS,
      }),
    ).to.be.true;
    expect(
      isSessionCompatible(TEST_SESSION, {
        chains: ["eip155:100"],
        methods: TEST_METHODS,
      }),
    ).to.be.false;
    expect(
      isSessionCompatible(TEST_SESSION, {
        chains: TEST_CHAINS,
        methods: [`blockchain_signMessage`],
      }),
    ).to.be.false;
  });
});
