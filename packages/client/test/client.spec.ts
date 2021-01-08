import "mocha";

import Client from "../src";

import { expect, TEST_CLIENT_OPTIONS } from "./shared";

describe("Client", () => {
  it("instantiate successfully", async () => {
    const client = await Client.init(TEST_CLIENT_OPTIONS);
    expect(client).to.be.exist;
  });
});
