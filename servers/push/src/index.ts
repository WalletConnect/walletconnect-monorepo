import fastify from "fastify";
import helmet from "fastify-helmet";
import axios from "axios";

import config from "./config/index";
import { setClientDetails, getClientDetails } from "./keystore";
import { formatMessage } from "./i18n";
import { ClientDetails } from "./types";

const fcmApi = axios.create({
  baseURL: config.fcm.url,
  timeout: 3000,
  headers: {
    "Content-Type": "application/json",
    Authorization: `key=${config.fcm.apiKey}`,
  },
});

const app = fastify({ logger: config.debug });

app.register(helmet);

// for container health checks
app.get("/health", (_, res) => {
  res.status(204).send();
});

app.post("/new", async (req, res) => {
  const { bridge, topic, type, token, peerName, language } = req.body as any;

  if (!topic || typeof topic !== "string") {
    return res.status(400).send({
      message: "Error: missing or invalid topic field",
    });
  }

  if (!type || typeof type !== "string") {
    return res.status(400).send({
      message: "Error: missing or invalid type field",
    });
  }

  if (!token || typeof token !== "string") {
    return res.status(400).send({
      message: "Error: missing or invalid token field",
    });
  }

  if (!peerName || typeof peerName !== "string") {
    return res.status(400).send({
      message: "Error: missing or invalid peerName field",
    });
  }

  if (!language || typeof language !== "string") {
    return res.status(400).send({
      message: "Error: missing or invalid language field",
    });
  }

  const clientDetails: ClientDetails = { type, token, peerName, language };

  try {
    await setClientDetails(topic, clientDetails);

    const webhook = `${config.host}/push`;

    const { data } = await axios.post(`${bridge}/subscribe`, { topic, webhook });

    if (!data.success) {
      return res.status(400).send({
        message: "Error: failed to subscribe to bridge server",
      });
    }

    return res.status(200).send({
      success: true,
    });
  } catch (error) {
    return res.status(400).send({
      message: "Error: failed to save client details",
    });
  }
});

app.post("/push", async (req, res) => {
  const { topic } = req.body as any;

  if (!topic || typeof topic !== "string") {
    return res.status(400).send({
      message: "Error: missing or invalid topic field",
    });
  }

  const clientDetails = await getClientDetails(topic);

  if (!clientDetails) {
    return res.status(400).send({
      message: "Error: failed to get client details",
    });
  }

  const { type, token, peerName, language } = clientDetails;
  const body = formatMessage(peerName, language);

  const notification = {
    to: token,
    notification: {
      body: body,
    },
  };

  switch (type.toLowerCase()) {
    case "fcm":
      try {
        const response = await fcmApi.post("", notification);
        if (response.status === 200 && response.data && response.data.success === 1) {
          return res.status(200).send({
            success: true,
          });
        } else {
          return res.status(400).send({
            message: "Error: failed to push notification",
          });
        }
      } catch (e) {
        return res.status(400).send({
          message: "Error: failed to push notification",
        });
      }
    default:
      return res.status(400).send({
        message: "Error: push notifcation type not supported",
      });
  }
});

const [host, port] = config.host.split(":");
app.listen(+port, host, (err, address) => {
  if (err) throw err;
  app.log.info(`Server listening on ${address}`);
});
