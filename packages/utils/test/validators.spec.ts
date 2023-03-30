import { expect, describe, it } from "vitest";
import {
  TEST_CHAINS,
  TEST_ETHEREUM_CHAIN_A,
  TEST_ETHEREUM_NAMESPACE,
  TEST_EVENTS,
  TEST_METHODS,
  TEST_SESSION,
} from "./shared/values";

import { buildApprovedNamespaces, isConformingNamespaces, isSessionCompatible } from "../src";

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

  it("should throw on CAIP2 namespace not including that CAIP2 in accouns", () => {
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
    const accounts = ["eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"];

    const approvedNamespaces = buildApprovedNamespaces({
      requiredNamespaces: required,
      optionalNamespaces: optional,
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
        accounts,
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
    ];

    const approvedNamespaces = buildApprovedNamespaces({
      requiredNamespaces: required,
      optionalNamespaces: optional,
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
    ];

    const approvedNamespaces = buildApprovedNamespaces({
      requiredNamespaces: required,
      optionalNamespaces: optional,
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
      requiredNamespaces: required,
      optionalNamespaces: optional,
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
      requiredNamespaces: required,
      optionalNamespaces: optional,
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
      requiredNamespaces: required,
      optionalNamespaces: optional,
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
      requiredNamespaces: required,
      optionalNamespaces: optional,
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
    ];

    const approvedNamespaces = buildApprovedNamespaces({
      requiredNamespaces: required,
      optionalNamespaces: optional,
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
        accounts,
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
    ];

    const approvedNamespaces = buildApprovedNamespaces({
      requiredNamespaces: required,
      optionalNamespaces: optional,
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
        accounts,
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

    const chains = ["eip155:1", "eip155:2", "eip155:4"];
    const methods = ["personal_sign", "eth_sendTransaction", "eth_signTransaction"];
    const events = ["chainChanged", "accountsChanged"];
    const accounts = [
      "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
      "eip155:4:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
    ];

    const approvedNamespaces = buildApprovedNamespaces({
      requiredNamespaces: required,
      optionalNamespaces: optional,
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
      requiredNamespaces: required,
      optionalNamespaces: optional,
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
});
