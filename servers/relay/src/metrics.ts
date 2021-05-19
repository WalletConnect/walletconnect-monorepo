import client from "prom-client";

import { METRICS_PREFIX, METRICS_DURACTION_BUCKETS } from "./constants";

const register = new client.Registry();
// Just leaving this here as an example of how to register
// a metric to a register.
//let a = new client.Counter({name: "a", help: "a"})
//register.registerMetric(a)

client.collectDefaultMetrics({
  prefix: METRICS_PREFIX,
  register,
  gcDurationBuckets: METRICS_DURACTION_BUCKETS,
});

export default register;
