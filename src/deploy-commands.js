import "dotenv/config";
import { registerCommands } from "./registerCommands.js";

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  throw new Error("Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in .env");
}

const { scope, count } = await registerCommands({
  token: DISCORD_TOKEN,
  clientId: CLIENT_ID,
  guildId: GUILD_ID
});

console.log(`Registered ${count} ${scope} slash commands.`);
