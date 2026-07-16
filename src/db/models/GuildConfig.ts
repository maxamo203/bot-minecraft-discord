import { Schema, model, type InferSchemaType } from "mongoose";
import { decrypt, encrypt } from "../../crypto/secretBox.js";

const encryptedString = {
  type: String,
  required: true,
  set: (value: string | undefined) => (value ? encrypt(value) : value),
  get: (value: string | undefined) => (value ? decrypt(value) : value),
};

const cloudSchema = new Schema(
  {
    type: { type: String, enum: ["azure"], required: true, default: "azure" },
    tenantId: { type: String, required: true },
    clientId: { type: String, required: true },
    clientSecret: encryptedString,
    subscriptionId: { type: String, required: true },
    resourceGroup: { type: String, required: true },
    vmName: { type: String, required: true },
  },
  { _id: false }
);

const sshSchema = new Schema(
  {
    host: { type: String, required: true },
    port: { type: Number, required: true, default: 22 },
    username: { type: String, required: true },
    privateKey: { ...encryptedString, required: false },
    password: { ...encryptedString, required: false },
  },
  { _id: false }
);

const pollingSchema = new Schema(
  {
    intervalMinutes: { type: Number, required: true, default: 15 },
    emptyChecksThreshold: { type: Number, required: true, default: 1 },
    bootTimeoutMinutes: { type: Number, required: true, default: 10 },
  },
  { _id: false }
);

const guildConfigSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true },
    cloud: { type: cloudSchema, required: true },
    ssh: { type: sshSchema, required: true },
    defaultServerName: { type: String, required: false },
    polling: { type: pollingSchema, required: true, default: () => ({}) },
    activeSession: {
      type: new Schema(
        {
          serverName: { type: String, required: true },
          channelId: { type: String, required: true },
          startedAt: { type: Date, required: true },
        },
        { _id: false }
      ),
      required: false,
    },
  },
  { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } }
);

export type GuildConfigDoc = InferSchemaType<typeof guildConfigSchema>;

export const GuildConfig = model("GuildConfig", guildConfigSchema);
