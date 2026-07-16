import type { ChatInputCommandInteraction } from "discord.js";

/**
 * Guard para comandos que operan sobre la config de un guild: responde con un error
 * y devuelve false si el comando se usó fuera de un servidor de Discord (ej. DM).
 *
 * No exige ningún rol o permiso particular: cualquier miembro del servidor puede
 * usar estos comandos, asumiendo que el bot solo se invita a canales/servidores
 * de confianza.
 */
export async function requireGuildContext(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "Este comando solo se puede usar dentro de un servidor de Discord.",
      ephemeral: true,
    });
    return false;
  }

  return true;
}
