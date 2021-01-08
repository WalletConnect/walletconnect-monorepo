import "mocha";
import * as chai from "chai";
import { SessionTypes } from "@walletconnect/types";

import { validateSessionProposeParamsPermissions } from "../src";

import {
  TEST_JSONRPC_PERMISSIONS,
  TEST_NOTIFICATIONS_PERMISSIONS,
  TEST_SESSION_METADATA,
  TEST_SESSION_PERMISSIONS,
} from "./shared";
import { validateSessionProposeParamsMetadata } from "../dist/cjs";

const TEST_INVALID_BLOCKCHAIN_PERMISSIONS = {
  ...TEST_SESSION_PERMISSIONS,
  blockchain: {
    chainIds: [1],
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

describe("Validators", () => {
  it("validateSessionProposeParamsPermissions", () => {
    chai
      .expect(validateSessionProposeParamsPermissions(TEST_SESSION_PERMISSIONS))
      .to.eql({ valid: true });
    chai
      .expect(validateSessionProposeParamsPermissions(TEST_INVALID_BLOCKCHAIN_PERMISSIONS as any))
      .to.eql({ valid: false, error: "Missing or invalid blockchain permissions" });
    chai
      .expect(validateSessionProposeParamsPermissions(TEST_INVALID_JSONRPC_PERMISSIONS as any))
      .to.eql({ valid: false, error: "Missing or invalid jsonrpc permissions" });
    chai
      .expect(
        validateSessionProposeParamsPermissions(TEST_INVALID_NOTIFICATIONS_PERMISSIONS as any),
      )
      .to.eql({ valid: false, error: "Missing or invalid notification permissions" });
  });

  it("validateSessionProposeParamsMetadata", () => {
    chai
      .expect(validateSessionProposeParamsMetadata(TEST_SESSION_METADATA))
      .to.eql({ valid: true });
    chai
      .expect(validateSessionProposeParamsMetadata(TEST_INVALID_METADATA_NAME as any))
      .to.eql({ valid: false, error: "Missing or invalid metadata name" });
    chai
      .expect(validateSessionProposeParamsMetadata(TEST_INVALID_METADATA_DESC as any))
      .to.eql({ valid: false, error: "Missing or invalid metadata description" });
    chai
      .expect(validateSessionProposeParamsMetadata(TEST_INVALID_METADATA_URL as any))
      .to.eql({ valid: false, error: "Missing or invalid metadata url" });
    chai
      .expect(validateSessionProposeParamsMetadata(TEST_INVALID_METADATA_ICONS as any))
      .to.eql({ valid: false, error: "Missing or invalid metadata icons" });
  });
});
