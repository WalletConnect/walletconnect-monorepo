import client from "prom-client"

const register = new client.Registry()

client.collectDefaultMetrics({
  register,
  gcDurationBuckets: [0.1, 1, 5]
})

export default register
