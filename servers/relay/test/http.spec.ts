import "mocha";
import axios, { AxiosInstance } from "axios";
import { use, expect } from "chai";
import chaiHttp from "chai-http";
import { Agent } from "https";

import { TEST_HTTP_URL, TEST_API_KEY, TEST_TOPIC } from "./shared";

use(chaiHttp);

function formatEndpoint(path: string, apiKey?: string) {
  if (typeof apiKey !== "undefined") {
    path = path + `?apiKey=${apiKey}`;
  }
  return path;
}

describe("HTTP", () => {
  let api: AxiosInstance;
  before(() => {
    api = axios.create({
      httpsAgent: new Agent({
        rejectUnauthorized: false,
      }),
      // Axios sends GET instead of POST when using ws protocol
      baseURL: TEST_HTTP_URL,
      timeout: 30000, // 30 secs
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
  });
  it("GET health", async () => {
    const endpoint = formatEndpoint("/health", TEST_API_KEY);
    const response = await api.get(endpoint);
    expect(response.status).to.equal(204);
  });
  it("GET hello", async () => {
    const endpoint = formatEndpoint("/hello", TEST_API_KEY);
    const response = await api.get(endpoint);
    expect(response.status).to.equal(200);
    expect(response.data.startsWith(`Hello World, this is Relay Server`)).to.be.true;
  });
  it("POST subscribe", async () => {
    const payload = { topic: TEST_TOPIC, webhook: "https://example.com" };
    const endpoint = formatEndpoint("/subscribe", TEST_API_KEY);
    const response = await api.post(endpoint, payload);
    expect(response.status).to.equal(200);
    expect(response.data).to.deep.equal({ success: true });
  });
});
