/**
 * A Discord bot that runs the health check regularly
 *
 */
import Discord from 'discord.js';
import { checkHealth } from './healthcheck';
import assert from 'assert';

const client = new Discord.Client();

/**
 * Report the bridge response time to the Discord server
 *
 * @param channel
 */
async function reportHealth(channel: Discord.Channel) {
  const result = await checkHealth(5000, console.log);
  if(result.alive) {
    // https://github.com/discordjs/discord.js/issues/4278
    (channel as Discord.TextChannel).send(`Bridge server round trip health check completed in ${result.durationSeconds} seconds`);
  } else {
    (channel as Discord.TextChannel).send(`Health check failed, ${result.error} - please check server logs`);
  }

}

// Set up bot logic
client.on('ready', async () => {

  const myChannel = process.env.CHANNEL;
  assert(myChannel, "CHANNEL environment variable missing");

  console.log(`Logged in as ${client.user.tag}, activated on channel id ${myChannel}`);

  console.log("Channels", client.channels);

  const channel = await client.channels.fetch(myChannel);
  console.log("My channel is", channel);

  // channel.send() missing
  (channel as Discord.TextChannel).send("WalletConnect health bot restarted");

  await reportHealth(channel);

  // Check the health once in a hour
  setInterval(async () => {
    console.log("setInterval triggered");
    await reportHealth(channel);
  }, 3600*1000);
});

// Respond to ping messages to see if the bot is alive
client.on('message', (msg: any) => {
  if (msg.content === 'ping') {
    msg.reply('pong');
  }
});

client.login(process.env.DISCORD_TOKEN);

