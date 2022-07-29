import CloudWatch from "aws-sdk/clients/cloudwatch";

export const uploadToCloudWatch = async (
  env: string,
  metricsPrefix: string,
  isTestPassed: boolean,
  testDurationMs: number,
) => {
  const cloudwatch = new CloudWatch({ region: "eu-central-1" });
  const ts = new Date();

  const params: CloudWatch.PutMetricDataInput = {
    MetricData: [
      {
        MetricName: `${metricsPrefix}.success`,
        Unit: "Count",
        Value: isTestPassed ? 1 : 0,
        Timestamp: ts,
      },
      {
        MetricName: `${metricsPrefix}.failure`,
        Unit: "Count",
        Value: isTestPassed ? 0 : 1,
        Timestamp: ts,
      },
      {
        MetricName: `${metricsPrefix}.latency`,
        Unit: "Milliseconds",
        Value: testDurationMs,
        Timestamp: ts,
      },
    ],
    Namespace: `${env}_Canary_SignClient`,
  };

  await new Promise<void>((resolve) => {
    cloudwatch.putMetricData(params, function (err: Error) {
      if (err) {
        console.error(err, err.stack);
        // Swallow error as
        // Test shouldn't fail despite CW failing
        // we will report on missing metrics
      }
      resolve();
    });
  });
};
