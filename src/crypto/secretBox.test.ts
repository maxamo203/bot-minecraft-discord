import { describe, expect, it, vi } from "vitest";

vi.mock("../config/env.js", () => ({
  env: {
    ENCRYPTION_KEY: "a".repeat(64), // 32 bytes en hex
  },
}));

const { encrypt, decrypt } = await import("./secretBox.js");

describe("secretBox", () => {
  it("descifra lo que cifró", () => {
    const plain = "azure-client-secret-super-secreto";
    const cipherText = encrypt(plain);
    expect(decrypt(cipherText)).toBe(plain);
  });

  it("produce ciphertext distinto para el mismo texto (IV aleatorio)", () => {
    const plain = "misma-clave-ssh";
    const a = encrypt(plain);
    const b = encrypt(plain);
    expect(a).not.toBe(b);
  });

  it("falla al descifrar si se altera el authTag (detecta tampering)", () => {
    const cipherText = encrypt("dato-sensible");
    const [iv, authTag, data] = cipherText.split(":");
    const tamperedTag = authTag.slice(0, -2) + (authTag.slice(-2) === "00" ? "11" : "00");
    const tampered = `${iv}:${tamperedTag}:${data}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("falla al descifrar un payload con formato inválido", () => {
    expect(() => decrypt("no-tiene-el-formato-correcto")).toThrow();
  });
});
