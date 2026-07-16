import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";

process.env.ENCRYPTION_KEY = "c".repeat(64);
process.env.DISCORD_TOKEN = "test-token";
process.env.DISCORD_CLIENT_ID = "test-client-id";
process.env.MONGO_URI = "mongodb://placeholder/placeholder";

const runContainerMock = vi.fn().mockResolvedValue({ stdout: "container-id\n", stderr: "", exitCode: 0 });
const listRunningContainersMock = vi.fn().mockResolvedValue([]);
const removeContainerMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../ssh/dockerClient.js", async () => {
  const actual = await vi.importActual<typeof import("../ssh/dockerClient.js")>("../ssh/dockerClient.js");
  return {
    ...actual,
    runContainer: (...args: unknown[]) => runContainerMock(...args),
    listRunningContainers: (...args: unknown[]) => listRunningContainersMock(...args),
    removeContainer: (...args: unknown[]) => removeContainerMock(...args),
  };
});

const getPowerStateMock = vi.fn().mockResolvedValue({ running: true, transitioning: false });
vi.mock("../cloud/factory.js", () => ({
  createCloudProvider: () => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getPowerState: getPowerStateMock,
  }),
}));

const { GuildConfig } = await import("../db/models/GuildConfig.js");
const { MinecraftServer } = await import("../db/models/MinecraftServer.js");
const { ServerCommand } = await import("./server.js");

const command = new ServerCommand();

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  await MinecraftServer.deleteMany({});
  await GuildConfig.deleteMany({});
  runContainerMock.mockClear();
  listRunningContainersMock.mockClear().mockResolvedValue([]);
  removeContainerMock.mockClear();
  getPowerStateMock.mockClear().mockResolvedValue({ running: true, transitioning: false });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

async function seedGuildConfig(guildId: string) {
  await GuildConfig.create({
    guildId,
    cloud: {
      type: "azure",
      tenantId: "tenant",
      clientId: "client",
      clientSecret: "secret",
      subscriptionId: "sub",
      resourceGroup: "rg",
      vmName: "vm",
    },
    ssh: { host: "1.2.3.4", port: 22, username: "root", password: "pw" },
  });
}

function makeInteraction(opts: {
  guildId: string;
  subcommand: string;
  options?: Record<string, string | number | boolean>;
}): ChatInputCommandInteraction {
  const options = opts.options ?? {};
  return {
    inGuild: () => true,
    guildId: opts.guildId,
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    options: {
      getSubcommand: () => opts.subcommand,
      getString: (name: string) => (options[name] !== undefined ? String(options[name]) : null),
      getInteger: (name: string) => (options[name] !== undefined ? Number(options[name]) : null),
      getBoolean: (name: string) => (options[name] !== undefined ? Boolean(options[name]) : null),
    },
  } as unknown as ChatInputCommandInteraction;
}

describe("/server (integración)", () => {
  it("create + list + default + remove funcionan de punta a punta", async () => {
    const guildId = "guild-int-1";
    await seedGuildConfig(guildId);

    const createInteraction = makeInteraction({
      guildId,
      subcommand: "create",
      options: { name: "survival", container_name: "mc-survival", docker_run_args: "-d --name mc-survival itzg/minecraft-server", port: 25565 },
    });
    await command.execute(createInteraction);
    expect(runContainerMock).toHaveBeenCalledWith(expect.anything(), "-d --name mc-survival itzg/minecraft-server");
    expect(createInteraction.editReply).toHaveBeenCalledWith(expect.stringContaining("creado"));

    const listInteraction = makeInteraction({ guildId, subcommand: "list" });
    await command.execute(listInteraction);
    expect(listInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("survival") }));

    const defaultInteraction = makeInteraction({ guildId, subcommand: "default", options: { name: "survival" } });
    await command.execute(defaultInteraction);
    const guildConfig = await GuildConfig.findOne({ guildId });
    expect(guildConfig?.defaultServerName).toBe("survival");

    const removeInteraction = makeInteraction({ guildId, subcommand: "remove", options: { name: "survival" } });
    await command.execute(removeInteraction);
    expect(removeContainerMock).toHaveBeenCalledWith(expect.anything(), "mc-survival", undefined);
    const remaining = await MinecraftServer.findOne({ guildId, name: "survival" });
    expect(remaining).toBeNull();
  });

  it("rechaza el comando fuera de un servidor de Discord (DM)", async () => {
    const interaction = {
      inGuild: () => false,
      reply: vi.fn().mockResolvedValue(undefined),
      options: { getSubcommand: () => "list" },
    } as unknown as ChatInputCommandInteraction;

    await command.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
  });

  it("create no duplica un servidor con el mismo nombre en el mismo guild", async () => {
    const guildId = "guild-int-3";
    await seedGuildConfig(guildId);
    const opts = { name: "survival", container_name: "mc-survival", docker_run_args: "-d --name mc-survival itzg/minecraft-server" };

    await command.execute(makeInteraction({ guildId, subcommand: "create", options: opts }));
    const second = makeInteraction({ guildId, subcommand: "create", options: opts });
    await command.execute(second);

    expect(second.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("Ya existe") }));
    const count = await MinecraftServer.countDocuments({ guildId, name: "survival" });
    expect(count).toBe(1);
    expect(runContainerMock).toHaveBeenCalledTimes(1);
  });

  it("create rechaza si la VM está apagada, sin llamar a runContainer", async () => {
    const guildId = "guild-int-5";
    await seedGuildConfig(guildId);
    getPowerStateMock.mockResolvedValueOnce({ running: false, transitioning: false });

    const interaction = makeInteraction({
      guildId,
      subcommand: "create",
      options: { name: "survival", container_name: "mc-survival", docker_run_args: "-d itzg/minecraft-server" },
    });
    await command.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("apagada") }));
    expect(runContainerMock).not.toHaveBeenCalled();
    const count = await MinecraftServer.countDocuments({ guildId, name: "survival" });
    expect(count).toBe(0);
  });

  it("remove bloquea si el contenedor está corriendo, sin borrar nada", async () => {
    const guildId = "guild-int-6";
    await seedGuildConfig(guildId);
    await MinecraftServer.create({
      guildId,
      name: "survival",
      containerName: "mc-survival",
      dockerRunArgs: "-d --name mc-survival itzg/minecraft-server",
      port: 25565,
    });
    listRunningContainersMock.mockResolvedValueOnce(["mc-survival"]);

    const interaction = makeInteraction({ guildId, subcommand: "remove", options: { name: "survival" } });
    await command.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("corriendo") }));
    expect(removeContainerMock).not.toHaveBeenCalled();
    const stillThere = await MinecraftServer.findOne({ guildId, name: "survival" });
    expect(stillThere).not.toBeNull();
  });

  it("remove con delete_volume:true pasa el nombre del volumen extraído de docker_run_args", async () => {
    const guildId = "guild-int-7";
    await seedGuildConfig(guildId);
    await MinecraftServer.create({
      guildId,
      name: "survival",
      containerName: "mc-survival",
      dockerRunArgs: "-d --name mc-survival -v minecraft-data:/data itzg/minecraft-server",
      port: 25565,
    });

    const interaction = makeInteraction({ guildId, subcommand: "remove", options: { name: "survival", delete_volume: true } });
    await command.execute(interaction);

    expect(removeContainerMock).toHaveBeenCalledWith(expect.anything(), "mc-survival", "minecraft-data");
  });

  it("rechaza cualquier subcomando si el guild no corrió /init todavía", async () => {
    const interaction = makeInteraction({
      guildId: "guild-int-4-sin-init",
      subcommand: "list",
    });

    await command.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("/init") })
    );
  });
});
