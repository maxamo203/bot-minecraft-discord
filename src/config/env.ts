import "dotenv/config";
import { z } from "zod";

const discordEnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN es requerido"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID es requerido"),
  DISCORD_DEV_GUILD_ID: z.string().optional(),
});

const envSchema = discordEnvSchema.extend({
  MONGO_URI: z.string().min(1, "MONGO_URI es requerido"),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "ENCRYPTION_KEY debe ser 32 bytes en hex (64 caracteres)"),
});

export type Env = z.infer<typeof envSchema>;
export type DiscordEnv = z.infer<typeof discordEnvSchema>;

function parseEnv<T extends z.ZodTypeAny>(schema: T): z.infer<T> {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuración de entorno inválida:\n${issues}`);
  }
  return parsed.data;
}

/**
 * Config completa del bot (requiere Mongo + clave de cifrado). Validada de forma
 * perezosa (recién al leer una propiedad), para que scripts que no necesitan
 * arrancar el bot completo (ej. `deploy-commands`) puedan importar este módulo
 * sin verse forzados a tener MONGO_URI/ENCRYPTION_KEY seteadas.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return parseEnv(envSchema)[prop as keyof Env];
  },
});

/** Solo las variables de Discord, sin exigir Mongo/cifrado. */
export function loadDiscordEnv(): DiscordEnv {
  return parseEnv(discordEnvSchema);
}
