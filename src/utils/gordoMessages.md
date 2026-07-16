# gordoMessages

Utilidad de una sola responsabilidad: envolver los textos de respuesta de los
comandos con el tono "Bot Minecraft Gordo" (shitpost, halagos exagerados en
éxito, insultos de joda en fallo), sin tocar la lógica de negocio de cada
comando.

## API

```ts
gordoOk(message: string): string
gordoFail(message: string, err?: unknown): string
```

- **`gordoOk`**: antepone una frase random de la lista `OK_PREFIXES` al mensaje.
- **`gordoFail`**: antepone una frase random de `FAIL_PREFIXES`. Si se pasa
  `err` (un `Error` o cualquier valor), se agrega **siempre** al final en un
  bloque de código Markdown, para no perder nunca el detalle técnico real
  aunque el resto del mensaje sea joda.

## Por qué existe

Separar el humor del contenido evita que cada comando tenga que armar sus
propias frases (duplicación) y permite variar el tono sin tocar `init.ts`,
`server.ts`, `start.ts`, etc. — todos importan estas dos funciones y las usan
para envolver lo que ya iban a responder.

## Uso

```ts
import { gordoFail, gordoOk } from "../utils/gordoMessages.js";

// éxito
await interaction.reply(gordoOk("Servidor guardado."));

// error, con el error técnico real preservado para debug
try {
  await algoQuePuedeFallar();
} catch (err) {
  await interaction.reply(gordoFail("No se pudo hacer tal cosa.", err));
}
```

## Agregar más frases

Las listas `OK_PREFIXES` y `FAIL_PREFIXES` en `gordoMessages.ts` son arrays de
strings simples — agregar una entrada nueva alcanza, no requiere tocar nada
más. `pick()` elige una al azar en cada llamada (sin lógica de "no repetir",
por diseño: mantenerlo simple).

## Reglas al agregar/editar frases

- El bloque de error técnico (`err`) nunca se toca ni se resume — siempre va
  completo. El humor es cosmético, la información de debug no.
- Evitar que una frase incluya texto que los tests verifiquen por substring
  (ver `ServerMonitor.test.ts`, que matchea `/arriba/i` y `/no respondió/i`
  sobre los mensajes de `notify`, y `server.test.ts`, que matchea `"guardado"`,
  `"Ya existe"`, `"/init"`, `"corriendo"`, `"apagada"`) — esas palabras clave
  viven en el `message` que se le pasa a `gordoOk`/`gordoFail`, no en los
  prefijos, así que agregar frases a las listas es seguro por diseño.
