/**
 * A Discord bot that runs the health check regularly
 *
 */
const Discord = require("discord.js");
const { checkHealth } = require("./healthcheck");

const client = new Discord.Client();

/**
 * Report the bridge response time to the Discord server
 *
 * @param channel
 */
async function reportHealth(channel) {
  // eslint-disable-next-line no-console
  const result = await checkHealth(5000, console.log);
  if (result.alive) {
    // https://github.com/discordjs/discord.js/issues/4278
    channel.send(
      `Bridge server round trip health check completed in ${result.durationSeconds} seconds`,
    );
  } else {
    channel.send(`Health check failed, ${result.error} - please check server logs`);
  }
}

// Set up bot logic
client.on("ready", async () => {
  const myChannel = process.env.CHANNEL;
  if (!myChannel) {
    throw new Error("CHANNEL environment variable missing");
  }

  const tag = (client && client.user && client.user.tag) || "missing";
  // eslint-disable-next-line no-console
  console.log(`Logged in as ${tag}, activated on channel id ${myChannel}`);

  // eslint-disable-next-line no-console
  console.log("Channels", client.channels);

  const channel = await client.channels.fetch(myChannel);
  // eslint-disable-next-line no-console
  console.log("My channel is", channel);

  // channel.send() missing
  channel.send("WalletConnect health bot restarted");

  await reportHealth(channel);

  // Check the health once in a hour
  setInterval(async () => {
    // eslint-disable-next-line no-console
    console.log("setInterval triggered");
    await reportHealth(channel);
  }, 3600 * 1000);
});

// Respond to ping messages to see if the bot is alive
client.on("message", (msg) => {
  if (msg.content === "ping") {
    msg.reply("pong");
  }
});

client.login(process.env.DISCORD_TOKEN);
