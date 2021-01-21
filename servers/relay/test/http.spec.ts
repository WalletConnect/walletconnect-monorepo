import "mocha";
import { use, expect } from "chai";
import chaiHttp from "chai-http";
import { HttpService } from "../src/http";
import { TEST_TOPIC } from "./shared";

use(chaiHttp);

describe("HTTP", () => {
  it("GET health", done => {
    const { app } = new HttpService({ logger: "fatal" });
    app.inject({ method: "GET", url: "/health" }, (err, response) => {
      expect(err).to.be.null;
      expect(response.statusCode).to.equal(204);
      expect(true).to.be.true;
      app.close(); // THis is not working so we need --exit in mocha
      done();
    });
  });
  it("GET hello", done => {
    const { app } = new HttpService({ logger: "fatal" });
    app.inject({ method: "GET", url: "/hello" }, (err, response) => {
      expect(err).to.be.null;
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.equal(`Hello World, this is WalletConnect`);
      expect(true).to.be.true;
      app.close(); // THis is not working so we need --exit in mocha
      done();
    });
  });
  it("POST subscribe", done => {
    const { app } = new HttpService({ logger: "fatal" });
    const payload = { topic: TEST_TOPIC, webhook: "https://example.com" };
    app.inject({ method: "POST", url: "/subscribe", payload }, (err, response) => {
      expect(err).to.be.null;
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.equal(JSON.stringify({ success: true }));
      expect(true).to.be.true;
      app.close(); // THis is not working so we need --exit in mocha
      done();
    });
  });
});
