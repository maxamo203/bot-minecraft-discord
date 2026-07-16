import { InitCommand } from "./init.js";
import { ServerCommand } from "./server.js";
import { StartCommand } from "./start.js";
import { StopCommand } from "./stop.js";
import { StatusCommand } from "./status.js";
import { ConfigCommand } from "./config.js";
import { HelpCommand } from "./help.js";
import type { Command } from "./Command.js";

export const commands: Command[] = [
  new InitCommand(),
  new ServerCommand(),
  new StartCommand(),
  new StopCommand(),
  new StatusCommand(),
  new ConfigCommand(),
  new HelpCommand(),
];

export const commandsByName = new Map(commands.map((c) => [c.data.name, c]));
