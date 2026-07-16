/**
 * Frases con la temática del bot ("Bot Minecraft Gordo") para envolver mensajes
 * de éxito y error. En éxito, halagan al usuario ("sos un gordo exitoso"); en
 * error, le echan la culpa con onda de joda shitpost. Se elige una al azar en
 * cada llamada para variar el tono; el mensaje real (y el error técnico en los
 * fallos) siempre queda intacto para poder debuguear.
 */

const OK_PREFIXES = [
  "🏆 Sos un gordo exitoso,",
  "💪 Gordo campeón, mirá cómo se hace:",
  "👑 Gordo de oro, tremendo crack:",
  "🍔 Sos una máquina de comer y de codear, gordo:",
  "🥇 Gordo ganador, aplaudan:",
  "🐘 Gordo mamut, aplastaste el server con estilo:",
  "🦍 GORDO ALPHA CHAD, mirá lo que hiciste:",
  "🍗 900 kilos de puro talento, gordo:",
  "🎖️ Condecoración al mérito gordo, tremendo:",
  "🥩 Asado sin fallar ni un corte, gordo genio:",
  "🧈 Más manteca que Chef, pero le pegaste igual:",
  "🛸 Gordo que trasciende la dimensión del server, anduvo:",
  "🚀 Houston, el gordo despegó sin fallar:",
  "🐋 Gordo ballena, tenés más masa que fallos:",
  "🏋️ Gordo levantando el server con una mano:",
  "🥓 Tocino bendito, el gordo la rompió:",
  "🍖 Gordo carnívoro, devoraste ese bug:",
  "🫃 Panza de campeón, resultado de campeón:",
  "🎩 Gordo distinguido, un placer servirle:",
  "🐷 Chanchito con suerte, salió redondo:",
];

const FAIL_PREFIXES = [
  "🤡 Gordo fracasado, la cagaste:",
  "💩 Sos un gordo desastre, mirá lo que hiciste:",
  "🐌 Gordo lento y torpe, no te salió:",
  "🥴 Gordo bruto, otra vez la misma:",
  "😤 Andá a bañarte, gordo inútil, esto explotó:",
  "🩸 Gordo, te desangraste solo con este comando:",
  "🧟 Gordo zombie, ni el server te quiere cerca:",
  "🚨🚨🚨 GORDO EN LLAMAS, ALERTA MÁXIMA:",
  "🫏 Sos un burro con sobrepeso, mirá el desastre:",
  "🗑️ Directo al tacho, gordo reciclable fallido:",
  "🤮 Le diste asco hasta al servidor, gordo:",
  "⚰️ Aquí yace el intento del gordo, RIP:",
  "🐖 Chancho fallero, ni comiendo acertás:",
  "🥵 Gordo transpirado de la vergüenza, mirá esto:",
  "🫠 El gordo se derritió en vivo, qué papelón:",
  "🍔🔥 Combo fallido: gordo + comando = desastre:",
  "🦥 Gordo perezoso, ni el error se molestó en avisar bien:",
  "🚽 Se te fue el comando por el inodoro, gordo:",
  "👹 Gordo demonio del caos, esto no iba a andar nunca:",
  "🐔 Gordo gallina, huiste del éxito una vez más:",
];

function pick(options: string[]): string {
  return options[Math.floor(Math.random() * options.length)];
}

/** Envuelve un mensaje de éxito halagando al usuario con onda gorda. */
export function gordoOk(message: string): string {
  return `${pick(OK_PREFIXES)} ${message}`;
}

/**
 * Envuelve un mensaje de error culpando al usuario con onda gorda (joda, no
 * ofensivo de verdad), dejando SIEMPRE el detalle técnico visible al final
 * para poder debuguear.
 */
export function gordoFail(message: string, err?: unknown): string {
  const technical = err instanceof Error ? err.message : err !== undefined ? String(err) : undefined;
  const base = `${pick(FAIL_PREFIXES)} ${message}`;
  return technical ? `${base}\n\`\`\`${technical}\`\`\`` : base;
}
