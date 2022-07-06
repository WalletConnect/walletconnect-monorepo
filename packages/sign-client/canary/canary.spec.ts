import "mocha";
import {
  initTwoClients,
  testConnectMethod,
  deleteClients,
} from "./../test/shared";
import CloudWatch from 'aws-sdk/clients/cloudwatch';

const environment = process.env.ENVIRONMENT || 'dev';

describe("Canary", function() {
  let cloudwatch: CloudWatch;
  beforeEach(function() {
    cloudwatch = new CloudWatch({region: 'eu-central-1'});
  });
  afterEach(function (done) {
    const ts = new Date();
    const metric_prefix = `${this.currentTest!.parent!.title}.${this.currentTest!.title}`;
    const params: CloudWatch.PutMetricDataInput = {
      MetricData: [
        {
          MetricName: `${metric_prefix}.success`,
          Unit: "Count",
          Value: this.currentTest!.state === 'passed' ? 1 : 0,
          Timestamp: ts
        },
        {
          MetricName: `${metric_prefix}.failure`,
          Unit: "Count",
          Value: this.currentTest!.state === 'passed' ? 0 : 1,
          Timestamp: ts
        },
        {
          MetricName: `${metric_prefix}.latency`,
          Unit: "Milliseconds",
          Value: this.currentTest!.duration,
          Timestamp: ts
        },
      ],
      Namespace: `${environment}_Canary_SignClient`
    };
    cloudwatch.putMetricData(params, function(err: Error) {
      if (err) {console.log(err, err.stack); done();}
      else {done();}
    });
  });
  describe("HappyPath", function() {
    // TODO: implement a test that depicts
    // the happy case better
    it("connects", async function() {
      const clients = await initTwoClients();
      await testConnectMethod(clients);
      deleteClients(clients);
    });
  });
});
