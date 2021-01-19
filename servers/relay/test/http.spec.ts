// import "mocha";
// import { use, expect } from "chai";
// import chaiHttp from "chai-http";
// import { HttpService } from "../src/http";

// use(chaiHttp);

// describe("HTTP", () => {
//   it("GET hello", done => {
//     const { app } = new HttpService({ logger: "fatal" });
//     app.inject({ method: "GET", url: "/hello" }, (err, response) => {
//       expect(err).to.be.null;
//       expect(response.statusCode).to.equal(200);
//       expect(response.body).to.equal(`Hello World, this is WalletConnect`);
//       expect(true).to.be.true;
//       app.close(); // THis is not working so we need --exit in mocha
//       done();
//     });
//   });
// });
