# Wavepoint Studios Bot

A Discord bot for the Wavepoint Studios server with three systems:

- **Verification** – post a panel with a button; clicking it grants members a role.
- **Moderation** – `/kick`, `/ban`, and `/timeout` slash commands.
- **Lockdown** – `/lockdown` and `/unlock` to close or reopen the server's text
  channels, with the option to leave chosen channels open.

## Commands

### Verification

The verification panel is **posted automatically on startup** into the channel set
by `VERIFY_PANEL_CHANNEL_ID` (defaults to the Wavepoint verification channel). On
each restart the bot reuses the existing panel instead of posting duplicates, so
you don't need to run a command. `VERIFIED_ROLE_ID` must be set for the auto panel.

- `/verify_panel` – (optional) manually posts a panel in the current channel.
  - `role` (optional) – the role granted on click. Defaults to `VERIFIED_ROLE_ID`.
  - `title`, `description`, `button_label` (optional) – customise the panel text.

  Members click the button to receive the role. The bot answers with an ephemeral
  message and skips anyone who already has the role. Requires **Manage Server**.

### Moderation

- `/kick` – `member`, optional `reason`.
- `/ban` – `member`, optional `reason`, optional `delete_message_days` (0–7).
  Works even if the user already left the server.
- `/timeout` – `member`, `minutes` (0 removes an active timeout, max 40320 = 28
  days), optional `reason`.

Access is restricted to the role IDs in `MOD_ROLE_IDS` (administrators are always
allowed); anyone else gets an ephemeral "no permission" reply. Every command also
checks role hierarchy: you can't action yourself, the owner, or anyone whose top
role is above/equal to yours or the bot's.

### Lockdown

- `/lockdown` – denies **Send Messages** for `@everyone` in every text channel the
  bot can manage.
  - `reason` (optional) – announced in each locked channel.
  - `unlocked_channel_1` … `unlocked_channel_5` (optional) – channels to leave open.

  The previous permission state of each channel is saved so it can be restored.
- `/unlock` – restores the channels closed by the last `/lockdown`.
  - `reason` (optional) – announced in each reopened channel.

Both require **Manage Channels**.

## Setup

1. Install Node.js 18 or newer.
2. In this folder, run:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in:

   ```bash
   DISCORD_TOKEN=...
   CLIENT_ID=...
   GUILD_ID=...
   VERIFIED_ROLE_ID=...   # optional default verify role
   ```

4. Start the bot:

   ```bash
   npm start
   ```

The bot **registers its slash commands automatically on startup**, so they show up
in Discord without any extra step. This also means it works on hosts like Railway,
Render, or Heroku that only run `npm start`.

If `GUILD_ID` is set, commands are registered to that server and appear instantly.
Without `GUILD_ID`, they are registered globally and can take up to an hour to appear.

You can also register commands manually without starting the bot:

```bash
npm run deploy
```

## Required bot permissions & intents

Invite the bot with the **Manage Roles**, **Kick Members**, **Ban Members**,
**Moderate Members**, **Manage Channels**, and **Send Messages** permissions. The
bot's own role must sit **above** the verification role and any members it moderates.
No privileged gateway intents are required.

## Deploying on Railway

Set `DISCORD_TOKEN`, `CLIENT_ID`, and (recommended) `GUILD_ID` as service variables
in the Railway dashboard, then deploy. Railway runs `npm start`, which logs in and
auto-registers the commands.

> Lockdown state is stored in `data/lockdowns.json`. On hosts with an ephemeral
> filesystem, attach a volume if you want `/unlock` to survive restarts.
