import { status } from "minecraft-server-util";

export interface McStatus {
  online: boolean;
  playersOnline: number;
  maxPlayers: number;
}

const PING_TIMEOUT_MS = 5000;

/**
 * Hace un Server List Ping al servidor. Si el host es inalcanzable o no responde
 * (server apagado, VM apagada, timeout), devuelve `{ online: false }` en vez de lanzar.
 */
export async function getServerStatus(host: string, port: number): Promise<McStatus> {
  try {
    const result = await status(host, port, { timeout: PING_TIMEOUT_MS });
    return {
      online: true,
      playersOnline: result.players.online,
      maxPlayers: result.players.max,
    };
  } catch {
    return { online: false, playersOnline: 0, maxPlayers: 0 };
  }
}
