Provides a health check script for WalletConnect.

* Check the bridge server health from CLI

* Discord bot to report the bridge server health regularly

* A standalone web page where you can direct web browser and mobile users to check if their device works with WalletConnect bridge

# Setting up

As the writing of this, we use ``next`` release packages, not production releases.

```sh
npm install
```

# Running the health check the command line

Run:

```sh
npm run health-check
```

This will give you log output and exit status 1 if the health check fails or does not complete within 5 seconds.

# Running the Discord bot

A Discord bot is provided for regular bridge health check-ups.

Create a bot in https://discord.com/developers/ - Turn off "Public bot" switch.

Use *Show Token* on Bot tab to get your bot token.

You need to type in a custom URL in a browser to get to the Discord add bot screen:

https://discordapp.com/oauth2/authorize?&client_id=YOUR_CLIENT_ID_HERE&scope=bot&permissions=0

Then you need to get the channel id, a long number, from the last part of the URL when your
web browser is on that channel. Here the id would be `709138598124847144`.

```
https://discord.com/channels/709138539136417832/709138598124847144
```

Run bot with the given token and channel.

```
DISCORD_TOKEN="Nz..." CHANNEL="" npm run discord
```

You can also say `ping` on the channel of the bot to get `pong` to see if it's alive.

[More information how to create a Discord bot](https://www.digitaltrends.com/gaming/how-to-make-a-discord-bot/).

# Internals

How WalletConnect events go

1. Originator (dApp) creates a new WalletConnect session
  - Session initiated with `connect()`
  - This results to an session id, which is transported as URI. The same URI is displayed in a QR code
2. Joiner (wallet) connects to the session
  - URI passed to WalletConnect constructor
  - Session accepted with `createSession()`
3. Originator (dApp) will receive `connect` callback
  - Originator replies with `ping`
4. Joiner (wallet) receives `ping`
  - Call it a working setup and calculate time how long it took


