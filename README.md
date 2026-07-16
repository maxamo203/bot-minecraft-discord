# mc-vm-bot

Bot de Discord genérico para controlar el encendido/apagado de una VM (Azure)
que hostea servidores de Minecraft en Docker. Enciende la VM bajo demanda,
espera a que el servidor arranque, y la apaga automáticamente cuando no hay
jugadores conectados.

La configuración es por servidor de Discord (guild): cada guild guarda sus
propias credenciales y sus propios servidores de Minecraft.

## Requisitos

- Node.js 20+
- pnpm
- Una base MongoDB (local o Atlas)
- Una VM en Azure con Docker instalado, accesible por SSH
- Un Service Principal de Azure con permisos para start/deallocate sobre la VM
  (rol "Virtual Machine Contributor" alcanza)

## Setup

```bash
pnpm install
cp .env.example .env
```

Completar `.env`:

- `DISCORD_TOKEN` / `DISCORD_CLIENT_ID`: desde el [Discord Developer Portal](https://discord.com/developers/applications).
- `DISCORD_DEV_GUILD_ID` (opcional): guild de prueba para registrar comandos al instante durante desarrollo.
- `MONGO_URI`: connection string de Mongo.
- `ENCRYPTION_KEY`: clave de 32 bytes en hex para cifrar credenciales guardadas. Generarla con:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

Registrar los slash commands y levantar el bot:

```bash
pnpm deploy-commands
pnpm dev
```

## Permisos

Todos los comandos están disponibles para cualquier miembro del servidor de
Discord (no requieren rol de Administrador) — el modelo de seguridad asume que
el bot solo se invita a servidores/canales de confianza, ya que quien tenga
acceso puede leer/gestionar las credenciales de la VM.

## Uso

1. **`/init`**: guarda las credenciales de Azure (tenant, service
   principal, subscription, resource group, nombre de VM) y de SSH (host, usuario,
   password o clave privada). Se validan antes de guardarse y quedan cifradas en Mongo.
2. **`/server create`**: crea el contenedor Docker en la VM (requiere que esté
   encendida) y lo guarda en el bot. `docker_run_args` es el forward literal de
   los argumentos de `docker run` que crean/levantan el contenedor (imagen,
   puertos, volúmenes, variables de entorno, etc.), por ejemplo:
   ```
   -d --name mc-survival -p 25565:25565 -e EULA=TRUE itzg/minecraft-server
   ```
3. **`/server list`**: lista los servidores guardados con su dirección
   `host:puerto` lista para copiar y pegar en el cliente de Minecraft.
   **`/server default`**: marca uno como predeterminado.
   **`/server remove`**: borra el contenedor Docker real y el registro del
   bot. Si el contenedor está corriendo, hay que pararlo primero con `/stop`.
   Con `delete_volume:true` borra también el volumen de datos (el mundo) —
   irreversible.
4. **`/start [name]`**: enciende la VM, levanta el contenedor y empieza a monitorear.
   Sin `name`, usa el servidor predeterminado.
5. **`/status`**: estado de la VM y del servidor de Minecraft (jugadores conectados).
6. **`/stop`**: apaga la VM manualmente.
7. **`/config`**: ajusta `interval_minutes` (frecuencia de chequeo de jugadores),
   `empty_checks_threshold` (chequeos vacíos consecutivos antes de apagar) y
   `boot_timeout_minutes` (tiempo máximo de espera a que el server arranque).
8. **`/helpgordo`**: muestra un resumen de todos los comandos disponibles.

### Auto-apagado

Al detectar que el servidor de Minecraft respondió (`/start`), el bot espera
`interval_minutes` y recién ahí hace el primer chequeo de jugadores. Si un
chequeo (o `empty_checks_threshold` chequeos consecutivos, si se configuró
mayor a 1) da 0 jugadores, apaga la VM automáticamente y avisa en el canal
donde se ejecutó `/start`.

## Fuera de alcance

Agregado de mods y subida de archivos al servidor — se gestionan por fuera del bot.

## Testing

```bash
pnpm test
```

Corre toda la suite (unit + integración) sin necesitar credenciales reales de
Azure/SSH ni un Mongo real: Azure, SSH, el ping de Minecraft y discord.js están
mockeados; Mongo usa `mongodb-memory-server` embebido. Apto para CI.

## Build / producción

```bash
pnpm build
pnpm start
```
# bot-minecraft-discord
