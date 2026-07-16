import { describe, expect, it, vi } from "vitest";

const statusMock = vi.fn();

vi.mock("minecraft-server-util", () => ({
  status: (...args: unknown[]) => statusMock(...args),
}));

const { getServerStatus } = await import("./status.js");

describe("getServerStatus", () => {
  it("devuelve online y el conteo de jugadores cuando el ping responde", async () => {
    statusMock.mockResolvedValueOnce({
      players: { online: 3, max: 20 },
    });

    const result = await getServerStatus("1.2.3.4", 25565);

    expect(result).toEqual({ online: true, playersOnline: 3, maxPlayers: 20 });
  });

  it("devuelve online:false cuando el host es inalcanzable (timeout/conexión rechazada)", async () => {
    statusMock.mockRejectedValueOnce(new Error("connect ETIMEDOUT"));

    const result = await getServerStatus("1.2.3.4", 25565);

    expect(result.online).toBe(false);
  });

  it("no lanza excepción sin manejar cuando el ping falla", async () => {
    statusMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(getServerStatus("1.2.3.4", 25565)).resolves.not.toThrow();
  });
});
