import "mocha";
import { expect } from "chai";

import { validateBlockchainState, validateSessionProposeParamsPermissions } from "../src";

import {
  TEST_BLOCKCHAIN_PERMISSIONS,
  TEST_JSONRPC_PERMISSIONS,
  TEST_NOTIFICATIONS_PERMISSIONS,
  TEST_SESSION_METADATA,
  TEST_SESSION_PERMISSIONS,
  TEST_SESSION_STATE,
  TEST_ETHEREUM_ACCOUNTS,
} from "./shared";
import { validateSessionProposeParamsMetadata } from "../dist/cjs";

const TEST_INVALID_BLOCKCHAIN_PERMISSIONS = {
  ...TEST_SESSION_PERMISSIONS,
  blockchain: {
    chains: [1],
  },
};

const TEST_INVALID_JSONRPC_PERMISSIONS = {
  ...TEST_SESSION_PERMISSIONS,
  jsonrpc: {
    names: TEST_JSONRPC_PERMISSIONS.methods,
  },
};

const TEST_INVALID_NOTIFICATIONS_PERMISSIONS = {
  ...TEST_SESSION_PERMISSIONS,
  notifications: {
    names: TEST_NOTIFICATIONS_PERMISSIONS.types,
  },
};

const TEST_INVALID_METADATA_NAME = {
  ...TEST_SESSION_METADATA,
  name: "",
};

const TEST_INVALID_METADATA_DESC = {
  ...TEST_SESSION_METADATA,
  description: "",
};

const TEST_INVALID_METADATA_URL = {
  ...TEST_SESSION_METADATA,
  url: "john",
};

const TEST_INVALID_METADATA_ICONS = {
  ...TEST_SESSION_METADATA,
  icons: ["image.png"],
};

const TEST_INVALID_STATE = {
  ...TEST_SESSION_STATE,
  accounts: [TEST_ETHEREUM_ACCOUNTS[0]],
};

const TEST_MISMATCH_STATE = {
  ...TEST_SESSION_STATE,
  accounts: [`eip155:100:${TEST_ETHEREUM_ACCOUNTS}`],
};

describe("Validators", () => {
  it("validateSessionProposeParamsPermissions", () => {
    expect(validateSessionProposeParamsPermissions(TEST_SESSION_PERMISSIONS)).to.eql({
      valid: true,
    });
    expect(
      validateSessionProposeParamsPermissions(TEST_INVALID_BLOCKCHAIN_PERMISSIONS as any),
    ).to.eql({
      valid: false,
      error: { code: 1000, message: "Missing or invalid blockchain permissions" },
    });
    expect(validateSessionProposeParamsPermissions(TEST_INVALID_JSONRPC_PERMISSIONS as any)).to.eql(
      {
        valid: false,
        error: { code: 1000, message: "Missing or invalid jsonrpc permissions" },
      },
    );
    expect(
      validateSessionProposeParamsPermissions(TEST_INVALID_NOTIFICATIONS_PERMISSIONS as any),
    ).to.eql({
      valid: false,
      error: { code: 1000, message: "Missing or invalid notification permissions" },
    });
  });

  it("validateSessionProposeParamsMetadata", () => {
    expect(validateSessionProposeParamsMetadata(TEST_SESSION_METADATA)).to.eql({ valid: true });
    expect(validateSessionProposeParamsMetadata(TEST_INVALID_METADATA_NAME as any)).to.eql({
      valid: false,
      error: { code: 1000, message: "Missing or invalid metadata name" },
    });
    expect(validateSessionProposeParamsMetadata(TEST_INVALID_METADATA_DESC as any)).to.eql({
      valid: false,
      error: { code: 1000, message: "Missing or invalid metadata description" },
    });
    expect(validateSessionProposeParamsMetadata(TEST_INVALID_METADATA_URL as any)).to.eql({
      valid: false,
      error: { code: 1000, message: "Missing or invalid metadata url" },
    });
    expect(validateSessionProposeParamsMetadata(TEST_INVALID_METADATA_ICONS as any)).to.eql({
      valid: false,
      error: { code: 1000, message: "Missing or invalid metadata icons" },
    });
  });

  it("validBlockchainState", () => {
    expect(validateBlockchainState(TEST_SESSION_STATE, TEST_BLOCKCHAIN_PERMISSIONS)).to.eql({
      valid: true,
    });
    expect(validateBlockchainState(TEST_INVALID_STATE, TEST_BLOCKCHAIN_PERMISSIONS)).to.eql({
      valid: false,
      error: { code: 1000, message: "Missing or invalid state accounts" },
    });
    expect(validateBlockchainState(TEST_MISMATCH_STATE, TEST_BLOCKCHAIN_PERMISSIONS)).to.eql({
      valid: false,
      error: {
        code: 1501,
        message: `Invalid accounts with mismatched chains: ${TEST_MISMATCH_STATE.accounts[0]}`,
      },
    });
  });
});
