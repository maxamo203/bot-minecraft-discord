import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { MinecraftServer } from "../db/models/MinecraftServer.js";
import { buildCloudProvider, buildSshCredentials, getGuildConfigOrThrow } from "./shared.js";
import { getServerStatus } from "../mc/status.js";
import { gordoFail, gordoOk } from "../utils/gordoMessages.js";
import { COMMAND_NAMES } from "./commandNames.js";
import type { Command } from "./Command.js";

export class StatusCommand implements Command {
  readonly data = new SlashCommandBuilder()
    .setName(COMMAND_NAMES.status)
    .setDescription("Muestra el estado de la VM y del servidor de Minecraft");

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: gordoFail("Este comando solo se puede usar dentro de un servidor de Discord, no le como por privado a cualquiera."),
        ephemeral: true,
      });
      return;
    }
    const guildId = interaction.guildId!;

    await interaction.deferReply();

    let guildConfig;
    try {
      guildConfig = await getGuildConfigOrThrow(guildId);
    } catch (err) {
      await interaction.editReply(gordoFail((err as Error).message));
      return;
    }

    const provider = buildCloudProvider(guildConfig);
    const sshCredentials = buildSshCredentials(guildConfig);

    const [powerState, defaultServer] = await Promise.all([
      provider.getPowerState().catch(() => undefined),
      guildConfig.defaultServerName
        ? MinecraftServer.findOne({ guildId, name: guildConfig.defaultServerName }).lean()
        : Promise.resolve(null),
    ]);

    const lines: string[] = [];
    lines.push(
      powerState
        ? `**VM**: ${powerState.running ? "🟢 encendida" : powerState.transitioning ? "🟡 en transición" : "🔴 apagada"}`
        : "**VM**: no se pudo consultar el estado"
    );
    lines.push(`**Servidor predeterminado**: ${guildConfig.defaultServerName ?? "(ninguno)"}`);

    if (defaultServer) {
      const mcStatus = await getServerStatus(sshCredentials.host, defaultServer.port);
      lines.push(
        mcStatus.online
          ? `**Minecraft**: 🟢 online — ${mcStatus.playersOnline}/${mcStatus.maxPlayers} jugadores`
          : "**Minecraft**: 🔴 no responde"
      );
    }

    if (guildConfig.activeSession) {
      lines.push(
        `**Sesión activa**: "${guildConfig.activeSession.serverName}" desde <t:${Math.floor(new Date(guildConfig.activeSession.startedAt).getTime() / 1000)}:R>`
      );
    }

    await interaction.editReply(gordoOk(`Así está mi digestión ahora mismo:\n${lines.join("\n")}`));
  }
}
