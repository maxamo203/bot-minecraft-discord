import { Schema, model, type InferSchemaType } from "mongoose";

const minecraftServerSchema = new Schema(
  {
    guildId: { type: String, required: true },
    name: { type: String, required: true },
    containerName: { type: String, required: true },
    dockerRunArgs: { type: String, required: true },
    port: { type: Number, required: true, default: 25565 },
  },
  { timestamps: true }
);

minecraftServerSchema.index({ guildId: 1, name: 1 }, { unique: true });

export type MinecraftServerDoc = InferSchemaType<typeof minecraftServerSchema>;

export const MinecraftServer = model("MinecraftServer", minecraftServerSchema);
