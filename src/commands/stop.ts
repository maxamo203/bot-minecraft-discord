import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { GuildConfig } from "../db/models/GuildConfig.js";
import { requireGuildContext } from "../utils/permissions.js";
import { buildCloudProvider, getGuildConfigOrThrow } from "./shared.js";
import { stopMonitor } from "../monitor/monitorManager.js";
import { gordoFail, gordoOk } from "../utils/gordoMessages.js";
import { COMMAND_NAMES } from "./commandNames.js";
import type { Command } from "./Command.js";

export class StopCommand implements Command {
  readonly data = new SlashCommandBuilder().setName(COMMAND_NAMES.stop).setDescription("Apaga la VM manualmente");

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

    stopMonitor(guildId);

    const provider = buildCloudProvider(guildConfig);
    try {
      await provider.stop();
    } catch (err) {
      await interaction.editReply(gordoFail("No se pudo apagar la VM, quedó comiendo de más.", err));
      return;
    }

    await GuildConfig.findOneAndUpdate({ guildId }, { $unset: { activeSession: "" } });

    await interaction.editReply(gordoOk("VM apagada. El gordo se fue a dormir la siesta."));
  }
}
