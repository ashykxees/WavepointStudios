import "dotenv/config";
import { Client, Events, GatewayIntentBits, PermissionFlagsBits } from "discord.js";
import { registerCommands } from "./registerCommands.js";
import { MAX_UNLOCKED_CHANNELS } from "./commands.js";
import {
  buildVerificationPanel,
  parseVerifyCustomId
} from "./verification.js";
import {
  getLockableChannels,
  lockChannel,
  readEveryoneSendMessages,
  restoreChannel
} from "./lockdown.js";
import { loadState, saveState } from "./store.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let state = await loadState();

async function reply(interaction, content) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(content);
    return;
  }
  await interaction.reply({ content, ephemeral: true });
}

// ----- Verification -----

async function handleVerifyPanel(interaction) {
  const role =
    interaction.options.getRole("role") ||
    (process.env.VERIFIED_ROLE_ID
      ? await interaction.guild.roles.fetch(process.env.VERIFIED_ROLE_ID)
      : null);

  if (!role) {
    await reply(
      interaction,
      "No role set. Pass the `role` option or set `VERIFIED_ROLE_ID` in the bot's config."
    );
    return;
  }

  if (role.comparePositionTo(interaction.guild.members.me.roles.highest) >= 0) {
    await reply(
      interaction,
      `I can't assign **${role.name}** because it's above or equal to my highest role. Move my role higher and try again.`
    );
    return;
  }

  const panel = buildVerificationPanel({
    roleId: role.id,
    title: interaction.options.getString("title") || undefined,
    description: interaction.options.getString("description") || undefined,
    buttonLabel: interaction.options.getString("button_label") || undefined
  });

  await interaction.channel.send(panel);
  await reply(interaction, `Verification panel posted. Members who click it get ${role}.`);
}

async function handleVerifyButton(interaction) {
  const roleId = parseVerifyCustomId(interaction.customId);
  if (!roleId) {
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    await reply(interaction, "That role no longer exists. Please contact a staff member.");
    return;
  }

  if (interaction.member.roles.cache.has(role.id)) {
    await reply(interaction, `You already have the ${role} role.`);
    return;
  }

  if (role.comparePositionTo(interaction.guild.members.me.roles.highest) >= 0) {
    await reply(interaction, "I can't assign that role right now. Please contact a staff member.");
    return;
  }

  await interaction.member.roles.add(role, "Verified via verification panel.");
  await reply(interaction, `You're verified! You now have the ${role} role.`);
}

// ----- Moderation helpers -----

function checkModeratable(interaction, target, action) {
  if (!target) {
    return "That user isn't in this server.";
  }
  if (target.id === interaction.user.id) {
    return `You can't ${action} yourself.`;
  }
  if (target.id === interaction.guild.ownerId) {
    return `You can't ${action} the server owner.`;
  }

  const executor = interaction.member;
  const isOwner = executor.id === interaction.guild.ownerId;
  if (!isOwner && executor.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    return `You can't ${action} ${target} because their highest role is above or equal to yours.`;
  }

  const me = interaction.guild.members.me;
  if (me.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    return `I can't ${action} ${target} because their highest role is above or equal to mine.`;
  }

  return null;
}

async function handleKick(interaction) {
  const target = interaction.options.getMember("member");
  const reason = interaction.options.getString("reason") || "No reason provided.";

  const problem = checkModeratable(interaction, target, "kick");
  if (problem) {
    await reply(interaction, problem);
    return;
  }
  if (!target.kickable) {
    await reply(interaction, `I don't have permission to kick ${target}.`);
    return;
  }

  await target.kick(`${interaction.user.tag}: ${reason}`);
  await reply(interaction, `Kicked **${target.user.tag}**. Reason: ${reason}`);
}

async function handleBan(interaction) {
  const user = interaction.options.getUser("member", true);
  const target = interaction.options.getMember("member");
  const reason = interaction.options.getString("reason") || "No reason provided.";
  const deleteDays = interaction.options.getInteger("delete_message_days") || 0;

  // target may be null if the user is not currently in the guild; banning by id still works.
  if (target) {
    const problem = checkModeratable(interaction, target, "ban");
    if (problem) {
      await reply(interaction, problem);
      return;
    }
    if (!target.bannable) {
      await reply(interaction, `I don't have permission to ban ${target}.`);
      return;
    }
  }

  await interaction.guild.members.ban(user.id, {
    reason: `${interaction.user.tag}: ${reason}`,
    deleteMessageSeconds: deleteDays * 24 * 60 * 60
  });
  await reply(interaction, `Banned **${user.tag}**. Reason: ${reason}`);
}

