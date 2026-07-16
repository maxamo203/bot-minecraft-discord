/**
 * Nombres de los slash commands, centralizados para que `setName()` y los
 * mensajes que los mencionan (ej. "usá `/gordo-server create`") nunca queden
 * desincronizados entre sí.
 */
export const COMMAND_NAMES = {
  init: "gordo-init",
  server: "gordo-server",
  start: "gordo-start",
  stop: "gordo-stop",
  status: "gordo-status",
  config: "gordo-config",
  help: "gordo-help",
} as const;

export const SERVER_SUBCOMMANDS = {
  create: "create",
  list: "list",
  default: "default",
  remove: "remove",
} as const;
