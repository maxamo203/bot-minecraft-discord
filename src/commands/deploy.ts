import { REST, Routes } from "discord.js";
import { loadDiscordEnv } from "../config/env.js";
import { commands } from "./index.js";

async function main() {
  const env = loadDiscordEnv();

  const rest = new REST().setToken(env.DISCORD_TOKEN);
  const body = commands.map((c) => c.data.toJSON());

  const route = env.DISCORD_DEV_GUILD_ID
    ? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_DEV_GUILD_ID)
    : Routes.applicationCommands(env.DISCORD_CLIENT_ID);

  await rest.put(route, { body });

  console.log(
    env.DISCORD_DEV_GUILD_ID
      ? `Comandos registrados en el guild de desarrollo ${env.DISCORD_DEV_GUILD_ID}.`
      : "Comandos registrados globalmente (puede tardar hasta 1 hora en propagarse)."
  );
}

main().catch((err) => {
  console.error("Error al registrar comandos:", err);
  process.exit(1);
});
