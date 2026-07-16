import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { GuildConfig } from "../db/models/GuildConfig.js";
import { requireGuildContext } from "../utils/permissions.js";
import { getGuildConfigOrThrow } from "./shared.js";
import { gordoFail, gordoOk } from "../utils/gordoMessages.js";
import type { Command } from "./Command.js";

export class ConfigCommand implements Command {
  readonly data = new SlashCommandBuilder()
    .setName("config")
    .setDescription("Configura los intervalos de polling de inactividad")
    .addIntegerOption((o) =>
      o.setName("interval_minutes").setDescription("Minutos entre chequeos de jugadores").setRequired(false).setMinValue(1)
    )
    .addIntegerOption((o) =>
      o
        .setName("empty_checks_threshold")
        .setDescription("Cantidad de chequeos vacíos consecutivos antes de apagar")
        .setRequired(false)
        .setMinValue(1)
    )
    .addIntegerOption((o) =>
      o.setName("boot_timeout_minutes").setDescription("Minutos máximos de espera a que arranque el server").setRequired(false).setMinValue(1)
    );

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await requireGuildContext(interaction))) return;
    const guildId = interaction.guildId!;

    let guildConfig;
    try {
      guildConfig = await getGuildConfigOrThrow(guildId);
    } catch (err) {
      await interaction.reply({ content: gordoFail((err as Error).message), ephemeral: true });
      return;
    }

    const intervalMinutes = interaction.options.getInteger("interval_minutes");
    const emptyChecksThreshold = interaction.options.getInteger("empty_checks_threshold");
    const bootTimeoutMinutes = interaction.options.getInteger("boot_timeout_minutes");

    if (intervalMinutes === null && emptyChecksThreshold === null && bootTimeoutMinutes === null) {
      const p = guildConfig.polling;
      await interaction.reply({
        content: gordoOk(
          `Así está configurada mi dieta:\n- intervalMinutes: ${p.intervalMinutes}\n- emptyChecksThreshold: ${p.emptyChecksThreshold}\n- bootTimeoutMinutes: ${p.bootTimeoutMinutes}`
        ),
        ephemeral: true,
      });
      return;
    }

    const update: Record<string, number> = {};
    if (intervalMinutes !== null) update["polling.intervalMinutes"] = intervalMinutes;
    if (emptyChecksThreshold !== null) update["polling.emptyChecksThreshold"] = emptyChecksThreshold;
    if (bootTimeoutMinutes !== null) update["polling.bootTimeoutMinutes"] = bootTimeoutMinutes;

    await GuildConfig.findOneAndUpdate({ guildId }, { $set: update });

    await interaction.reply({ content: gordoOk("Dieta actualizada, ahora a cumplirla."), ephemeral: true });
  }
}
