import "mocha";
import * as chai from "chai";
import { Caip25StateParams, Caip25StateSettled } from "@walletconnect/types";
import {
  generateCaip25ProposalSetting,
  generateSettledSetting,
  generateStatelessProposalSetting,
  handleSettledSettingStateUpdate,
} from "../src";

const TEST_SESSION_CHAINS = ["eip155:1"];
const TEST_SESSION_METHODS = ["eth_sendTransaction", "eth_signTypedData", "personal_sign"];

const TEST_KEY_PAIRS = {
  A: {
    privateKey: "ef1b823316362facbc6b91e56f9ca9b30307f3d568546b9e093a2a50232806a7",
    publicKey: "03c96ae71f5abf658fafa789d90060fcc16cadf2515a9aab9c6b47e04c40164568",
  },
  B: {
    privateKey: "2e4e06116d04373db48ddc53ca119ac37ca1e32f460bb291c1794b1a0c299116",
    publicKey: "037e230250164941426bd5cf197d1fc432b3c6a9b9a66ec485b8762859e042cf39",
  },
};

const TEST_SESSION_ACCOUNTS = ["0x1d85568eEAbad713fBB5293B45ea066e552A90De@eip155:1"];

const TEST_CAIP25_PROPOSAL_SETTING = {
  state: {
    params: {
      accounts: {
        chains: TEST_SESSION_CHAINS,
      },
    },
    writeAccess: {
      accounts: {
        proposer: false,
        responder: true,
      },
    },
  },
  jsonrpc: {
    methods: TEST_SESSION_METHODS,
  },
};

const TEST_STATELESS_PROPOSAL_SETTING = {
  state: { params: {}, writeAccess: {} },
  jsonrpc: { methods: TEST_SESSION_METHODS },
};

const TEST_STATELESS_SETTLED_SETTING = {
  state: { data: {}, writeAccess: {} },
  jsonrpc: { methods: TEST_SESSION_METHODS },
};

const TEST_PROPOSER = { publicKey: TEST_KEY_PAIRS["A"].publicKey };
const TEST_RESPONDER = { publicKey: TEST_KEY_PAIRS["B"].publicKey };

const TEST_CAIP25_SETTLED_STATE = { accounts: TEST_SESSION_ACCOUNTS };

const TEST_CAIP25_SETTLED_SETTING = {
  state: {
    data: TEST_CAIP25_SETTLED_STATE,
    writeAccess: {
      accounts: {
        [TEST_PROPOSER.publicKey]: false,
        [TEST_RESPONDER.publicKey]: true,
      },
    },
  },
  jsonrpc: {
    methods: TEST_SESSION_METHODS,
  },
};

const TEST_CAIP25_UPDATED_STATE = {
  accounts: ["0x457468657265756d50504c4e532f326d696e6572735f4555@eip155:1"],
};

describe("Settings", () => {
  it("generateStatelessProposalSetting", async () => {
    const result = generateStatelessProposalSetting({ methods: TEST_SESSION_METHODS });
    const expected = TEST_STATELESS_PROPOSAL_SETTING;
    chai.expect(result.toString()).to.eql(expected.toString());
  });
  it("generateSettledSetting (stateless)", async () => {
    const result = generateSettledSetting({
      proposal: TEST_STATELESS_PROPOSAL_SETTING,
      proposer: { publicKey: TEST_KEY_PAIRS["A"].publicKey },
      responder: { publicKey: TEST_KEY_PAIRS["B"].publicKey },
      state: {},
    });
    const expected = TEST_STATELESS_SETTLED_SETTING;
    chai.expect(result.toString()).to.equal(expected.toString());
  });
  it("generateCaip25ProposalSetting", async () => {
    const result = generateCaip25ProposalSetting({
      chains: TEST_SESSION_CHAINS,
      methods: TEST_SESSION_METHODS,
    });
    const expected = TEST_CAIP25_PROPOSAL_SETTING;
    chai.expect(result.toString()).to.equal(expected.toString());
  });
  it("generateSettledSetting (caip25)", async () => {
    const result = generateSettledSetting<Caip25StateParams, Caip25StateSettled>({
      proposal: TEST_CAIP25_PROPOSAL_SETTING,
      proposer: { publicKey: TEST_KEY_PAIRS["A"].publicKey },
      responder: { publicKey: TEST_KEY_PAIRS["B"].publicKey },
      state: TEST_CAIP25_SETTLED_STATE,
    });
    const expected = TEST_CAIP25_SETTLED_SETTING;
    chai.expect(result.toString()).to.equal(expected.toString());
  });
  it("handleSettledSettingStateUpdate (authorized)", async () => {
    const result = handleSettledSettingStateUpdate({
      settled: TEST_CAIP25_SETTLED_SETTING,
      update: TEST_CAIP25_UPDATED_STATE,
      participant: TEST_RESPONDER,
    });
    const expected = TEST_CAIP25_UPDATED_STATE;
    chai.expect(result.toString()).to.equal(expected.toString());
  });
  it("handleSettledSettingStateUpdate (unauthorized)", async () => {
    chai.expect(() =>
      handleSettledSettingStateUpdate({
        settled: TEST_CAIP25_SETTLED_SETTING,
        update: TEST_CAIP25_UPDATED_STATE,
        participant: TEST_PROPOSER,
      }),
    ).to.throw(`Unauthorized state update for key: accounts`);
  });
});
