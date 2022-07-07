import "mocha";
import {
  initTwoClients,
  testConnectMethod,
  deleteClients,
  uploadToCloudWatch
} from "../shared";

const environment = process.env.ENVIRONMENT || 'dev';

describe("Canary", function() {
  describe("HappyPath", function() {
    // TODO: implement a test that depicts
    // the happy case better
    it("connects", async function() {
      const clients = await initTwoClients();
      await testConnectMethod(clients);
      deleteClients(clients);
    });
  });
  afterEach(function (done) {
    const metric_prefix = `${this.currentTest!.parent!.title}.${this.currentTest!.title}`;
    uploadToCloudWatch(environment, metric_prefix, this.currentTest!.state === 'passed', this.currentTest!.duration!, done);
  });
});
