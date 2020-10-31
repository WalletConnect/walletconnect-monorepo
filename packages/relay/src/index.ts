import config from "./config";
import { HttpService } from "./http";

const { app } = new HttpService({
  logger: config.debug ? "debug" : "warn",
});

app.listen(+config.port, config.host, err => {
  if (err) throw err;
});
