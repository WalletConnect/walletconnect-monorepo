import { expect, describe, it } from "vitest";
import {
  TEST_CHAINS,
  TEST_ETHEREUM_CHAIN_A,
  TEST_ETHEREUM_NAMESPACE,
  TEST_EVENTS,
  TEST_METHODS,
  TEST_SESSION,
} from "./shared/values";

import {
  buildApprovedNamespaces,
  isConformingNamespaces,
  isSessionCompatible,
  mergeRequiredAndOptionalNamespaces,
} from "../src";

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
          cosmos: {
            chains: TEST_CHAINS,
            methods: TEST_METHODS,
            events: TEST_EVENTS,
          },
        },
      }),
    ).to.be.false;
  });
  it("should validate namespaces (configuration 1)", () => {
    const required = {
      eip155: {
        chains: ["eip155:1", "eip155:2", "eip155:3"],
        events: [],
        methods: ["eth_accounts", "personal_sign"],
      },
      "eip155:4": {
        events: [],
        methods: ["eth_accounts"],
      },
      solana: {
        chains: ["solana:1", "solana:2", "solana:3"],
        events: [],
        methods: ["eth_accounts", "personal_sign"],
      },
    };

    const approved = {
      eip155: {
        accounts: [
          "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
          "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
          "eip155:3:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
        ],
        events: [],
        methods: ["eth_accounts", "personal_sign"],
      },
      "eip155:4": {
        events: [],
        methods: ["eth_accounts"],
        accounts: ["eip155:4:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"],
      },
      "eip155:5": {
        events: [],
        methods: ["eth_sendTransaction"],
        accounts: ["eip155:5:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"],
      },
      solana: {
        accounts: [
          "solana:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
          "solana:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
          "solana:3:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
        ],
        events: [],
        methods: ["eth_accounts", "personal_sign"],
      },
    };
    const err = isConformingNamespaces(required, approved, "validators");
    expect(err).to.be.null;
  });
  it("should validate namespaces (configuration 2)", () => {
    const required = {
      "eip155:1": {
        events: [],
        methods: ["eth_accounts", "personal_sign"],
      },
      "eip155:2": {
        events: [],
        methods: ["eth_accounts"],
      },
      "solana:1": {
        events: [],
        methods: ["eth_accounts", "personal_sign"],
      },
    };

    const approved = {
      eip155: {
        accounts: [
          "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
          "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
          "eip155:3:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
        ],
        events: [],
        methods: ["eth_accounts", "personal_sign"],
      },
      solana: {
        accounts: ["solana:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"],
        events: [],
        methods: ["eth_accounts", "personal_sign"],
      },
    };
    const err = isConformingNamespaces(required, approved, "validators");
    expect(err).to.be.null;
  });
  it("should validate namespaces (configuration 3)", () => {
    const required = {
      eip155: {
        chains: ["eip155:1"],
        events: [],
        methods: ["eth_accounts"],
      },
    };

    const approved = {
      eip155: {
        accounts: [
          "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
          "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
        ],
        events: ["chainChanged"],
        methods: ["eth_accounts", "personal_sign"],
      },
    };
    const err = isConformingNamespaces(required, approved, "validators");
    expect(err).to.be.null;
  });

  it("should validate namespaces (configuration 4)", () => {
    const required = {
      eip155: {
        chains: ["eip155:1", "eip155:2"],
        events: [],
        methods: ["eth_accounts"],
      },
    };

    const approved = {
      "eip155:1": {
        accounts: ["eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"],
        events: ["chainChanged"],
        methods: ["eth_accounts"],
      },
      "eip155:2": {
        accounts: ["eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"],
        events: ["chainChanged"],
        methods: ["eth_accounts"],
      },
    };
    const err = isConformingNamespaces(required, approved, "validators");
    expect(err).to.be.null;
  });

  it("should throw on invalid accounts", () => {
    const required = {
      eip155: {
        chains: ["eip155:1"],
        events: [],
        methods: ["eth_accounts"],
      },
    };

    const approved = {
      eip155: {
        accounts: ["eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"],
        events: ["chainChanged"],
        methods: ["eth_accounts", "personal_sign"],
      },
    };
    const error = isConformingNamespaces(required, approved, "validators");
    expect(error).to.not.be.null;
    expect(error).to.throw;
  });
  it("should throw on invalid namespace", () => {
    const required = {
      eip155: {
        chains: ["eip155:1"],
        events: [],
        methods: ["eth_accounts"],
      },
    };

    const approved = {
      solana: {
        accounts: ["solana:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"],
        events: ["chainChanged"],
        methods: ["eth_accounts", "personal_sign"],
      },
    };
    const error = isConformingNamespaces(required, approved, "validators");
    expect(error).to.not.be.null;
    expect(error).to.throw;
  });

  it("should throw on invalid methods", () => {
    const required = {
      eip155: {
        chains: ["eip155:1"],
        events: [],
        methods: ["eth_accounts"],
      },
    };

    const approved = {
      eip155: {
        accounts: ["eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"],
        events: ["chainChanged"],
        methods: ["personal_sign"],
      },
    };
    const error = isConformingNamespaces(required, approved, "validators");
    expect(error).to.not.be.null;
    expect(error).to.throw;
  });

  it("should throw on CAIP-2 namespace not including that CAIP-2 in accounts", () => {
    const required = {
      eip155: {
        chains: ["eip155:1", "eip155:2"],
        events: [],
        methods: ["eth_accounts"],
      },
    };

    const approved = {
      "eip155:1": {
        accounts: ["eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"],
        events: ["chainChanged"],
        methods: ["eth_accounts"],
      },
      "eip155:2": {
        accounts: ["eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"],
        events: ["chainChanged"],
        methods: ["eth_accounts"],
      },
    };
    const error = isConformingNamespaces(required, approved, "validators");
    expect(error).to.not.be.null;
    expect(error).to.throw;
  });
});
describe("buildApprovedNamespaces (validators)", () => {
  const TEST_PROPOSAL = {
    id: 1,
    pairingTopic: "0x123",
    expiry: 1680622315,
    requiredNamespaces: {},
    optionalNamespaces: {},
    relays: [{ protocol: "irn" }],
    proposer: {
      publicKey: "c743d1c3d8aeac99267359ece5c33838411d812e576bc9728f66fca1899dd25f",
      metadata: {
        name: "App A (Proposer)",
        description: "Description of Proposer App run by client A",
        url: "https://walletconnect.com",
        icons: [],
      },
    },
    sessionProperties: { expiry: "2022-12-24T17:07:31+00:00", "caip154-mandatory": "true" },
  };
  it("should build namespaces (config 1 - optional method)", () => {
    const required = {
      eip155: {
        chains: ["eip155:1"],
        events: ["chainChanged"],
        methods: ["personal_sign"],
      },
    };
    const optional = {
      eip155: {
        chains: ["eip155:1"],
        events: [""],
        methods: ["eth_sendTransaction"],
      },
    };

    const chains = ["eip155:1", "eip155:2", "eip155:3"];
    const methods = ["personal_sign", "eth_sendTransaction", "eth_signTransaction"];
    const events = ["chainChanged"];
    const accounts = [
      "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:3:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
    ];
    const approvedNamespaces = buildApprovedNamespaces({
      proposal: {
        ...TEST_PROPOSAL,
        requiredNamespaces: required,
        optionalNamespaces: optional,
      },
      supportedNamespaces: {
        eip155: {
          chains,
          methods,
          events,
          accounts,
        },
      },
    });

    const expected = {
      eip155: {
        chains: ["eip155:1"],
        methods: ["personal_sign", "eth_sendTransaction"],
        events,
        accounts: [accounts[0]],
      },
    };
    expect(approvedNamespaces).to.deep.equal(expected);
  });
  it("should build namespaces (config 2 - optional chain)", () => {
    const required = {
      eip155: {
        chains: ["eip155:1"],
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };
    const optional = {
      eip155: {
        chains: ["eip155:2"],
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };

    const chains = ["eip155:1", "eip155:2", "eip155:3"];
    const methods = ["personal_sign", "eth_sendTransaction", "eth_signTransaction"];
    const events = ["chainChanged"];
    const accounts = [
      "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:3:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
    ];

    const approvedNamespaces = buildApprovedNamespaces({
      proposal: {
        ...TEST_PROPOSAL,
        requiredNamespaces: required,
        optionalNamespaces: optional,
      },
      supportedNamespaces: {
        eip155: {
          chains,
          methods,
          events,
          accounts,
        },
      },
    });

    const expected = {
      eip155: {
        chains: ["eip155:1", "eip155:2"],
        methods: ["personal_sign", "eth_sendTransaction"],
        events,
        accounts: [accounts[0], accounts[1]],
      },
    };
    expect(approvedNamespaces).to.deep.eq(expected);
  });
  it("should build namespaces (config 3 - inline chain)", () => {
    const required = {
      "eip155:1": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };
    const optional = {
      eip155: {
        chains: ["eip155:2"],
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };

    const chains = ["eip155:1", "eip155:2", "eip155:3"];
    const methods = ["personal_sign", "eth_sendTransaction", "eth_signTransaction"];
    const events = ["chainChanged"];
    const accounts = [
      "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:3:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
    ];

    const approvedNamespaces = buildApprovedNamespaces({
      proposal: {
        ...TEST_PROPOSAL,
        requiredNamespaces: required,
        optionalNamespaces: optional,
      },
      supportedNamespaces: {
        eip155: {
          chains,
          methods,
          events,
          accounts,
        },
      },
    });

    const expected = {
      eip155: {
        chains: ["eip155:1", "eip155:2"],
        methods: ["personal_sign", "eth_sendTransaction"],
        events,
        accounts: [accounts[0], accounts[1]],
      },
    };
    expect(approvedNamespaces).to.deep.eq(expected);
  });
  it("should build namespaces (config 4 - multiple inline chains)", () => {
    const required = {
      "eip155:1": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
      "eip155:2": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };
    const optional = {
      eip155: {
        chains: ["eip155:3"],
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };

    const chains = ["eip155:1", "eip155:2", "eip155:3"];
    const methods = ["personal_sign", "eth_sendTransaction", "eth_signTransaction"];
    const events = ["chainChanged"];
    const accounts = [
      "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:3:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
    ];

    const approvedNamespaces = buildApprovedNamespaces({
      proposal: {
        ...TEST_PROPOSAL,
        requiredNamespaces: required,
        optionalNamespaces: optional,
      },
      supportedNamespaces: {
        eip155: {
          chains,
          methods,
          events,
          accounts,
        },
      },
    });

    const expected = {
      eip155: {
        chains: ["eip155:1", "eip155:2", "eip155:3"],
        methods: ["personal_sign", "eth_sendTransaction"],
        events,
        accounts,
      },
    };
    expect(approvedNamespaces).to.deep.eq(expected);
  });
  it("should build namespaces (config 5 - multiple inline chains)", () => {
    const required = {
      "eip155:1": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
      "eip155:2": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };
    const optional = {
      eip155: {
        chains: ["eip155:3"],
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
      "eip155:4": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };

    const chains = ["eip155:1", "eip155:2", "eip155:3", "eip155:4"];
    const methods = ["personal_sign", "eth_sendTransaction", "eth_signTransaction"];
    const events = ["chainChanged"];
    const accounts = [
      "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:4:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:3:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
    ];

    const approvedNamespaces = buildApprovedNamespaces({
      proposal: {
        ...TEST_PROPOSAL,
        requiredNamespaces: required,
        optionalNamespaces: optional,
      },
      supportedNamespaces: {
        eip155: {
          chains,
          methods,
          events,
          accounts,
        },
      },
    });

    const expected = {
      eip155: {
        chains: ["eip155:1", "eip155:2", "eip155:4", "eip155:3"],
        methods: ["personal_sign", "eth_sendTransaction"],
        events,
        accounts,
      },
    };
    expect(approvedNamespaces).to.deep.eq(expected);
  });
  it("should build namespaces (config 6 - unsupported optional chains)", () => {
    const required = {
      "eip155:1": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
      "eip155:2": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };
    const optional = {
      eip155: {
        chains: ["eip155:3"],
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
      "eip155:4": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };

    const chains = ["eip155:1", "eip155:2"];
    const methods = ["personal_sign", "eth_sendTransaction", "eth_signTransaction"];
    const events = ["chainChanged"];
    const accounts = [
      "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
    ];

    const approvedNamespaces = buildApprovedNamespaces({
      proposal: {
        ...TEST_PROPOSAL,
        requiredNamespaces: required,
        optionalNamespaces: optional,
      },
      supportedNamespaces: {
        eip155: {
          chains,
          methods,
          events,
          accounts,
        },
      },
    });

    const expected = {
      eip155: {
        chains: ["eip155:1", "eip155:2"],
        methods: ["personal_sign", "eth_sendTransaction"],
        events,
        accounts,
      },
    };
    expect(approvedNamespaces).to.deep.eq(expected);
  });
  it("should build namespaces (config 7 - partially supported optional chains)", () => {
    const required = {
      "eip155:1": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
      "eip155:2": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };
    const optional = {
      eip155: {
        chains: ["eip155:3"],
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
      "eip155:4": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };

    const chains = ["eip155:1", "eip155:2", "eip155:4"];
    const methods = ["personal_sign", "eth_sendTransaction", "eth_signTransaction"];
    const events = ["chainChanged"];
    const accounts = [
      "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:4:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
    ];

    const approvedNamespaces = buildApprovedNamespaces({
      proposal: {
        ...TEST_PROPOSAL,
        requiredNamespaces: required,
        optionalNamespaces: optional,
      },
      supportedNamespaces: {
        eip155: {
          chains,
          methods,
          events,
          accounts,
        },
      },
    });

    const expected = {
      eip155: {
        chains: ["eip155:1", "eip155:2", "eip155:4"],
        methods: ["personal_sign", "eth_sendTransaction"],
        events,
        accounts,
      },
    };
    expect(approvedNamespaces).to.deep.eq(expected);
  });
  it("should build namespaces (config 8 - partially supported optional methods)", () => {
    const required = {
      "eip155:1": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
      "eip155:2": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };
    const optional = {
      eip155: {
        chains: ["eip155:1", "eip155:2"],
        events: ["chainChanged"],
        methods: [
          "personal_sign",
          "eth_sendTransaction",
          "eth_signTransaction",
          "eth_signTypedData",
        ],
      },
    };

    const chains = ["eip155:1", "eip155:2", "eip155:4"];
    const methods = ["personal_sign", "eth_sendTransaction", "eth_signTransaction"];
    const events = ["chainChanged"];
    const accounts = [
      "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:4:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
    ];

    const approvedNamespaces = buildApprovedNamespaces({
      proposal: {
        ...TEST_PROPOSAL,
        requiredNamespaces: required,
        optionalNamespaces: optional,
      },
      supportedNamespaces: {
        eip155: {
          chains,
          methods,
          events,
          accounts,
        },
      },
    });

    const expected = {
      eip155: {
        chains: ["eip155:1", "eip155:2"],
        methods: ["personal_sign", "eth_sendTransaction", "eth_signTransaction"],
        events,
        accounts: [accounts[0], accounts[1]],
      },
    };
    expect(approvedNamespaces).to.deep.eq(expected);
  });
  it("should build namespaces (config 9 - partially supported optional events)", () => {
    const required = {
      "eip155:1": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
      "eip155:2": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };
    const optional = {
      eip155: {
        chains: ["eip155:1", "eip155:2"],
        events: ["chainChanged", "accountsChanged"],
        methods: [
          "personal_sign",
          "eth_sendTransaction",
          "eth_signTransaction",
          "eth_signTypedData",
        ],
      },
    };

    const chains = ["eip155:1", "eip155:2", "eip155:4"];
    const methods = ["personal_sign", "eth_sendTransaction", "eth_signTransaction"];
    const events = ["chainChanged", "accountsChanged"];
    const accounts = [
      "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:4:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
    ];

    const approvedNamespaces = buildApprovedNamespaces({
      proposal: {
        ...TEST_PROPOSAL,
        requiredNamespaces: required,
        optionalNamespaces: optional,
      },
      supportedNamespaces: {
        eip155: {
          chains,
          methods,
          events,
          accounts,
        },
      },
    });

    const expected = {
      eip155: {
        chains: ["eip155:1", "eip155:2"],
        methods: ["personal_sign", "eth_sendTransaction", "eth_signTransaction"],
        events,
        accounts: [accounts[0], accounts[1]],
      },
    };
    expect(approvedNamespaces).to.deep.eq(expected);
  });
  it("should build namespaces (config 10 - extra supported chains)", () => {
    const required = {
      "eip155:1": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
      "eip155:2": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };
    const optional = {
      eip155: {
        chains: ["eip155:1", "eip155:2"],
        events: ["chainChanged", "accountsChanged"],
        methods: [
          "personal_sign",
          "eth_sendTransaction",
          "eth_signTransaction",
          "eth_signTypedData",
        ],
      },
    };

    const chains = ["eip155:1", "eip155:2", "eip155:11"];
    const methods = ["personal_sign", "eth_sendTransaction", "eth_signTransaction"];
    const events = ["chainChanged", "accountsChanged"];
    const accounts = [
      "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:11:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
    ];

    const approvedNamespaces = buildApprovedNamespaces({
      proposal: {
        ...TEST_PROPOSAL,
        requiredNamespaces: required,
        optionalNamespaces: optional,
      },
      supportedNamespaces: {
        eip155: {
          chains,
          methods,
          events,
          accounts,
        },
      },
    });

    const expected = {
      eip155: {
        chains: ["eip155:1", "eip155:2"],
        methods: ["personal_sign", "eth_sendTransaction", "eth_signTransaction"],
        events,
        accounts: [
          "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
          "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
        ],
      },
    };
    expect(approvedNamespaces).to.deep.eq(expected);
  });
  it("should build namespaces (config 11 - multiple namespaces - required)", () => {
    const required = {
      "eip155:1": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
      cosmos: {
        chains: ["cosmos:cosmoshub-4"],
        events: ["cosmos_event"],
        methods: ["cosmos_method"],
      },
    };
    const optional = {
      eip155: {
        chains: ["eip155:1", "eip155:2"],
        events: ["chainChanged", "accountsChanged"],
        methods: [
          "personal_sign",
          "eth_sendTransaction",
          "eth_signTransaction",
          "eth_signTypedData",
        ],
      },
    };

    const chainsEip = ["eip155:1", "eip155:2", "eip155:4"];
    const chainsCosmos = ["cosmos:cosmoshub-4"];
    const methods = ["personal_sign", "eth_sendTransaction", "eth_signTransaction"];
    const events = ["chainChanged", "accountsChanged"];
    const accountsEip = [
      "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:4:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
    ];
    const accountsCosmos = ["cosmos:cosmoshub-4:cosmos1hsk6jryyqjfhp5dhc55tc9jtckygx0eph6dd02"];
    const eventsCosmos = ["cosmos_event"];
    const methodsCosmos = ["cosmos_method"];

    const approvedNamespaces = buildApprovedNamespaces({
      proposal: {
        ...TEST_PROPOSAL,
        requiredNamespaces: required,
        optionalNamespaces: optional,
      },
      supportedNamespaces: {
        eip155: {
          chains: chainsEip,
          methods,
          events,
          accounts: accountsEip,
        },
        cosmos: {
          chains: chainsCosmos,
          methods: methodsCosmos,
          events: eventsCosmos,
          accounts: accountsCosmos,
        },
      },
    });

    const expected = {
      eip155: {
        chains: ["eip155:1", "eip155:2"],
        methods: ["personal_sign", "eth_sendTransaction", "eth_signTransaction"],
        events,
        accounts: [
          "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
          "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
        ],
      },
      cosmos: {
        chains: chainsCosmos,
        methods: methodsCosmos,
        events: eventsCosmos,
        accounts: accountsCosmos,
      },
    };
    expect(approvedNamespaces).to.deep.eq(expected);
  });
  it("should build namespaces (config 12 - chains fuzzing)", () => {
    const required = {
      "eip155:1": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };
    const optional = {};

    const chains = ["eip155:1", "eip155:11", "eip155:111"];
    const methods = ["personal_sign", "eth_sendTransaction", "eth_signTransaction"];
    const events = ["chainChanged"];
    const accounts = [
      "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:11:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:111:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
    ];

    const approvedNamespaces = buildApprovedNamespaces({
      proposal: {
        ...TEST_PROPOSAL,
        requiredNamespaces: required,
        optionalNamespaces: optional,
      },
      supportedNamespaces: {
        eip155: {
          chains,
          methods,
          events,
          accounts,
        },
      },
    });

    const expected = {
      eip155: {
        chains: ["eip155:1"],
        methods: ["personal_sign", "eth_sendTransaction"],
        events,
        accounts: ["eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"],
      },
    };
    expect(approvedNamespaces).to.deep.eq(expected);
  });
  it("should build namespaces (config 13 - required & optional empty)", () => {
    const required = {};
    const optional = {};

    const chains = ["eip155:1", "eip155:2", "eip155:3"];
    const methods = ["personal_sign", "eth_sendTransaction", "eth_signTransaction"];
    const events = ["chainChanged"];
    const accounts = [
      "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:3:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
    ];

    const approvedNamespaces = buildApprovedNamespaces({
      proposal: {
        ...TEST_PROPOSAL,
        requiredNamespaces: required,
        optionalNamespaces: optional,
      },
      supportedNamespaces: {
        eip155: {
          chains,
          methods,
          events,
          accounts,
        },
      },
    });
    const expected = {
      eip155: {
        chains,
        methods,
        events,
        accounts,
      },
    };
    expect(approvedNamespaces).to.deep.equal(expected);
  });

  it.fails(
    "should throw while building namespaces (config 1 - no supported required chains)",
    () => {
      const required = {
        "eip155:1": {
          events: ["chainChanged"],
          methods: ["personal_sign", "eth_sendTransaction"],
        },
        cosmos: {
          chains: ["cosmos:cosmoshub-4"],
          events: ["cosmos_event"],
          methods: ["cosmos_method"],
        },
      };
      const optional = {
        eip155: {
          chains: ["eip155:1", "eip155:2"],
          events: ["chainChanged", "accountsChanged"],
          methods: [
            "personal_sign",
            "eth_sendTransaction",
            "eth_signTransaction",
            "eth_signTypedData",
          ],
        },
      };

      const chainsEip = ["eip155:5"];
      const methods = ["personal_sign", "eth_sendTransaction", "eth_signTransaction"];
      const events = ["chainChanged", "accountsChanged"];
      const accountsEip = ["eip155:5:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"];

      buildApprovedNamespaces({
        proposal: {
          ...TEST_PROPOSAL,
          requiredNamespaces: required,
          optionalNamespaces: optional,
        },
        supportedNamespaces: {
          eip155: {
            chains: chainsEip,
            methods,
            events,
            accounts: accountsEip,
          },
        },
      });
    },
  );
  it.fails(
    "should throw while building namespaces (config 2 - partially supported required chains)",
    () => {
      const required = {
        "eip155:1": {
          events: ["chainChanged"],
          methods: ["personal_sign", "eth_sendTransaction"],
        },
        cosmos: {
          chains: ["cosmos:cosmoshub-4"],
          events: ["cosmos_event"],
          methods: ["cosmos_method"],
        },
      };
      const optional = {
        eip155: {
          chains: ["eip155:1", "eip155:2"],
          events: ["chainChanged", "accountsChanged"],
          methods: [
            "personal_sign",
            "eth_sendTransaction",
            "eth_signTransaction",
            "eth_signTypedData",
          ],
        },
      };

      const chainsEip = ["eip155:1", "eip155:5"];
      const methods = ["personal_sign", "eth_sendTransaction", "eth_signTransaction"];
      const events = ["chainChanged", "accountsChanged"];
      const accountsEip = [
        "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
        "eip155:5:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      ];

      buildApprovedNamespaces({
        proposal: {
          ...TEST_PROPOSAL,
          requiredNamespaces: required,
          optionalNamespaces: optional,
        },
        supportedNamespaces: {
          eip155: {
            chains: chainsEip,
            methods,
            events,
            accounts: accountsEip,
          },
        },
      });
    },
  );
  it.fails(
    "should throw while building namespaces (config 3 - no supported required methods)",
    () => {
      const required = {
        "eip155:1": {
          events: ["chainChanged"],
          methods: ["personal_sign", "eth_sendTransaction"],
        },
      };
      const optional = {
        eip155: {
          chains: ["eip155:1", "eip155:2"],
          events: ["chainChanged", "accountsChanged"],
          methods: [
            "personal_sign",
            "eth_sendTransaction",
            "eth_signTransaction",
            "eth_signTypedData",
          ],
        },
      };

      const chainsEip = ["eip155:1"];
      const methods = ["personal_sign"];
      const events = ["chainChanged", "accountsChanged"];
      const accountsEip = ["eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"];

      buildApprovedNamespaces({
        proposal: {
          ...TEST_PROPOSAL,
          requiredNamespaces: required,
          optionalNamespaces: optional,
        },
        supportedNamespaces: {
          eip155: {
            chains: chainsEip,
            methods,
            events,
            accounts: accountsEip,
          },
        },
      });
    },
  );
  it.fails(
    "should throw while building namespaces (config 4 - no supported required events)",
    () => {
      const required = {
        "eip155:1": {
          events: ["chainChanged"],
          methods: ["personal_sign", "eth_sendTransaction"],
        },
      };
      const optional = {
        eip155: {
          chains: ["eip155:1", "eip155:2"],
          events: ["chainChanged", "accountsChanged"],
          methods: [
            "personal_sign",
            "eth_sendTransaction",
            "eth_signTransaction",
            "eth_signTypedData",
          ],
        },
      };

      const chainsEip = ["eip155:1"];
      const methods = ["personal_sign", "eth_sendTransaction"];
      const events = [] as string[];
      const accountsEip = ["eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"];

      buildApprovedNamespaces({
        proposal: {
          ...TEST_PROPOSAL,
          requiredNamespaces: required,
          optionalNamespaces: optional,
        },
        supportedNamespaces: {
          eip155: {
            chains: chainsEip,
            methods,
            events,
            accounts: accountsEip,
          },
        },
      });
    },
  );
  it.fails(
    "should throw while building namespaces (config 5 - no accounts for required chain)",
    () => {
      const required = {
        "eip155:1": {
          events: ["chainChanged"],
          methods: ["personal_sign", "eth_sendTransaction"],
        },
      };
      const optional = {
        eip155: {
          chains: ["eip155:1", "eip155:2"],
          events: ["chainChanged", "accountsChanged"],
          methods: [
            "personal_sign",
            "eth_sendTransaction",
            "eth_signTransaction",
            "eth_signTypedData",
          ],
        },
      };

      const chainsEip = ["eip155:1"];
      const methods = ["personal_sign", "eth_sendTransaction"];
      const events = ["chainChanged"];
      const accountsEip = ["eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"];

      buildApprovedNamespaces({
        proposal: {
          ...TEST_PROPOSAL,
          requiredNamespaces: required,
          optionalNamespaces: optional,
        },
        supportedNamespaces: {
          eip155: {
            chains: chainsEip,
            methods,
            events,
            accounts: accountsEip,
          },
        },
      });
    },
  );
  it.fails(
    "should throw while building namespaces (config 6 - partial accounts for required chain)",
    () => {
      const required = {
        "eip155:1": {
          events: ["chainChanged"],
          methods: ["personal_sign", "eth_sendTransaction"],
        },
        "eip155:2": {
          events: ["chainChanged"],
          methods: ["personal_sign", "eth_sendTransaction"],
        },
      };
      const optional = {
        eip155: {
          chains: ["eip155:1", "eip155:2"],
          events: ["chainChanged", "accountsChanged"],
          methods: [
            "personal_sign",
            "eth_sendTransaction",
            "eth_signTransaction",
            "eth_signTypedData",
          ],
        },
      };

      const chainsEip = ["eip155:1", "eip155:2"];
      const methods = ["personal_sign", "eth_sendTransaction"];
      const events = ["chainChanged"];
      const accountsEip = ["eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"];

      buildApprovedNamespaces({
        proposal: {
          ...TEST_PROPOSAL,
          requiredNamespaces: required,
          optionalNamespaces: optional,
        },
        supportedNamespaces: {
          eip155: {
            chains: chainsEip,
            methods,
            events,
            accounts: accountsEip,
          },
        },
      });
    },
  );
  it.fails(
    "should throw while building namespaces (config 7 - misconfigured supported accounts - caip10)",
    () => {
      const required = {
        "eip155:1": {
          events: ["chainChanged"],
          methods: ["personal_sign", "eth_sendTransaction"],
        },
        "eip155:2": {
          events: ["chainChanged"],
          methods: ["personal_sign", "eth_sendTransaction"],
        },
      };
      const optional = {
        eip155: {
          chains: ["eip155:1", "eip155:2"],
          events: ["chainChanged", "accountsChanged"],
          methods: [
            "personal_sign",
            "eth_sendTransaction",
            "eth_signTransaction",
            "eth_signTypedData",
          ],
        },
      };

      const chainsEip = ["eip155:1", "eip155:2"];
      const methods = ["personal_sign", "eth_sendTransaction"];
      const events = ["chainChanged"];
      const accountsEip = [
        "0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
        "0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      ];

      buildApprovedNamespaces({
        proposal: {
          ...TEST_PROPOSAL,
          requiredNamespaces: required,
          optionalNamespaces: optional,
        },
        supportedNamespaces: {
          eip155: {
            chains: chainsEip,
            methods,
            events,
            accounts: accountsEip,
          },
        },
      });
    },
  );
  it("should build approved namespaces - matching namespace but no supported chains", () => {
    const required = {};
    const optional = {
      eip155: {
        chains: ["eip155:1", "eip155:2"],
        events: ["chainChanged", "accountsChanged"],
        methods: [
          "personal_sign",
          "eth_sendTransaction",
          "eth_signTransaction",
          "eth_signTypedData",
        ],
      },
      bip122: {
        chains: ["bip122:000000000019d6689c085ae165831e93"],
        events: ["chainChanged"],
        methods: ["bip122_signTransaction"],
      },
    };

    const chainsEip = ["eip155:1"];
    const methods = ["personal_sign", "eth_sendTransaction"];
    const events = ["chainChanged"];
    const accountsEip = ["eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"];

    const result = buildApprovedNamespaces({
      proposal: {
        ...TEST_PROPOSAL,
        requiredNamespaces: required,
        optionalNamespaces: optional,
      },
      supportedNamespaces: {
        eip155: {
          chains: chainsEip,
          methods,
          events,
          accounts: accountsEip,
        },
        bip122: {
          chains: ["bip122:000000000019d6689c085ae165831e92"],
          events: ["chainChanged"],
          methods: ["bip122_signTransaction"],
          accounts: [
            "bip122:000000000019d6689c085ae165831e92:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
          ],
        },
      },
    });
    // it should not inclide bip122 namespace since the supported chains do not match with the proposal
    expect(result).toEqual({
      eip155: {
        chains: chainsEip,
        events,
        methods,
        accounts: accountsEip,
      },
    });
  });
});

describe("merge namespaces", () => {
  it("should merge required and optional namespaces. case 1", () => {
    const required = {
      "eip155:1": {
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };
    const optional = {
      "eip155:1": {
        events: ["accountsChanged"],
        methods: ["eth_sendTransaction"],
      },
    };
    const expected = {
      eip155: {
        chains: ["eip155:1"],
        events: ["chainChanged", "accountsChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };

    const result = mergeRequiredAndOptionalNamespaces(required, optional);
    expect(result).toEqual(expected);
  });

  it("should merge required and optional namespaces. case 2", () => {
    const required = {
      eip155: {
        chains: ["eip155:1"],
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };
    const optional = {
      eip155: {
        chains: ["eip155:1"],
        events: ["accountsChanged"],
        methods: ["eth_sendTransaction"],
      },
    };
    const expected = {
      eip155: {
        chains: ["eip155:1"],
        events: ["chainChanged", "accountsChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };

    const result = mergeRequiredAndOptionalNamespaces(required, optional);
    expect(result).toEqual(expected);
  });

  it("should merge required and optional namespaces. case 3", () => {
    const required = {
      eip155: {
        chains: ["eip155:1"],
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
    };
    const optional = {
      solana: {
        chains: ["solana:1"],
        events: ["accountsChanged"],
        methods: ["solana_signTransaction"],
      },
    };
    const expected = {
      eip155: {
        chains: ["eip155:1"],
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
      solana: {
        chains: ["solana:1"],
        events: ["accountsChanged"],
        methods: ["solana_signTransaction"],
      },
    };

    const result = mergeRequiredAndOptionalNamespaces(required, optional);
    expect(result).toEqual(expected);
  });

  it("should merge required and optional namespaces. case 4", () => {
    const required = {
      eip155: {
        chains: ["eip155:2"],
        events: ["chainChanged"],
        methods: ["personal_sign", "eth_sendTransaction"],
      },
      solana: {
        chains: ["solana:1"],
        events: ["accountsChanged"],
        methods: ["solana_signTransaction"],
      },
    };
    const optional = {
      eip155: {
        chains: ["eip155:1"],
        events: ["accountsChanged"],
        methods: ["eth_signTypedData"],
      },
    };
    const expected = {
      eip155: {
        chains: ["eip155:2", "eip155:1"],
        events: ["chainChanged", "accountsChanged"],
        methods: ["personal_sign", "eth_sendTransaction", "eth_signTypedData"],
      },
      solana: {
        chains: ["solana:1"],
        events: ["accountsChanged"],
        methods: ["solana_signTransaction"],
      },
    };

    const result = mergeRequiredAndOptionalNamespaces(required, optional);
    expect(result).toEqual(expected);
  });
});
