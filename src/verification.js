import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from "discord.js";

// The role id is baked into the button's custom id so verification keeps working
// after the bot restarts, without any saved state.
export const VERIFY_BUTTON_PREFIX = "verify";

const DEFAULT_TITLE = "Verification";
const DEFAULT_DESCRIPTION =
  "Welcome! Please click the button below to gain access to our channels.";
const DEFAULT_BUTTON_LABEL = "Verify";
const GREEN = 0x2ecc71;

export function buildVerifyCustomId(roleId) {
  return `${VERIFY_BUTTON_PREFIX}:${roleId}`;
}

export function parseVerifyCustomId(customId) {
  if (!customId?.startsWith(`${VERIFY_BUTTON_PREFIX}:`)) {
    return null;
  }
  return customId.slice(VERIFY_BUTTON_PREFIX.length + 1) || null;
}

export function buildVerificationPanel({
  roleId,
  title,
  description,
  buttonLabel,
  buttonEmoji,
  imageUrl
} = {}) {
  const embed = new EmbedBuilder()
    .setColor(GREEN)
    .setTitle(title || process.env.VERIFY_TITLE || DEFAULT_TITLE)
    .setDescription(
      description || process.env.VERIFY_DESCRIPTION || DEFAULT_DESCRIPTION
    );

  const image = imageUrl || process.env.VERIFY_IMAGE_URL;
  if (image) {
    embed.setImage(image);
  }

  const button = new ButtonBuilder()
    .setCustomId(buildVerifyCustomId(roleId))
    .setStyle(ButtonStyle.Success)
    .setLabel(
      buttonLabel || process.env.VERIFY_BUTTON_LABEL || DEFAULT_BUTTON_LABEL
    );

  const emoji = buttonEmoji || process.env.VERIFY_BUTTON_EMOJI;
  if (emoji) {
    button.setEmoji(emoji);
  }

  const row = new ActionRowBuilder().addComponents(button);

  return { embeds: [embed], components: [row] };
}
