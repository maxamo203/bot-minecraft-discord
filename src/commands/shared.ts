import { GuildConfig } from "../db/models/GuildConfig.js";
import { createCloudProvider } from "../cloud/factory.js";
import type { CloudProvider } from "../cloud/CloudProvider.js";
import type { SshCredentials } from "../ssh/dockerClient.js";

export async function getGuildConfigOrThrow(guildId: string) {
  const config = await GuildConfig.findOne({ guildId });
  if (!config) {
    throw new Error("Todavía no le di de comer a este servidor. Usá `/init` primero para llenarle la heladera.");
  }
  return config;
}

export function buildCloudProvider(config: Awaited<ReturnType<typeof getGuildConfigOrThrow>>): CloudProvider {
  return createCloudProvider(config.cloud);
}

export function buildSshCredentials(config: Awaited<ReturnType<typeof getGuildConfigOrThrow>>): SshCredentials {
  return {
    host: config.ssh.host,
    port: config.ssh.port,
    username: config.ssh.username,
    privateKey: config.ssh.privateKey ?? undefined,
    password: config.ssh.password ?? undefined,
  };
}
