import CloudWatch from "aws-sdk/clients/cloudwatch";

export const uploadCanaryResultsToCloudWatch = async (
  env: string,
  region: string,
  target: string,
  metricsPrefix: string,
  isTestPassed: boolean,
  testDurationMs: number,
  otherLatencies: object[],
) => {
  const cloudwatch = new CloudWatch({ region: "eu-central-1" });
  const ts = new Date();
  const metrics = [
    {
      MetricName: `${metricsPrefix}.success`,
      Dimensions: [
        {
          Name: "Target",
          Value: target,
        },
        {
          Name: "Region",
          Value: region,
        },
      ],
      Unit: "Count",
      Value: isTestPassed ? 1 : 0,
      Timestamp: ts,
    },
    {
      MetricName: `${metricsPrefix}.failure`,
      Dimensions: [
        {
          Name: "Target",
          Value: target,
        },
        {
          Name: "Region",
          Value: region,
        },
      ],
      Unit: "Count",
      Value: isTestPassed ? 0 : 1,
      Timestamp: ts,
    },
    {
      MetricName: `${metricsPrefix}.latency`,
      Dimensions: [
        {
          Name: "Target",
          Value: target,
        },
        {
          Name: "Region",
          Value: region,
        },
      ],
      Unit: "Milliseconds",
      Value: testDurationMs,
      Timestamp: ts,
    },
  ];

  const latencies = otherLatencies.map((metric) => {
    const metricName = Object.keys(metric)[0];
    return {
      MetricName: `${metricsPrefix}.${metricName}`,
      Dimensions: [
        {
          Name: "Target",
          Value: target,
        },
        {
          Name: "Region",
          Value: region,
        },
      ],
      Unit: "Milliseconds",
      Value: metric[metricName],
      Timestamp: ts,
    };
  });

  const params: CloudWatch.PutMetricDataInput = {
    MetricData: [...metrics, ...latencies],
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

export const uploadLoadTestConnectionDataToCloudWatch = async (
  env: string,
  target: string,
  metricsPrefix: string,
  successfullyConnected: number,
  failedToConnect: number,
  averagePairingTimeMs: number,
  averageHandshakeTimeMs: number,
) => {
  const cloudwatch = new CloudWatch({ region: "eu-central-1" });
  const ts = new Date();

  const params: CloudWatch.PutMetricDataInput = {
    MetricData: [
      {
        MetricName: `${metricsPrefix}.connect.successful`,
        Dimensions: [
          {
            Name: "Target",
            Value: target,
          },
        ],
        Unit: "Count",
        Value: successfullyConnected,
        Timestamp: ts,
      },
      {
        MetricName: `${metricsPrefix}.connect.failed`,
        Dimensions: [
          {
            Name: "Target",
            Value: target,
          },
        ],
        Unit: "Count",
        Value: failedToConnect,
        Timestamp: ts,
      },
      {
        MetricName: `${metricsPrefix}.latency`,
        Dimensions: [
          {
            Name: "Target",
            Value: target,
          },
        ],
        Unit: "Milliseconds",
        Value: averagePairingTimeMs,
        Timestamp: ts,
      },
      {
        MetricName: `${metricsPrefix}.handshake.latency`,
        Dimensions: [
          {
            Name: "Target",
            Value: target,
          },
        ],
        Unit: "Milliseconds",
        Value: averageHandshakeTimeMs,
        Timestamp: ts,
      },
    ],
    Namespace: `${env}_LoadTest_SignClient`,
  };

  await new Promise<void>((resolve) => {
    cloudwatch.putMetricData(params, function (err: Error) {
      if (err) {
        console.warn(err, err.stack);
        // Swallow error as
        // Test shouldn't fail despite CW failing
        // we will report on missing metrics
      }
      resolve();
    });
  });
};
