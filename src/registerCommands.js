import { REST, Routes } from "discord.js";
import { commands } from "./commands.js";

export async function registerCommands({ token, clientId, guildId }) {
  if (!token || !clientId) {
    throw new Error("Missing DISCORD_TOKEN or CLIENT_ID.");
  }

  const rest = new REST({ version: "10" }).setToken(token);

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands
    });
    return { scope: "guild", count: commands.length };
  }

  await rest.put(Routes.applicationCommands(clientId), {
    body: commands
  });
  return { scope: "global", count: commands.length };
}
