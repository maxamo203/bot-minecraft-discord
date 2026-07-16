import type { CloudProvider } from "../cloud/CloudProvider.js";
import type { McStatus } from "../mc/status.js";
import { gordoFail, gordoOk } from "../utils/gordoMessages.js";

export interface PollingConfig {
  intervalMinutes: number;
  emptyChecksThreshold: number;
  bootTimeoutMinutes: number;
}

export interface ServerMonitorDeps {
  provider: CloudProvider;
  pingStatus: () => Promise<McStatus>;
  notify: (message: string) => Promise<void>;
  polling: PollingConfig;
  /** Intervalo de poll durante el arranque, en ms. Default 10s. */
  bootPollIntervalMs?: number;
}

export type MonitorState = "booting" | "watching" | "stopped";

const DEFAULT_BOOT_POLL_INTERVAL_MS = 10_000;

/**
 * Máquina de estados que:
 * 1. Espera a que el servidor de Minecraft responda al ping (fase "booting").
 * 2. Al detectarlo online, espera `intervalMinutes` y empieza a pollear jugadores (fase "watching").
 * 3. Si `emptyChecksThreshold` polls consecutivos dan 0 jugadores, apaga la VM (fase "stopped").
 *
 * Un monitor gestiona una sola sesión; para cancelarlo (stop manual o reemplazo) llamar a `cancel()`.
 */
export class ServerMonitor {
  private state: MonitorState = "booting";
  private emptyChecksCount = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private cancelled = false;

  constructor(private readonly deps: ServerMonitorDeps) {}

  getState(): MonitorState {
    return this.state;
  }

  /** Arranca la máquina de estados. No bloquea: agenda su propio polling. */
  start(): void {
    void this.runBootPhase(Date.now());
  }

  /** Cancela el monitor (ej. por /stop manual o porque se lanzó un nuevo /start). No apaga la VM. */
  cancel(): void {
    this.cancelled = true;
    if (this.timer) clearTimeout(this.timer);
    this.state = "stopped";
  }

  private async runBootPhase(startedAt: number): Promise<void> {
    if (this.cancelled) return;

    const bootTimeoutMs = this.deps.polling.bootTimeoutMinutes * 60_000;
    const pollIntervalMs = this.deps.bootPollIntervalMs ?? DEFAULT_BOOT_POLL_INTERVAL_MS;

    const mcStatus = await this.deps.pingStatus();

    if (this.cancelled) return;

    if (mcStatus.online) {
      this.state = "watching";
      await this.deps.notify(gordoOk("El servidor de Minecraft ya está arriba y con hambre de jugadores."));
      this.scheduleNextPlayerCheck();
      return;
    }

    if (Date.now() - startedAt >= bootTimeoutMs) {
      this.state = "stopped";
      await this.deps.notify(
        gordoFail(
          `El servidor no respondió dentro de los ${this.deps.polling.bootTimeoutMinutes} minutos de espera. Se canceló el monitoreo (la VM sigue encendida, no se me quemó el asado del todo).`
        )
      );
      return;
    }

    this.timer = setTimeout(() => {
      void this.runBootPhase(startedAt);
    }, pollIntervalMs);
  }

  private scheduleNextPlayerCheck(): void {
    if (this.cancelled) return;
    const intervalMs = this.deps.polling.intervalMinutes * 60_000;
    this.timer = setTimeout(() => {
      void this.runPlayerCheck();
    }, intervalMs);
  }

  private async runPlayerCheck(): Promise<void> {
    if (this.cancelled) return;

    const mcStatus = await this.deps.pingStatus();

    if (this.cancelled) return;

    if (mcStatus.online && mcStatus.playersOnline > 0) {
      this.emptyChecksCount = 0;
      this.scheduleNextPlayerCheck();
      return;
    }

    this.emptyChecksCount += 1;

    if (this.emptyChecksCount < this.deps.polling.emptyChecksThreshold) {
      this.scheduleNextPlayerCheck();
      return;
    }

    this.state = "stopped";
    await this.deps.provider.stop();
    await this.deps.notify(gordoOk("No hay jugadores conectados. El gordo se aburrió y apagó la VM por inactividad."));
  }
}
