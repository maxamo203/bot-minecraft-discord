import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { GuildConfig } from "../db/models/GuildConfig.js";
import { MinecraftServer } from "../db/models/MinecraftServer.js";
import { requireGuildContext } from "../utils/permissions.js";
import { buildCloudProvider, buildSshCredentials, getGuildConfigOrThrow } from "./shared.js";
import { extractNamedVolume, listRunningContainers, removeContainer, runContainer } from "../ssh/dockerClient.js";
import { gordoFail, gordoOk } from "../utils/gordoMessages.js";
import type { Command } from "./Command.js";

export class ServerCommand implements Command {
  readonly data = new SlashCommandBuilder()
    .setName("server")
    .setDescription("Administra los servidores de Minecraft guardados")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Guarda un servidor de Minecraft nuevo (forward de docker run)")
        .addStringOption((o) => o.setName("name").setDescription("Nombre para identificarlo").setRequired(true))
        .addStringOption((o) => o.setName("container_name").setDescription("Nombre del contenedor Docker").setRequired(true))
        .addStringOption((o) =>
          o
            .setName("docker_run_args")
            .setDescription("Argumentos de 'docker run ...' que crean/levantan el contenedor")
            .setRequired(true)
        )
        .addIntegerOption((o) => o.setName("port").setDescription("Puerto del servidor (default 25565)").setRequired(false))
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("Lista los servidores guardados"))
    .addSubcommand((sub) =>
      sub
        .setName("default")
        .setDescription("Marca un servidor como el predeterminado")
        .addStringOption((o) => o.setName("name").setDescription("Nombre del servidor").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Elimina un servidor guardado y su contenedor Docker")
        .addStringOption((o) => o.setName("name").setDescription("Nombre del servidor").setRequired(true))
        .addBooleanOption((o) =>
          o
            .setName("delete_volume")
            .setDescription("Borrar también el volumen de datos (el mundo). Irreversible. Default: false")
            .setRequired(false)
        )
    );

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await requireGuildContext(interaction))) return;
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();

    let guildConfig;
    try {
      guildConfig = await getGuildConfigOrThrow(guildId);
    } catch (err) {
      await interaction.reply({ content: gordoFail((err as Error).message), ephemeral: true });
      return;
    }

    if (sub === "create") {
      await this.create(interaction, guildId, guildConfig);
      return;
    }

    if (sub === "list") {
      await this.list(interaction, guildId);
      return;
    }

    if (sub === "default") {
      await this.setDefault(interaction, guildId);
      return;
    }

    if (sub === "remove") {
      await this.remove(interaction, guildId, guildConfig);
    }
  }

  private async create(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    guildConfig: Awaited<ReturnType<typeof getGuildConfigOrThrow>>
  ): Promise<void> {
    const name = interaction.options.getString("name", true);
    const containerName = interaction.options.getString("container_name", true);
    const dockerRunArgs = interaction.options.getString("docker_run_args", true);
    const port = interaction.options.getInteger("port") ?? 25565;

    const existing = await MinecraftServer.findOne({ guildId, name });
    if (existing) {
      await interaction.reply({
        content: gordoFail(`Ya existe un servidor llamado "${name}", no hace falta pedir el mismo plato dos veces.`),
        ephemeral: true,
      });
      return;
    }

    const provider = buildCloudProvider(guildConfig);
    const powerState = await provider.getPowerState().catch(() => undefined);
    if (!powerState?.running) {
      await interaction.reply({
        content: gordoFail(
          "La VM está apagada, no puedo cocinar nada con el horno frío. Prendela con `/start` (de otro servidor ya creado) o esperá a tener uno para poder arrancarla."
        ),
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const sshCredentials = buildSshCredentials(guildConfig);
    try {
      await runContainer(sshCredentials, dockerRunArgs);
    } catch (err) {
      await interaction.editReply(gordoFail("No se pudo crear el contenedor, se le quemó la comida al gordo.", err));
      return;
    }

    await MinecraftServer.create({ guildId, name, containerName, dockerRunArgs, port });
    await interaction.editReply(
      gordoOk(`Servidor "${name}" creado y guardado en el menú del gordo. El contenedor ya está corriendo.`)
    );
  }

  private async list(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
    const [servers, guildConfig] = await Promise.all([
      MinecraftServer.find({ guildId }).lean(),
      GuildConfig.findOne({ guildId }).lean(),
    ]);

    if (servers.length === 0) {
      await interaction.reply({
        content: gordoFail("Tengo la panza vacía, no hay servidores guardados todavía. Usá `/server create`."),
        ephemeral: true,
      });
      return;
    }

    const defaultName = guildConfig?.defaultServerName;
    const host = guildConfig?.ssh.host;
    const lines = servers.map((s) => {
      const address = host ? ` — \`${host}:${s.port}\`` : "";
      return `- **${s.name}** (contenedor: \`${s.containerName}\`)${address}${s.name === defaultName ? " ⭐ default" : ""}`;
    });
    await interaction.reply({ content: gordoOk(`Este es el menú completo:\n${lines.join("\n")}`), ephemeral: true });
  }

  private async setDefault(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
    const name = interaction.options.getString("name", true);
    const server = await MinecraftServer.findOne({ guildId, name });
    if (!server) {
      await interaction.reply({ content: gordoFail(`No existe un servidor llamado "${name}", no está en el menú.`), ephemeral: true });
      return;
    }

    await GuildConfig.findOneAndUpdate({ guildId }, { defaultServerName: name });
    await interaction.reply({
      content: gordoOk(`"${name}" es ahora el plato favorito (servidor predeterminado).`),
      ephemeral: true,
    });
  }

  private async remove(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    guildConfig: Awaited<ReturnType<typeof getGuildConfigOrThrow>>
  ): Promise<void> {
    const name = interaction.options.getString("name", true);
    const deleteVolume = interaction.options.getBoolean("delete_volume") ?? false;

    const server = await MinecraftServer.findOne({ guildId, name });
    if (!server) {
      await interaction.reply({ content: gordoFail(`No existe un servidor llamado "${name}", no está en el menú.`), ephemeral: true });
      return;
    }

    const sshCredentials = buildSshCredentials(guildConfig);
    const powerState = await buildCloudProvider(guildConfig)
      .getPowerState()
      .catch(() => undefined);

    if (powerState?.running) {
      const runningContainers = await listRunningContainers(sshCredentials).catch((): string[] => []);
      if (runningContainers.includes(server.containerName)) {
        await interaction.reply({
          content: gordoFail(
            `"${name}" está corriendo ahora mismo, no le voy a sacar el plato a alguien que está comiendo. Pará el servidor con \`/stop\` primero.`
          ),
          ephemeral: true,
        });
        return;
      }
    }

    await interaction.deferReply({ ephemeral: true });

    if (powerState?.running) {
      const volumeName = deleteVolume ? extractNamedVolume(server.dockerRunArgs) : undefined;
      try {
        await removeContainer(sshCredentials, server.containerName, volumeName);
      } catch (err) {
        await interaction.editReply(gordoFail("No se pudo borrar el contenedor, se resiste a que lo saquen de la mesa.", err));
        return;
      }
    }

    await MinecraftServer.deleteOne({ guildId, name });
    if (guildConfig.defaultServerName === name) {
      await GuildConfig.findOneAndUpdate({ guildId }, { $unset: { defaultServerName: "" } });
    }

    await interaction.editReply(
      gordoOk(
        `Servidor "${name}" eliminado, se lo llevó el plato del día${deleteVolume ? " (con volumen y todo)" : ""}.`
      )
    );
  }
}
