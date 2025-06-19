import { expect, describe, it } from "vitest";
import { extractCapabilitiesFromSession } from "../src/utils/caip25";
import { SessionTypes } from "@walletconnect/types";

describe("UniversalProvider utils", function () {
  it("should extract capabilities from session. Case 1", function () {
    const session = {
      scopedProperties: {
        "eip155:1": {
          atomic: {
            status: "supported",
          },
        },
      },
    } as unknown as SessionTypes.Struct;

    const capabilities = extractCapabilitiesFromSession(
      session,
      "0x0910e12C68d02B561a34569E1367c9AAb42bd810",
      ["0x1"],
    );

    expect(capabilities).toEqual({
      "0x1": {
        atomic: {
          status: "supported",
        },
      },
    });
  });

  it("should extract capabilities from session. Case 2", function () {
    const session = {
      scopedProperties: {
        "eip155:1": {
          "eip155:1:0x0910e12C68d02B561a34569E1367c9AAb42bd810": {
            atomic: {
              status: "supported",
            },
          },
        },
      },
    } as unknown as SessionTypes.Struct;

    const capabilities = extractCapabilitiesFromSession(
      session,
      "0x0910e12C68d02B561a34569E1367c9AAb42bd810",
      ["0x1"],
    );

    expect(capabilities).toEqual({
      "0x1": {
        atomic: {
          status: "supported",
        },
      },
    });
  });

  it("should extract capabilities from session. Case 3", function () {
    const session = {
      scopedProperties: {
        "eip155:1": {
          atomic: {
            status: "unsupported",
          },
        },
        "eip155:137": {
          atomic: {
            status: "unsupported",
          },
        },
        "eip155:84532": {
          "eip155:84532:0x0910e12C68d02B561a34569E1367c9AAb42bd810": {
            atomic: {
              status: "supported",
            },
          },
        },
      },
    } as unknown as SessionTypes.Struct;

    const capabilities = extractCapabilitiesFromSession(
      session,
      "0x0910e12C68d02B561a34569E1367c9AAb42bd810",
      ["0x1", "0x89", "0x14A34"],
    );

    expect(capabilities).toEqual({
      "0x1": {
        atomic: {
          status: "unsupported",
        },
      },
      "0x89": {
        atomic: {
          status: "unsupported",
        },
      },
      "0x14a34": {
        atomic: {
          status: "supported",
        },
      },
    });
  });

  it("should extract capabilities from session. Case 4", function () {
    const session = {
      scopedProperties: {
        "eip155:1": {
          atomic: {
            status: "unsupported",
          },
        },
        "eip155:137": {
          atomic: {
            status: "unsupported",
          },
        },
        "eip155:84532": {
          "eip155:84532:0x0910e12C68d02B561a34569E1367c9AAb42bd810": {
            atomic: {
              status: "supported",
            },
          },
        },
      },
    } as unknown as SessionTypes.Struct;

    const capabilities = extractCapabilitiesFromSession(
      session,
      "0x0910e12C68d02B561a34569E1367c9AAb42bd810",
      ["0x1", "0x89", "0x14A34"],
    );

    expect(capabilities).toEqual({
      "0x1": {
        atomic: {
          status: "unsupported",
        },
      },
      "0x89": {
        atomic: {
          status: "unsupported",
        },
      },
      "0x14a34": {
        atomic: {
          status: "supported",
        },
      },
    });
  });
  it("should extract capabilities from session. Case 5", function () {
    const session = {
      scopedProperties: {
        "eip155:1": {
          atomic: {
            status: "supported",
          },
        },
        "eip155:137": {
          atomic: {
            status: "supported",
          },
        },
        "eip155:84532": {
          "eip155:84532:0x0910e12C68d02B561a34569E1367c9AAb42bd810": {
            atomic: {
              status: "unsupported",
            },
          },
        },
      },
    } as unknown as SessionTypes.Struct;

    const capabilities = extractCapabilitiesFromSession(
      session,
      "0x0910e12C68d02B561a34569E1367c9AAb42bd810",
      ["0x1", "0x89", "0x14A34"],
    );

    expect(capabilities).toEqual({
      "0x1": {
        atomic: {
          status: "supported",
        },
      },
      "0x89": {
        atomic: {
          status: "supported",
        },
      },
      "0x14a34": {
        atomic: {
          status: "unsupported",
        },
      },
    });
  });

  it("should extract capabilities from session. Case 5", function () {
    const session = {
      scopedProperties: {
        "eip155:1": {
          atomic: {
            status: "supported",
          },
        },
        "eip155:137": {
          "eip155:137:0x0910e12C68d02B561a34569E1367c9AAb42bd810": {
            atomic: {
              status: "unsupported",
            },
          },
        },
        "eip155:84532": {
          "eip155:84532:0x0910e12C68d02B561a34569E1367c9AAb42bd810": {
            atomic: {
              status: "unsupported",
            },
          },
        },
      },
    } as unknown as SessionTypes.Struct;

    const capabilities = extractCapabilitiesFromSession(
      session,
      "0x0910e12C68d02B561a34569E1367c9AAb42bd810",
      ["0x1", "0x89", "0x14A34"],
    );

    expect(capabilities).toEqual({
      "0x1": {
        atomic: {
          status: "supported",
        },
      },
      "0x89": {
        atomic: {
          status: "unsupported",
        },
      },
      "0x14a34": {
        atomic: {
          status: "unsupported",
        },
      },
    });
  });

  it("should extract capabilities from session. Case 6", function () {
    const session = {
      scopedProperties: {
        "eip155:1": {
          atomic: {
            status: "unsupported",
          },
        },
        "eip155:137": {
          "eip155:137:0x0910e12C68d02B561a34569E1367c9AAb42bd811": {
            atomic: {
              status: "supported",
            },
          },
        },
        "eip155:84532": {
          "eip155:84532:0x0910e12C68d02B561a34569E1367c9AAb42bd810": {
            atomic: {
              status: "supported",
            },
          },
        },
      },
    } as unknown as SessionTypes.Struct;

    const capabilities = extractCapabilitiesFromSession(
      session,
      "0x0910e12C68d02B561a34569E1367c9AAb42bd811",
      ["0x1", "0x89", "0x14A34"],
    );

    expect(capabilities).toEqual({
      "0x1": {
        atomic: {
          status: "unsupported",
        },
      },
      "0x89": {
        atomic: {
          status: "supported",
        },
      },
    });
  });
  it("should extract capabilities from session. Case 7", function () {
    const session = {
      scopedProperties: {
        "eip155:1": {
          sessionKeys: {
            status: "unsupported",
          },
          "some other key": "some other value",
        },
        "eip155:137": {
          "eip155:137:0x0910e12C68d02B561a34569E1367c9AAb42bd811": {
            atomic: {
              status: "supported",
            },
            "some other key": "some other value",
          },
        },
        "eip155:84532": {
          "eip155:84532:0x0910e12C68d02B561a34569E1367c9AAb42bd810": {
            atomic: {
              status: "supported",
            },
            "some other key": "some other value",
          },
        },
      },
    } as unknown as SessionTypes.Struct;

    const capabilities = extractCapabilitiesFromSession(
      session,
      "0x0910e12C68d02B561a34569E1367c9AAb42bd811",
      ["0x1", "0x89", "0x14A34"],
    );

    expect(capabilities).toEqual({
      "0x1": {
        sessionKeys: {
          status: "unsupported",
        },
      },
      "0x89": {
        atomic: {
          status: "supported",
        },
      },
    });
  });

  it("should extract capabilities from session. Case 8", function () {
    const session = {
      sessionProperties: {
        sessionKeys: {
          status: "unsupported",
        },
        atomic: {
          status: "supported",
        },
        "some other key": "some other value",
        "something else": "something else",
      },
    } as unknown as SessionTypes.Struct;

    const capabilities = extractCapabilitiesFromSession(
      session,
      "0x0910e12C68d02B561a34569E1367c9AAb42bd811",
      ["0x1", "0x89", "0x14A34"],
    );

    expect(capabilities).toEqual({
      "0x1": {
        sessionKeys: {
          status: "unsupported",
        },
        atomic: {
          status: "supported",
        },
      },
      "0x89": {
        sessionKeys: {
          status: "unsupported",
        },
        atomic: {
          status: "supported",
        },
      },
      "0x14a34": {
        sessionKeys: {
          status: "unsupported",
        },
        atomic: {
          status: "supported",
        },
      },
    });
  });
});
