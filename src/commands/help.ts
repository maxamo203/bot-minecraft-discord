import { SlashCommandBuilder, EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "./Command.js";

export class HelpCommand implements Command {
  readonly data = new SlashCommandBuilder()
    .setName("helpgordo")
    .setDescription("Explica qué hace cada comando del bot");

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle("🍔 El menú del Gordo")
      .setColor(0x57f287)
      .setDescription("Todos los platos (comandos) están disponibles para cualquier miembro del servidor. Buen provecho.")
      .addFields(
        {
          name: "/init",
          value:
            "Configura las credenciales de Azure y SSH para este servidor de Discord. Se hace una sola vez (o para actualizar credenciales).",
        },
        {
          name: "/server create",
          value: "Crea el contenedor Docker en la VM (forward de `docker run`) y lo guarda. Requiere la VM prendida.",
        },
        { name: "/server list", value: "Lista los servidores guardados con su dirección `host:puerto` para copiar en Minecraft." },
        { name: "/server default", value: "Marca un servidor como el predeterminado." },
        {
          name: "/server remove",
          value: "Borra el contenedor real y el registro. Bloquea si está corriendo (parar con `/stop` antes). `delete_volume:true` borra también el mundo.",
        },
        {
          name: "/start [name]",
          value: "Enciende la VM y levanta el contenedor del servidor indicado (o el predeterminado si no se especifica).",
        },
        { name: "/stop", value: "Apaga la VM manualmente." },
        { name: "/status", value: "Muestra el estado de la VM y del servidor de Minecraft (jugadores conectados)." },
        {
          name: "/config",
          value:
            "Ajusta los intervalos de polling: cada cuánto se chequea si hay jugadores y cuántos chequeos vacíos esperar antes de apagar.",
        },
        { name: "/helpgordo", value: "Muestra este mensaje." }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
