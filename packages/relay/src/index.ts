import fastify, { RequestGenericInterface } from "fastify";
import Helmet from "fastify-helmet";

import config from "./config";
import { setNotification } from "./keystore";
import { initWebSocketServer } from "./socket";
import { assertType } from "./utils";

const app = fastify({
  logger: { prettyPrint: config.debug } as any,
});

app.register(Helmet);

app.get("/health", (_, res) => {
  res.status(204).send();
});

app.get("/hello", (req, res) => {
  res.status(200).send(`Hello World, this is WalletConnect`);
});

interface PostSubscribeRequest extends RequestGenericInterface {
  Body: {
    topic: string;
    webhook: string;
  };
}

app.post<PostSubscribeRequest>("/subscribe", async (req, res) => {
  try {
    assertType(req, "body", "object");

    assertType(req.body, "topic");
    assertType(req.body, "webhook");

    await setNotification({
      topic: req.body.topic,
      webhook: req.body.webhook,
    });

    res.status(200).send({ success: true });
  } catch (e) {
    res.status(400).send({ message: `Error: ${e.message}` });
  }
});

app.ready(() => {
  initWebSocketServer(app.server, app.log);
});

const [host, port] = config.host.split(":");
app.listen(+port, host, (err, address) => {
  if (err) throw err;
  console.log(`Server listening on ${address}`);
  app.log.info(`Server listening on ${address}`);
});