async function handleTimeout(interaction) {
  const target = interaction.options.getMember("member");
  const minutes = interaction.options.getInteger("minutes", true);
  const reason = interaction.options.getString("reason") || "No reason provided.";

  const problem = checkModeratable(interaction, target, "time out");
  if (problem) {
    await reply(interaction, problem);
    return;
  }
  if (!target.moderatable) {
    await reply(interaction, `I don't have permission to time out ${target}.`);
    return;
  }

  if (minutes === 0) {
    await target.timeout(null, `${interaction.user.tag}: ${reason}`);
    await reply(interaction, `Removed the timeout on **${target.user.tag}**.`);
    return;
  }

  await target.timeout(minutes * 60 * 1000, `${interaction.user.tag}: ${reason}`);
  await reply(
    interaction,
    `Timed out **${target.user.tag}** for ${minutes} minute(s). Reason: ${reason}`
  );
}

// ----- Lockdown -----

function getUnlockedChannelIds(interaction) {
  const ids = new Set();
  for (let index = 1; index <= MAX_UNLOCKED_CHANNELS; index += 1) {
    const channel = interaction.options.getChannel(`unlocked_channel_${index}`);
    if (channel) {
      ids.add(channel.id);
    }
  }
  return ids;
}

async function handleLockdown(interaction) {
  const reason = interaction.options.getString("reason") || "No reason provided.";
  const unlockedIds = getUnlockedChannelIds(interaction);
  const auditReason = `Lockdown by ${interaction.user.tag}: ${reason}`;

  const channels = getLockableChannels(interaction.guild).filter(
    (channel) => !unlockedIds.has(channel.id)
  );

  if (channels.length === 0) {
    await reply(interaction, "There are no channels I can lock right now.");
    return;
  }

  const locked = [];
  const failed = [];

  for (const channel of channels) {
    try {
      const previousSendMessages = readEveryoneSendMessages(channel);
      await lockChannel(channel, auditReason);
      locked.push({ id: channel.id, previousSendMessages });
      await channel
        .send(`🔒 This channel has been locked down.\n**Reason:** ${reason}`)
        .catch(() => {});
    } catch (error) {
      console.error(`Failed to lock ${channel.id}:`, error);
      failed.push(channel);
    }
  }

  state.guilds[interaction.guild.id] = {
    reason,
    lockedAt: new Date().toISOString(),
    channels: locked
  };
  await saveState(state);

  let summary = `Locked ${locked.length} channel(s).`;
  if (unlockedIds.size > 0) {
    summary += ` Left ${unlockedIds.size} channel(s) open.`;
  }
  if (failed.length > 0) {
    summary += ` Couldn't lock ${failed.length}: ${failed.map((c) => `${c}`).join(", ")}.`;
  }
  await reply(interaction, summary);
}

async function handleUnlock(interaction) {
  const reason = interaction.options.getString("reason") || "No reason provided.";
  const auditReason = `Unlock by ${interaction.user.tag}: ${reason}`;
  const record = state.guilds[interaction.guild.id];

  if (!record || record.channels.length === 0) {
    await reply(interaction, "There's no active lockdown recorded for this server.");
    return;
  }

  let restored = 0;
  const failed = [];

  for (const entry of record.channels) {
    const channel = await interaction.guild.channels.fetch(entry.id).catch(() => null);
    if (!channel) {
      continue;
    }
    try {
      await restoreChannel(channel, entry.previousSendMessages, auditReason);
      restored += 1;
      await channel
        .send(`🔓 This channel has been unlocked.\n**Reason:** ${reason}`)
        .catch(() => {});
    } catch (error) {
      console.error(`Failed to unlock ${entry.id}:`, error);
      failed.push(channel);
    }
  }

  delete state.guilds[interaction.guild.id];
  await saveState(state);

  let summary = `Unlocked ${restored} channel(s).`;
  if (failed.length > 0) {
    summary += ` Couldn't unlock ${failed.length}: ${failed.map((c) => `${c}`).join(", ")}.`;
  }
  await reply(interaction, summary);
}

// ----- Wiring -----

const chatHandlers = {
  verify_panel: handleVerifyPanel,
  kick: handleKick,
  ban: handleBan,
  timeout: handleTimeout,
  lockdown: handleLockdown,
  unlock: handleUnlock
};

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  try {
    const { scope, count } = await registerCommands({
      token: process.env.DISCORD_TOKEN,
      clientId: process.env.CLIENT_ID || readyClient.user.id,
      guildId: process.env.GUILD_ID
    });
    console.log(`Registered ${count} ${scope} slash commands.`);
  } catch (error) {
    console.error("Failed to register slash commands:", error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton()) {
      if (parseVerifyCustomId(interaction.customId)) {
        await handleVerifyButton(interaction);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (!interaction.inGuild()) {
      await reply(interaction, "This command can only be used in a server.");
      return;
    }

    const handler = chatHandlers[interaction.commandName];
    if (!handler) {
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    await handler(interaction);
  } catch (error) {
    console.error(error);
    await reply(interaction, "Something went wrong. Check the bot console for details.").catch(
      () => {}
    );
  }
});

if (!process.env.DISCORD_TOKEN) {
  throw new Error("Missing DISCORD_TOKEN in .env");
}

client.login(process.env.DISCORD_TOKEN);
