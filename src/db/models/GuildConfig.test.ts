import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

process.env.ENCRYPTION_KEY = "b".repeat(64);
process.env.DISCORD_TOKEN = "test-token";
process.env.DISCORD_CLIENT_ID = "test-client-id";
process.env.MONGO_URI = "mongodb://placeholder/placeholder";

const { GuildConfig } = await import("./GuildConfig.js");

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  await GuildConfig.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const sampleCloud = {
  type: "azure" as const,
  tenantId: "tenant",
  clientId: "client",
  clientSecret: "super-secret-value",
  subscriptionId: "sub",
  resourceGroup: "rg",
  vmName: "vm",
};

const sampleSsh = {
  host: "1.2.3.4",
  port: 22,
  username: "root",
  password: "super-secret-password",
};

describe("GuildConfig", () => {
  it("guarda las credenciales cifradas en Mongo (no en texto plano)", async () => {
    await GuildConfig.create({ guildId: "guild-1", cloud: sampleCloud, ssh: sampleSsh });

    const raw = await mongoose.connection.collection("guildconfigs").findOne({ guildId: "guild-1" });

    expect(raw).toBeTruthy();
    expect(raw!.cloud.clientSecret).not.toBe(sampleCloud.clientSecret);
    expect(raw!.cloud.clientSecret).toContain(":"); // formato iv:tag:ciphertext
    expect(raw!.ssh.password).not.toBe(sampleSsh.password);
  });

  it("descifra las credenciales al leer el documento con mongoose", async () => {
    await GuildConfig.create({ guildId: "guild-2", cloud: sampleCloud, ssh: sampleSsh });

    const doc = await GuildConfig.findOne({ guildId: "guild-2" });

    expect(doc!.cloud.clientSecret).toBe(sampleCloud.clientSecret);
    expect(doc!.ssh.password).toBe(sampleSsh.password);
  });

  it("aplica los defaults de polling al crear", async () => {
    const doc = await GuildConfig.create({ guildId: "guild-3", cloud: sampleCloud, ssh: sampleSsh });

    expect(doc.polling.intervalMinutes).toBe(15);
    expect(doc.polling.emptyChecksThreshold).toBe(1);
    expect(doc.polling.bootTimeoutMinutes).toBe(10);
  });

  it("upsert de /init no duplica la config existente del guild", async () => {
    await GuildConfig.findOneAndUpdate(
      { guildId: "guild-4" },
      { guildId: "guild-4", cloud: sampleCloud, ssh: sampleSsh },
      { upsert: true, setDefaultsOnInsert: true }
    );
    await GuildConfig.findOneAndUpdate(
      { guildId: "guild-4" },
      { guildId: "guild-4", cloud: { ...sampleCloud, vmName: "otra-vm" }, ssh: sampleSsh },
      { upsert: true, setDefaultsOnInsert: true }
    );

    const count = await GuildConfig.countDocuments({ guildId: "guild-4" });
    expect(count).toBe(1);

    const doc = await GuildConfig.findOne({ guildId: "guild-4" });
    expect(doc!.cloud.vmName).toBe("otra-vm");
  });

  it("rechaza un guildId duplicado por creación directa (constraint único)", async () => {
    await GuildConfig.create({ guildId: "guild-5", cloud: sampleCloud, ssh: sampleSsh });
    await expect(GuildConfig.create({ guildId: "guild-5", cloud: sampleCloud, ssh: sampleSsh })).rejects.toThrow();
  });

  it("re-ejecutar /init (upsert sobre config existente) con solo password (sin privateKey) no rompe", async () => {
    const upsert = () =>
      GuildConfig.findOneAndUpdate(
        { guildId: "guild-6" },
        { guildId: "guild-6", cloud: sampleCloud, ssh: sampleSsh },
        { upsert: true, setDefaultsOnInsert: true }
      );

    await upsert();
    await expect(upsert()).resolves.toBeTruthy();

    const doc = await GuildConfig.findOne({ guildId: "guild-6" });
    expect(doc!.ssh.password).toBe(sampleSsh.password);
    expect(doc!.ssh.privateKey).toBeUndefined();
  });
});
