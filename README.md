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

1. **`/gordo-init`**: guarda las credenciales de Azure (tenant, service
   principal, subscription, resource group, nombre de VM) y de SSH (host, usuario,
   password o clave privada). Se validan antes de guardarse y quedan cifradas en Mongo.
2. **`/gordo-server create`**: crea el contenedor Docker en la VM (requiere que esté
   encendida) y lo guarda en el bot. `docker_run_args` es el forward literal de
   los argumentos de `docker run` que crean/levantan el contenedor (imagen,
   puertos, volúmenes, variables de entorno, etc.), por ejemplo:
   ```
   -d --name mc-survival -p 25565:25565 -e EULA=TRUE itzg/minecraft-server
   ```
3. **`/gordo-server list`**: lista los servidores guardados con su dirección
   `host:puerto` lista para copiar y pegar en el cliente de Minecraft.
   **`/gordo-server default`**: marca uno como predeterminado.
   **`/gordo-server remove`**: borra el contenedor Docker real y el registro del
   bot. Si el contenedor está corriendo, hay que pararlo primero con `/gordo-stop`.
   Con `delete_volume:true` borra también el volumen de datos (el mundo) —
   irreversible.
4. **`/gordo-start [name]`**: enciende la VM, levanta el contenedor y empieza a monitorear.
   Sin `name`, usa el servidor predeterminado.
5. **`/gordo-status`**: estado de la VM y del servidor de Minecraft (jugadores conectados).
6. **`/gordo-stop`**: apaga la VM manualmente.
7. **`/gordo-config`**: ajusta `interval_minutes` (frecuencia de chequeo de jugadores),
   `empty_checks_threshold` (chequeos vacíos consecutivos antes de apagar) y
   `boot_timeout_minutes` (tiempo máximo de espera a que el server arranque).
8. **`/gordo-help`**: muestra un resumen de todos los comandos disponibles.

### Auto-apagado

Al detectar que el servidor de Minecraft respondió (`/gordo-start`), el bot espera
`interval_minutes` y recién ahí hace el primer chequeo de jugadores. Si un
chequeo (o `empty_checks_threshold` chequeos consecutivos, si se configuró
mayor a 1) da 0 jugadores, apaga la VM automáticamente y avisa en el canal
donde se ejecutó `/gordo-start`.

## Fuera de alcance

Agregado de mods y subida de archivos al servidor — se gestionan por fuera del bot.

## El tono "gordo"

Las respuestas de los comandos tienen humor shitpost con la temática del bot
("Bot Minecraft Gordo"). Ver [src/utils/gordoMessages.md](src/utils/gordoMessages.md)
si querés agregar o entender cómo funcionan esas frases.

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

## Deploy a Azure (Container Instances)

El bot es un proceso long-running (mantiene una conexión persistente por
WebSocket a Discord), no un servicio HTTP — por eso se despliega como
contenedor en **Azure Container Instances (ACI)** en vez de un App Service
"tradicional": es la opción de Azure para correr un contenedor 24/7 sin
gestionar un servidor, y sale bastante más barata que un App Service Plan
dedicado para este caso de uso (facturación por vCPU/RAM-segundo en vez de un
plan fijo).

### Imagen Docker

```bash
docker build -t mc-vm-bot .
docker run --env-file .env mc-vm-bot
```

El `Dockerfile` es multi-stage: compila TypeScript en una etapa y deja en la
imagen final solo `dist/` + dependencias de producción.

### CI/CD (`.github/workflows/deploy.yml`)

En cada push a `main` (o manualmente desde la pestaña Actions):

1. **`test`**: build + `pnpm test` — si falla, no se despliega nada.
2. **`build-and-push`**: construye la imagen y la sube a GitHub Container
   Registry (`ghcr.io`), gratis para repos con Actions.
3. **`deploy-commands`**: corre `pnpm deploy-commands` contra Discord
   (registro global de slash commands en prod).
4. **`deploy-aci`**: crea/actualiza el container group en ACI con
   `az container create` (mismo nombre = reemplaza el existente; hay un
   corte breve en cada deploy, no rolling update).

Los tres jobs de deploy (`build-and-push`, `deploy-commands`, `deploy-aci`)
corren en paralelo tras `test`; `deploy-aci` espera a `build-and-push` porque
necesita la imagen ya publicada.

### Secrets a configurar en GitHub (Settings → Secrets and variables → Actions)

| Secret | Para qué |
|---|---|
| `DISCORD_TOKEN` | Login del bot y registro de comandos |
| `DISCORD_CLIENT_ID` | Registro de comandos |
| `MONGO_URI` | Conexión a Mongo en runtime |
| `ENCRYPTION_KEY` | Cifrado de credenciales en runtime |
| `AZURE_CREDENTIALS` | JSON de un Service Principal para que el Action pueda operar ACI (ver abajo) |
| `ACI_RESOURCE_GROUP` | Resource group donde vive (o se crea) el container group |
| `ACI_CONTAINER_GROUP` | Nombre del container group en ACI |

`AZURE_CREDENTIALS` es **distinto** del Service Principal que guardaste con
`/gordo-init` (ese es para que el *bot* controle la VM de Minecraft; este es para
que *GitHub Actions* controle ACI). Se genera así, con permisos acotados al
resource group del container:

```bash
az ad sp create-for-rbac \
  --name "mc-vm-bot-deploy" \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<ACI_RESOURCE_GROUP> \
  --sdk-auth
```

El JSON completo que imprime ese comando es el valor de `AZURE_CREDENTIALS`.

### Primer deploy manual (opcional)

Si preferís crear el container group una vez a mano antes de dejar que el
Action lo mantenga:

```bash
az container create \
  --resource-group <ACI_RESOURCE_GROUP> \
  --name <ACI_CONTAINER_GROUP> \
  --image ghcr.io/<owner>/<repo>:latest \
  --os-type Linux --cpu 1 --memory 1 \
  --restart-policy Always \
  --secure-environment-variables \
    DISCORD_TOKEN=... DISCORD_CLIENT_ID=... MONGO_URI=... ENCRYPTION_KEY=...
```
