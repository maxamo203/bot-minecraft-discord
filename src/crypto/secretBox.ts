import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, "hex");
}

/** Cifra un string en texto plano. Formato de salida: `iv:authTag:ciphertext` (todo en hex). */
export function encrypt(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/** Descifra un string generado por `encrypt`. Lanza si el formato o el authTag no son válidos (tampering). */
export function decrypt(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Formato de secreto cifrado inválido");
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plainText = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plainText.toString("utf8");
}
