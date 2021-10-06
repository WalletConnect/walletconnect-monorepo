import config from "./config";
import { HttpService } from "./http";

const { app } = new HttpService({
  logger: config.logLevel,
});

app.listen(+config.port, config.host, (err, address) => {
  app.log.info(`Server listening on ${address}`);
  if (err) throw err;
});
