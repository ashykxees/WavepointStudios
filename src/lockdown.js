import { ChannelType, PermissionFlagsBits } from "discord.js";

// Channel types whose @everyone "Send Messages" permission we toggle on lockdown.
const LOCKABLE_TYPES = new Set([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement
]);

export function getLockableChannels(guild) {
  const me = guild.members.me;

  return [...guild.channels.cache.values()].filter((channel) => {
    if (!LOCKABLE_TYPES.has(channel.type)) {
      return false;
    }
    // Skip channels the bot can't edit permissions on.
    return channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageChannels);
  });
}

// Returns the current explicit @everyone "Send Messages" setting for a channel:
//   true  -> explicitly allowed
//   false -> explicitly denied
//   null  -> neutral / inherited
export function readEveryoneSendMessages(channel) {
  const overwrite = channel.permissionOverwrites.cache.get(channel.guild.id);

  if (!overwrite) {
    return null;
  }
  if (overwrite.allow.has(PermissionFlagsBits.SendMessages)) {
    return true;
  }
  if (overwrite.deny.has(PermissionFlagsBits.SendMessages)) {
    return false;
  }
  return null;
}

export async function lockChannel(channel, reason) {
  await channel.permissionOverwrites.edit(
    channel.guild.roles.everyone,
    { SendMessages: false },
    { reason }
  );
}

export async function restoreChannel(channel, previousSendMessages, reason) {
  await channel.permissionOverwrites.edit(
    channel.guild.roles.everyone,
    { SendMessages: previousSendMessages },
    { reason }
  );
}
