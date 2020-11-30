import chai from 'chai';
import chaiHttp from 'chai-http';
chai.use(chaiHttp);
const expect = chai.expect;
import { HttpService } from "../src/http";

describe("Main routes", () => {
  it("Gets hello", done => {
    let { app } = new HttpService({ logger: "debug" });
    app.inject({ method: "GET", url: "/hello" }, (err, response) => {
      expect(err).to.be.null;
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.equal(`Hello World, this is WalletConnect`);
      expect(true).to.be.true;
      app.close() // THis is not working so we need --exit in mocha
      done()
    })
  });
});

