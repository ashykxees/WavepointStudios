import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

// How many "leave this channel unlocked" options the /lockdown command exposes.
export const MAX_UNLOCKED_CHANNELS = 5;

function addUnlockedChannelOptions(command) {
  for (let index = 1; index <= MAX_UNLOCKED_CHANNELS; index += 1) {
    command.addChannelOption((option) =>
      option
        .setName(`unlocked_channel_${index}`)
        .setDescription("A channel that should stay open during the lockdown.")
        .setRequired(false)
    );
  }
  return command;
}

export const commands = [
  // Verification is handled entirely by the auto-posted panel (see index.js);
  // there is no verification slash command.

  // ----- Moderation -----
  // Moderation command access is gated by MOD_ROLE_IDS in index.js, so these are
  // left visible to everyone rather than hidden behind a Discord permission.
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server.")
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("member")
        .setDescription("The member to kick.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for the kick (shown in the audit log).")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server.")
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("member")
        .setDescription("The member to ban.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for the ban (shown in the audit log).")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("delete_message_days")
        .setDescription("Days of the member's recent messages to delete (0-7).")
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Time a member out (mute) for a number of minutes.")
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("member")
        .setDescription("The member to time out.")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("minutes")
        .setDescription("How long the timeout lasts, in minutes (0 removes an active timeout).")
        .setMinValue(0)
        .setMaxValue(40320) // Discord max is 28 days.
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for the timeout (shown in the audit log).")
        .setRequired(false)
    ),

  // ----- Lockdown -----
  addUnlockedChannelOptions(
    new SlashCommandBuilder()
      .setName("lockdown")
      .setDescription("Lock every text channel so only staff can talk.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .setDMPermission(false)
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("Reason announced in each locked channel.")
          .setRequired(false)
      )
  ),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Reopen the channels that were locked by /lockdown.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason announced in each reopened channel.")
        .setRequired(false)
    )
].map((command) => command.toJSON());
