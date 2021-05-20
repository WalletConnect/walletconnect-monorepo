import "mocha";
import { use, expect } from "chai";
import chaiHttp from "chai-http";

import { HttpService } from "../src/http";
import { FastifyInstance } from "fastify";

use(chaiHttp);

describe("health-server", () => {
  let app: FastifyInstance;
  before(() => {
    const http = new HttpService({ logger: "fatal" });
    app = http.app;
  });
  it("GET health", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).to.equal(204);
  });
  it("GET hello", async () => {
    const response = await app.inject({ method: "GET", url: "/hello" });
    expect(response.statusCode).to.equal(200);
    expect(response.body.startsWith(`Hello World, this is Health Server`)).to.be.true;
  });
  describe("GET test", () => {
    it("should require url", async () => {
      const response = await app.inject({ method: "GET", url: "/test" });
      expect(response.statusCode).to.equal(400);
      const json = JSON.parse(response.body);
      expect(json.message).to.equal(`Error: Missing or invalid "url" param`);
    });

    it("should accept http url", async () => {
      const url = "http://localhost:5555";
      const response = await app.inject({ method: "GET", url: `/test?url=${url}` });
      expect(response.statusCode).to.equal(200);
      const json = JSON.parse(response.body);
      expect(json.success).to.equal(true);
      expect(json.mode).to.equal("jsonrpc");
    });
    it("should accept ws url", async () => {
      const url = "ws://localhost:5555";
      const response = await app.inject({ method: "GET", url: `/test?url=${url}` });
      expect(response.statusCode).to.equal(200);
      const json = JSON.parse(response.body);
      expect(json.success).to.equal(true);
      expect(json.mode).to.equal("jsonrpc");
    });
    it("should support legacy mode", async () => {
      const url = "ws://localhost:5555";
      const response = await app.inject({ method: "GET", url: `/test?url=${url}&legacy=true` });
      expect(response.statusCode).to.equal(200);
      const json = JSON.parse(response.body);
      expect(json.success).to.equal(true);
      expect(json.mode).to.equal("legacy");
    });
    it("should fail with unavailable server", async () => {
      const url = "http://localhost:1234";
      const response = await app.inject({ method: "GET", url: `/test?url=${url}` });
      expect(response.statusCode).to.equal(400);
      const json = JSON.parse(response.body);
      expect(json.message).to.equal(`Relay provider at http://localhost:1234 is not available`);
    });
    it("should fail with unsupported mode", async () => {
      const url = "https://bridge.walletconnect.org";
      const response = await app.inject({ method: "GET", url: `/test?url=${url}` });
      expect(response.statusCode).to.equal(400);
      const json = JSON.parse(response.body);
      expect(json.message).to.equal(
        `Relay provider at https://bridge.walletconnect.org does not support jsonrpc mode`,
      );
    });
  });
});
