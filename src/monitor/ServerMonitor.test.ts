import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServerMonitor, type ServerMonitorDeps } from "./ServerMonitor.js";
import type { CloudProvider } from "../cloud/CloudProvider.js";
import type { McStatus } from "../mc/status.js";

function makeDeps(overrides: Partial<ServerMonitorDeps> = {}): ServerMonitorDeps {
  const provider: CloudProvider = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getPowerState: vi.fn().mockResolvedValue({ running: true, transitioning: false }),
  };

  return {
    provider,
    pingStatus: vi.fn<() => Promise<McStatus>>().mockResolvedValue({ online: false, playersOnline: 0, maxPlayers: 20 }),
    notify: vi.fn().mockResolvedValue(undefined),
    polling: { intervalMinutes: 15, emptyChecksThreshold: 1, bootTimeoutMinutes: 10 },
    bootPollIntervalMs: 10_000,
    ...overrides,
  };
}

// Deja correr las promesas ya resueltas (los `await this.deps.pingStatus()` dentro del monitor)
// antes de avanzar los fake timers. Necesario porque el monitor mezcla async/await con setTimeout.
async function flushMicrotasks(times = 5) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ServerMonitor - fase de arranque", () => {
  it("pollea hasta que el server responde online y pasa a watching", async () => {
    const pingStatus = vi
      .fn<() => Promise<McStatus>>()
      .mockResolvedValueOnce({ online: false, playersOnline: 0, maxPlayers: 20 })
      .mockResolvedValueOnce({ online: false, playersOnline: 0, maxPlayers: 20 })
      .mockResolvedValueOnce({ online: true, playersOnline: 0, maxPlayers: 20 });

    const deps = makeDeps({ pingStatus });
    const monitor = new ServerMonitor(deps);
    monitor.start();

    await flushMicrotasks();
    expect(monitor.getState()).toBe("booting");

    await vi.advanceTimersByTimeAsync(10_000);
    await flushMicrotasks();
    expect(monitor.getState()).toBe("booting");

    await vi.advanceTimersByTimeAsync(10_000);
    await flushMicrotasks();

    expect(monitor.getState()).toBe("watching");
    expect(deps.notify).toHaveBeenCalledWith(expect.stringMatching(/arriba/i));
  });

  it("si supera bootTimeoutMinutes sin responder, corta y NO llama a provider.stop()", async () => {
    const deps = makeDeps({
      polling: { intervalMinutes: 15, emptyChecksThreshold: 1, bootTimeoutMinutes: 1 },
      bootPollIntervalMs: 10_000,
    });
    const monitor = new ServerMonitor(deps);
    monitor.start();
    await flushMicrotasks();

    // 1 minuto de timeout / 10s de poll => ~6 iteraciones para superarlo
    for (let i = 0; i < 7; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
      await flushMicrotasks();
    }

    expect(monitor.getState()).toBe("stopped");
    expect(deps.provider.stop).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith(expect.stringMatching(/no respondió/i));
  });
});

describe("ServerMonitor - fase de watching (jugadores)", () => {
  function makeWatchingDeps(pingStatus: ServerMonitorDeps["pingStatus"]) {
    return makeDeps({
      polling: { intervalMinutes: 15, emptyChecksThreshold: 1, bootTimeoutMinutes: 10 },
      pingStatus,
    });
  }

  it("el primer chequeo de jugadores ocurre exactamente intervalMinutes después de detectarse online", async () => {
    const pingStatus = vi
      .fn<() => Promise<McStatus>>()
      .mockResolvedValueOnce({ online: true, playersOnline: 0, maxPlayers: 20 }) // boot: ya está online
      .mockResolvedValueOnce({ online: true, playersOnline: 2, maxPlayers: 20 }); // primer chequeo de jugadores

    const deps = makeWatchingDeps(pingStatus);
    const monitor = new ServerMonitor(deps);
    monitor.start();
    await flushMicrotasks();

    expect(monitor.getState()).toBe("watching");
    expect(pingStatus).toHaveBeenCalledTimes(1);

    // Un instante antes del intervalo: todavía no debe haber pingueado de nuevo.
    await vi.advanceTimersByTimeAsync(15 * 60_000 - 1000);
    await flushMicrotasks();
    expect(pingStatus).toHaveBeenCalledTimes(1);

    // Al cumplirse el intervalo completo, recién ahí pollea jugadores.
    await vi.advanceTimersByTimeAsync(1000);
    await flushMicrotasks();
    expect(pingStatus).toHaveBeenCalledTimes(2);
  });

  it("si hay jugadores conectados, resetea el contador de vacíos y no apaga", async () => {
    const pingStatus = vi
      .fn<() => Promise<McStatus>>()
      .mockResolvedValueOnce({ online: true, playersOnline: 0, maxPlayers: 20 })
      .mockResolvedValueOnce({ online: true, playersOnline: 5, maxPlayers: 20 })
      .mockResolvedValueOnce({ online: true, playersOnline: 3, maxPlayers: 20 });

    const deps = makeWatchingDeps(pingStatus);
    const monitor = new ServerMonitor(deps);
    monitor.start();
    await flushMicrotasks();

    await vi.advanceTimersByTimeAsync(15 * 60_000);
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    await flushMicrotasks();

    expect(deps.provider.stop).not.toHaveBeenCalled();
    expect(monitor.getState()).toBe("watching");
  });

  it("al alcanzar emptyChecksThreshold, llama a provider.stop() una sola vez y termina", async () => {
    const pingStatus = vi
      .fn<() => Promise<McStatus>>()
      .mockResolvedValueOnce({ online: true, playersOnline: 0, maxPlayers: 20 }) // boot
      .mockResolvedValueOnce({ online: true, playersOnline: 0, maxPlayers: 20 }) // check 1: vacío
      .mockResolvedValueOnce({ online: true, playersOnline: 0, maxPlayers: 20 }); // check 2: vacío (alcanza threshold=2)

    const deps = makeDeps({
      polling: { intervalMinutes: 15, emptyChecksThreshold: 2, bootTimeoutMinutes: 10 },
      pingStatus,
    });
    const monitor = new ServerMonitor(deps);
    monitor.start();
    await flushMicrotasks();

    await vi.advanceTimersByTimeAsync(15 * 60_000);
    await flushMicrotasks();
    expect(deps.provider.stop).not.toHaveBeenCalled();
    expect(monitor.getState()).toBe("watching");

    await vi.advanceTimersByTimeAsync(15 * 60_000);
    await flushMicrotasks();

    expect(deps.provider.stop).toHaveBeenCalledTimes(1);
    expect(monitor.getState()).toBe("stopped");

    // No debe seguir polleando después de apagar.
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    await flushMicrotasks();
    expect(pingStatus).toHaveBeenCalledTimes(3);
  });

  it("cancel() durante watching detiene el polling limpiamente sin llamar stop()", async () => {
    const pingStatus = vi.fn<() => Promise<McStatus>>().mockResolvedValue({ online: true, playersOnline: 0, maxPlayers: 20 });
    const deps = makeWatchingDeps(pingStatus);
    const monitor = new ServerMonitor(deps);
    monitor.start();
    await flushMicrotasks();

    expect(monitor.getState()).toBe("watching");
    monitor.cancel();

    await vi.advanceTimersByTimeAsync(60 * 60_000);
    await flushMicrotasks();

    expect(deps.provider.stop).not.toHaveBeenCalled();
    expect(pingStatus).toHaveBeenCalledTimes(1); // solo el ping del boot, nada más tras cancelar
    expect(monitor.getState()).toBe("stopped");
  });
});
