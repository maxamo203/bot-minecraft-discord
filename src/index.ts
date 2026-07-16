import { Client, Events, GatewayIntentBits } from "discord.js";
import { env } from "./config/env.js";
import { connectDb } from "./db/connect.js";
import { commandsByName } from "./commands/index.js";
import { gordoFail } from "./utils/gordoMessages.js";

async function main() {
  await connectDb();
  console.log("Conectado a MongoDB.");

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, (c) => {
    console.log(`Bot conectado como ${c.user.tag}.`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commandsByName.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Error ejecutando /${interaction.commandName}:`, err);
      const errorMessage = gordoFail("Se me indigestó el comando y no pude terminarlo.", err);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorMessage).catch(() => undefined);
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => undefined);
      }
    }
  });

  await client.login(env.DISCORD_TOKEN);
}

main().catch((err) => {
  console.error("Error fatal al iniciar el bot:", err);
  process.exit(1);
});
