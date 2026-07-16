import { describe, expect, it, vi } from "vitest";
import { requireGuildContext } from "./permissions.js";
import type { ChatInputCommandInteraction } from "discord.js";

function makeInteraction(opts: { inGuild: boolean }): ChatInputCommandInteraction {
  return {
    inGuild: () => opts.inGuild,
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChatInputCommandInteraction;
}

describe("requireGuildContext", () => {
  it("permite pasar una interacción dentro de un guild sin responder con error", async () => {
    const interaction = makeInteraction({ inGuild: true });
    const allowed = await requireGuildContext(interaction);
    expect(allowed).toBe(true);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("rechaza una interacción en DM respondiendo en efímero", async () => {
    const interaction = makeInteraction({ inGuild: false });
    const allowed = await requireGuildContext(interaction);
    expect(allowed).toBe(false);
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
  });
});
