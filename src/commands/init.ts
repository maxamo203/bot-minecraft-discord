import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { GuildConfig } from "../db/models/GuildConfig.js";
import { createCloudProvider } from "../cloud/factory.js";
import { testSshConnection } from "../ssh/dockerClient.js";
import { requireGuildContext } from "../utils/permissions.js";
import { gordoFail, gordoOk } from "../utils/gordoMessages.js";
import type { Command } from "./Command.js";

export class InitCommand implements Command {
  readonly data = new SlashCommandBuilder()
    .setName("init")
    .setDescription("Configura las credenciales de Azure y SSH para este servidor de Discord")
    .addStringOption((o) => o.setName("tenant_id").setDescription("Azure AD tenant ID").setRequired(true))
    .addStringOption((o) => o.setName("client_id").setDescription("Azure service principal client ID").setRequired(true))
    .addStringOption((o) => o.setName("client_secret").setDescription("Azure service principal client secret").setRequired(true))
    .addStringOption((o) => o.setName("subscription_id").setDescription("Azure subscription ID").setRequired(true))
    .addStringOption((o) => o.setName("resource_group").setDescription("Resource group de la VM").setRequired(true))
    .addStringOption((o) => o.setName("vm_name").setDescription("Nombre de la VM en Azure").setRequired(true))
    .addStringOption((o) => o.setName("ssh_host").setDescription("Host/IP de la VM para SSH").setRequired(true))
    .addStringOption((o) => o.setName("ssh_username").setDescription("Usuario SSH").setRequired(true))
    .addStringOption((o) =>
      o.setName("ssh_password").setDescription("Contraseña SSH (o dejar vacío si usás clave privada)").setRequired(false)
    )
    .addStringOption((o) =>
      o.setName("ssh_private_key").setDescription("Clave privada SSH en texto (o dejar vacío si usás contraseña)").setRequired(false)
    )
    .addIntegerOption((o) => o.setName("ssh_port").setDescription("Puerto SSH (default 22)").setRequired(false));

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await requireGuildContext(interaction))) return;
    const guildId = interaction.guildId!;

    const sshPassword = interaction.options.getString("ssh_password") ?? undefined;
    const sshPrivateKey = interaction.options.getString("ssh_private_key") ?? undefined;

    if (!sshPassword && !sshPrivateKey) {
      await interaction.reply({
        content: gordoFail("Necesito una llave para entrar a la cocina: pasame `ssh_password` o `ssh_private_key` (al menos uno)."),
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const cloud = {
      type: "azure" as const,
      tenantId: interaction.options.getString("tenant_id", true),
      clientId: interaction.options.getString("client_id", true),
      clientSecret: interaction.options.getString("client_secret", true),
      subscriptionId: interaction.options.getString("subscription_id", true),
      resourceGroup: interaction.options.getString("resource_group", true),
      vmName: interaction.options.getString("vm_name", true),
    };

    const ssh = {
      host: interaction.options.getString("ssh_host", true),
      port: interaction.options.getInteger("ssh_port") ?? 22,
      username: interaction.options.getString("ssh_username", true),
      password: sshPassword,
      privateKey: sshPrivateKey,
    };

    try {
      await createCloudProvider(cloud).getPowerState();
    } catch (err) {
      await interaction.editReply(gordoFail("No pude verificar las credenciales de Azure, me quedé con hambre y sin acceso.", err));
      return;
    }

    try {
      await testSshConnection(ssh);
    } catch (err) {
      await interaction.editReply(gordoFail("No pude entrar por SSH, me dejaron afuera del banquete.", err));
      return;
    }

    await GuildConfig.findOneAndUpdate(
      { guildId },
      { guildId, cloud, ssh },
      { upsert: true, setDefaultsOnInsert: true }
    );

    await interaction.editReply(
      gordoOk(
        "Configuración guardada y bien cifradita en la base de datos, como fiambre en la heladera. Ahora usá `/server create` para agregar un servidor de Minecraft."
      )
    );
  }
}
