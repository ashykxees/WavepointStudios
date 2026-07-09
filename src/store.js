import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDirectory = path.resolve("data");
const dataPath = path.join(dataDirectory, "lockdowns.json");

// Shape: { [guildId]: { reason, lockedAt, channels: [{ id, previousSendMessages }] } }
const defaultState = { guilds: {} };

export async function loadState() {
  try {
    const file = await readFile(dataPath, "utf8");
    return { ...defaultState, ...JSON.parse(file) };
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Could not read lockdown data. Starting fresh.", error);
    }

    return { ...defaultState, guilds: {} };
  }
}

export async function saveState(state) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(dataPath, `${JSON.stringify(state, null, 2)}\n`);
}
