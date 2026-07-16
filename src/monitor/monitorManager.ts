import { ServerMonitor, type ServerMonitorDeps } from "./ServerMonitor.js";

const activeMonitors = new Map<string, ServerMonitor>();

/** Reemplaza (cancelando el anterior si existía) y arranca el monitor activo de un guild. */
export function startMonitor(guildId: string, deps: ServerMonitorDeps): ServerMonitor {
  stopMonitor(guildId);
  const monitor = new ServerMonitor(deps);
  activeMonitors.set(guildId, monitor);
  monitor.start();
  return monitor;
}

/** Cancela el monitor activo de un guild, si existe. No apaga la VM. */
export function stopMonitor(guildId: string): void {
  const existing = activeMonitors.get(guildId);
  if (existing) {
    existing.cancel();
    activeMonitors.delete(guildId);
  }
}

export function getActiveMonitor(guildId: string): ServerMonitor | undefined {
  return activeMonitors.get(guildId);
}
