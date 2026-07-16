import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN es requerido"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID es requerido"),
  DISCORD_DEV_GUILD_ID: z.string().optional(),
  MONGO_URI: z.string().min(1, "MONGO_URI es requerido"),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "ENCRYPTION_KEY debe ser 32 bytes en hex (64 caracteres)"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuración de entorno inválida:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
