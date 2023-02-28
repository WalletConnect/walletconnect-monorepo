import { expect, describe, it } from "vitest";
import {
  TEST_CHAINS,
  TEST_ETHEREUM_CHAIN_A,
  TEST_ETHEREUM_NAMESPACE,
  TEST_EVENTS,
  TEST_METHODS,
  TEST_SESSION,
} from "./shared/values";

import { isConformingNamespaces, isSessionCompatible } from "../src";

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
  it("should validate namespaces v1", () => {
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
  it("should validate namespaces v2", () => {
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
  it("should validate namespaces v3", () => {
    const required = {
      eip155: {
        chains: ["eip155:1"],
        events: [],
        methods: ["eth_accounts"],
      },
    };

    const approveOptional = {
      eip155: {
        accounts: [
          "eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
          "eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
        ],
        events: ["chainChanged"],
        methods: ["eth_accounts", "personal_sign"],
      },
    };
    const err = isConformingNamespaces(required, approveOptional, "validators");
    expect(err).to.be.null;
  });

  it("should trow on invalid accounts", () => {
    const required = {
      eip155: {
        chains: ["eip155:1"],
        events: [],
        methods: ["eth_accounts"],
      },
    };

    const approveOptional = {
      eip155: {
        accounts: ["eip155:2:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"],
        events: ["chainChanged"],
        methods: ["eth_accounts", "personal_sign"],
      },
    };
    expect(isConformingNamespaces(required, approveOptional, "validators")).to.throw;
  });
  it("should trow on invalid namespace", () => {
    const required = {
      eip155: {
        chains: ["eip155:1"],
        events: [],
        methods: ["eth_accounts"],
      },
    };

    const approveOptional = {
      solana: {
        accounts: ["solana:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"],
        events: ["chainChanged"],
        methods: ["eth_accounts", "personal_sign"],
      },
    };
    expect(isConformingNamespaces(required, approveOptional, "validators")).to.throw;
  });
  it("should trow on invalid methods", () => {
    const required = {
      eip155: {
        chains: ["eip155:1"],
        events: [],
        methods: ["eth_accounts"],
      },
    };

    const approveOptional = {
      eip155: {
        accounts: ["eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"],
        events: ["chainChanged"],
        methods: ["personal_sign"],
      },
    };
    expect(isConformingNamespaces(required, approveOptional, "validators")).to.throw;
  });
});
