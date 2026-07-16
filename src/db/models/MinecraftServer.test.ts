import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { MinecraftServer } from "./MinecraftServer.js";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  await MinecraftServer.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("MinecraftServer", () => {
  it("permite el mismo nombre en guilds distintos", async () => {
    await MinecraftServer.create({
      guildId: "guild-a",
      name: "survival",
      containerName: "mc-survival",
      dockerRunArgs: "-d itzg/minecraft-server",
      port: 25565,
    });

    await expect(
      MinecraftServer.create({
        guildId: "guild-b",
        name: "survival",
        containerName: "mc-survival",
        dockerRunArgs: "-d itzg/minecraft-server",
        port: 25565,
      })
    ).resolves.toBeTruthy();
  });

  it("rechaza nombres duplicados dentro del mismo guild", async () => {
    await MinecraftServer.create({
      guildId: "guild-a",
      name: "survival",
      containerName: "mc-survival",
      dockerRunArgs: "-d itzg/minecraft-server",
      port: 25565,
    });

    await expect(
      MinecraftServer.create({
        guildId: "guild-a",
        name: "survival",
        containerName: "mc-survival-2",
        dockerRunArgs: "-d itzg/minecraft-server",
        port: 25566,
      })
    ).rejects.toThrow();
  });

  it("aplica el default de puerto (25565)", async () => {
    const doc = await MinecraftServer.create({
      guildId: "guild-a",
      name: "creative",
      containerName: "mc-creative",
      dockerRunArgs: "-d itzg/minecraft-server",
    });

    expect(doc.port).toBe(25565);
  });
});
