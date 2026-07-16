import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

/**
 * Unión de los tres tipos de builder que puede devolver una cadena de
 * `new SlashCommandBuilder()...`, según si termina agregando opciones simples,
 * subcomandos, o ninguna de las dos cosas.
 */
export type SlashCommandData = SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;

export interface Command {
  readonly data: SlashCommandData;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
