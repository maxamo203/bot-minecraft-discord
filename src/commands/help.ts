import { SlashCommandBuilder, EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import { COMMAND_NAMES, SERVER_SUBCOMMANDS } from "./commandNames.js";
import type { Command } from "./Command.js";

export class HelpCommand implements Command {
  readonly data = new SlashCommandBuilder()
    .setName(COMMAND_NAMES.help)
    .setDescription("Explica qué hace cada comando del bot");

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle("🍔 El menú del Gordo")
      .setColor(0x57f287)
      .setDescription("Todos los platos (comandos) están disponibles para cualquier miembro del servidor. Buen provecho.")
      .addFields(
        {
          name: `/${COMMAND_NAMES.init}`,
          value:
            "Configura las credenciales de Azure y SSH para este servidor de Discord. Se hace una sola vez (o para actualizar credenciales).",
        },
        {
          name: `/${COMMAND_NAMES.server} ${SERVER_SUBCOMMANDS.create}`,
          value: "Crea el contenedor Docker en la VM (forward de `docker run`) y lo guarda. Requiere la VM prendida.",
        },
        {
          name: `/${COMMAND_NAMES.server} ${SERVER_SUBCOMMANDS.list}`,
          value: "Lista los servidores guardados con su dirección `host:puerto` para copiar en Minecraft.",
        },
        {
          name: `/${COMMAND_NAMES.server} ${SERVER_SUBCOMMANDS.default}`,
          value: "Marca un servidor como el predeterminado.",
        },
        {
          name: `/${COMMAND_NAMES.server} ${SERVER_SUBCOMMANDS.remove}`,
          value: `Borra el contenedor real y el registro. Bloquea si está corriendo (parar con \`/${COMMAND_NAMES.stop}\` antes). \`delete_volume:true\` borra también el mundo.`,
        },
        {
          name: `/${COMMAND_NAMES.start} [name]`,
          value: "Enciende la VM y levanta el contenedor del servidor indicado (o el predeterminado si no se especifica).",
        },
        { name: `/${COMMAND_NAMES.stop}`, value: "Apaga la VM manualmente." },
        { name: `/${COMMAND_NAMES.status}`, value: "Muestra el estado de la VM y del servidor de Minecraft (jugadores conectados)." },
        {
          name: `/${COMMAND_NAMES.config}`,
          value:
            "Ajusta los intervalos de polling: cada cuánto se chequea si hay jugadores y cuántos chequeos vacíos esperar antes de apagar.",
        },
        { name: `/${COMMAND_NAMES.help}`, value: "Muestra este mensaje." }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
