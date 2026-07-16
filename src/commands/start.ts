import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { GuildConfig } from "../db/models/GuildConfig.js";
import { MinecraftServer } from "../db/models/MinecraftServer.js";
import { requireGuildContext } from "../utils/permissions.js";
import { buildCloudProvider, buildSshCredentials, getGuildConfigOrThrow } from "./shared.js";
import { runContainer, listContainers, startContainer } from "../ssh/dockerClient.js";
import { getServerStatus } from "../mc/status.js";
import { startMonitor } from "../monitor/monitorManager.js";
import { gordoFail, gordoOk } from "../utils/gordoMessages.js";
import type { Command } from "./Command.js";

export class StartCommand implements Command {
  readonly data = new SlashCommandBuilder()
    .setName("start")
    .setDescription("Enciende la VM y levanta un servidor de Minecraft")
    .addStringOption((o) => o.setName("name").setDescription("Nombre del servidor (default: el predeterminado)").setRequired(false));

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await requireGuildContext(interaction))) return;
    const guildId = interaction.guildId!;

    await interaction.deferReply();

    let guildConfig;
    try {
      guildConfig = await getGuildConfigOrThrow(guildId);
    } catch (err) {
      await interaction.editReply(gordoFail((err as Error).message));
      return;
    }

    const requestedName = interaction.options.getString("name") ?? guildConfig.defaultServerName;
    if (!requestedName) {
      await interaction.editReply(
        gordoFail("No especificaste un servidor y no hay uno predeterminado. Usá `/server list` o `/server default`.")
      );
      return;
    }

    const server = await MinecraftServer.findOne({ guildId, name: requestedName });
    if (!server) {
      await interaction.editReply(gordoFail(`No existe un servidor llamado "${requestedName}", no está en el menú.`));
      return;
    }

    const provider = buildCloudProvider(guildConfig);
    const sshCredentials = buildSshCredentials(guildConfig);

    await interaction.editReply(gordoOk(`Prendiendo el horno (la VM) para cocinar "${server.name}"...`));

    try {
      await provider.start();
    } catch (err) {
      await interaction.editReply(gordoFail("No se pudo prender la VM, el gordo se quedó sin gas.", err));
      return;
    }

    await interaction.editReply(gordoOk(`VM prendida y humeando. Sirviendo el contenedor "${server.containerName}"...`));

    try {
      const existingContainers = await listContainers(sshCredentials);
      if (existingContainers.includes(server.containerName)) {
        await startContainer(sshCredentials, server.containerName);
      } else {
        await runContainer(sshCredentials, server.dockerRunArgs);
      }
    } catch (err) {
      await interaction.editReply(gordoFail("No se pudo levantar el contenedor, se le cayó la olla.", err));
      return;
    }

    const channel = interaction.channel;

    startMonitor(guildId, {
      provider,
      pingStatus: () => getServerStatus(sshCredentials.host, server.port),
      notify: async (message: string) => {
        if (channel && "send" in channel) {
          await channel.send(message);
        }
      },
      polling: {
        intervalMinutes: guildConfig.polling.intervalMinutes,
        emptyChecksThreshold: guildConfig.polling.emptyChecksThreshold,
        bootTimeoutMinutes: guildConfig.polling.bootTimeoutMinutes,
      },
    });

    await GuildConfig.findOneAndUpdate(
      { guildId },
      {
        activeSession: {
          serverName: server.name,
          channelId: interaction.channelId,
          startedAt: new Date(),
        },
      }
    );

    await interaction.editReply(
      gordoOk("Contenedor servido en la mesa. Esperando a que el servidor de Minecraft se digiera... Te aviso por acá cuando esté listo.")
    );
  }
}
