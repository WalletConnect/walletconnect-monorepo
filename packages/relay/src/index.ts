import config from "./config";
import { HttpService } from "./http";

const { app } = new HttpService({
  port: config.port,
  host: config.host,
  logger: config.debug ? "debug" : "warn",
});

app.listen(+config.port, config.host, err => {
  if (err) throw err;
});
