import "mocha";
import * as chai from "chai";
import { SessionTypes } from "@walletconnect/types";

import { isValidSessionProposalPermissions } from "../src";

import {
  TEST_JSONRPC_PERMISSIONS,
  TEST_NOTIFICATIONS_PERMISSIONS,
  TEST_SESSION_METADATA,
  TEST_SESSION_PERMISSIONS,
} from "./shared";
import { isValidSessionProposalMetadata } from "../dist/cjs";

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
  it("isValidSessionProposalPermissions", () => {
    chai.expect(() => isValidSessionProposalPermissions(TEST_SESSION_PERMISSIONS)).to.not.throw();
    chai
      .expect(() => isValidSessionProposalPermissions(TEST_INVALID_BLOCKCHAIN_PERMISSIONS as any))
      .to.throw("Missing or invalid blockchain permissions");
    chai
      .expect(() => isValidSessionProposalPermissions(TEST_INVALID_JSONRPC_PERMISSIONS as any))
      .to.throw("Missing or invalid jsonrpc permissions");
    chai
      .expect(() =>
        isValidSessionProposalPermissions(TEST_INVALID_NOTIFICATIONS_PERMISSIONS as any),
      )
      .to.throw("Missing or invalid notification permissions");
  });

  it("isValidSessionProposalMetadata", () => {
    chai.expect(() => isValidSessionProposalMetadata(TEST_SESSION_METADATA)).to.not.throw();
    chai
      .expect(() => isValidSessionProposalMetadata(TEST_INVALID_METADATA_NAME as any))
      .to.throw("Missing or invalid metadata name");
    chai
      .expect(() => isValidSessionProposalMetadata(TEST_INVALID_METADATA_DESC as any))
      .to.throw("Missing or invalid metadata description");
    chai
      .expect(() => isValidSessionProposalMetadata(TEST_INVALID_METADATA_URL as any))
      .to.throw("Missing or invalid metadata url");
    chai
      .expect(() => isValidSessionProposalMetadata(TEST_INVALID_METADATA_ICONS as any))
      .to.throw("Missing or invalid metadata icons");
  });
});
