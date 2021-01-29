import client from "prom-client";

const register = new client.Registry();
// Just leaving this here as an example of how to register
// a metric to a register.
//let a = new client.Counter({name: "a", help: "a"})
//register.registerMetric(a)

client.collectDefaultMetrics({
  prefix: "relay_",
  register,
  gcDurationBuckets: [0.1, 1, 5],
});

export default register;
