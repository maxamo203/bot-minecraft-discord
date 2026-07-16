import { Client, type ConnectConfig } from "ssh2";

export interface SshCredentials {
  host: string;
  port: number;
  username: string;
  privateKey?: string;
  password?: string;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function toConnectConfig(credentials: SshCredentials): ConnectConfig {
  return {
    host: credentials.host,
    port: credentials.port,
    username: credentials.username,
    privateKey: credentials.privateKey,
    password: credentials.password,
    readyTimeout: 15000,
  };
}

/** Ejecuta un único comando remoto sobre una conexión SSH ya conectada. */
function execOnConnection(conn: Client, command: string): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      let stdout = "";
      let stderr = "";

      stream
        .on("close", (exitCode: number) => {
          resolve({ stdout, stderr, exitCode: exitCode ?? 0 });
        })
        .on("data", (data: Buffer) => {
          stdout += data.toString("utf8");
        })
        .stderr.on("data", (data: Buffer) => {
          stderr += data.toString("utf8");
        });
    });
  });
}

/** Abre una conexión SSH, ejecuta un único comando y la cierra. */
export async function execCommand(credentials: SshCredentials, command: string): Promise<ExecResult> {
  const conn = new Client();

  return new Promise((resolve, reject) => {
    conn
      .on("ready", () => {
        execOnConnection(conn, command)
          .then((result) => {
            conn.end();
            resolve(result);
          })
          .catch((err) => {
            conn.end();
            reject(err);
          });
      })
      .on("error", (err) => reject(err))
      .connect(toConnectConfig(credentials));
  });
}

/** Prueba la conexión SSH ejecutando un comando trivial. Lanza si falla. */
export async function testSshConnection(credentials: SshCredentials): Promise<void> {
  const result = await execCommand(credentials, "echo ok");
  if (result.exitCode !== 0) {
    throw new Error(`La conexión SSH de prueba falló (exit code ${result.exitCode}): ${result.stderr}`);
  }
}

/** Corre `docker run` (o el comando docker completo) que crea/levanta un contenedor de Minecraft. */
export async function runContainer(credentials: SshCredentials, dockerRunArgs: string): Promise<ExecResult> {
  const command = `docker run ${dockerRunArgs}`;
  const result = await execCommand(credentials, command);
  if (result.exitCode !== 0) {
    throw new Error(`docker run falló (exit code ${result.exitCode}): ${result.stderr || result.stdout}`);
  }
  return result;
}

/** Arranca un contenedor ya existente (creado previamente). */
export async function startContainer(credentials: SshCredentials, containerName: string): Promise<ExecResult> {
  const result = await execCommand(credentials, `docker start ${containerName}`);
  if (result.exitCode !== 0) {
    throw new Error(`docker start falló (exit code ${result.exitCode}): ${result.stderr || result.stdout}`);
  }
  return result;
}

/** Detiene un contenedor por nombre. */
export async function stopContainer(credentials: SshCredentials, containerName: string): Promise<ExecResult> {
  const result = await execCommand(credentials, `docker stop ${containerName}`);
  if (result.exitCode !== 0) {
    throw new Error(`docker stop falló (exit code ${result.exitCode}): ${result.stderr || result.stdout}`);
  }
  return result;
}

/**
 * Extrae el nombre del primer volumen con nombre (`-v nombre:/ruta` o `--volume nombre:/ruta`)
 * de un string de argumentos de `docker run`. Ignora bind mounts a rutas del host (que
 * empiezan con `/` o `.`), ya que esos no son volúmenes de Docker y no se pueden "rm".
 * Devuelve `undefined` si no encuentra ninguno.
 */
export function extractNamedVolume(dockerRunArgs: string): string | undefined {
  const match = dockerRunArgs.match(/(?:^|\s)(?:-v|--volume)[= ]([^\s:]+):/);
  if (!match) return undefined;
  const candidate = match[1];
  if (candidate.startsWith("/") || candidate.startsWith(".")) return undefined;
  return candidate;
}

/** Lista los contenedores existentes (todos, incluidos detenidos). */
export async function listContainers(credentials: SshCredentials): Promise<string[]> {
  const result = await execCommand(credentials, "docker ps -a --format '{{.Names}}'");
  if (result.exitCode !== 0) {
    throw new Error(`docker ps falló (exit code ${result.exitCode}): ${result.stderr}`);
  }
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Lista solo los contenedores actualmente corriendo (`docker ps` sin `-a`). */
export async function listRunningContainers(credentials: SshCredentials): Promise<string[]> {
  const result = await execCommand(credentials, "docker ps --format '{{.Names}}'");
  if (result.exitCode !== 0) {
    throw new Error(`docker ps falló (exit code ${result.exitCode}): ${result.stderr}`);
  }
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Elimina un contenedor por nombre. Si `deleteVolume` no se pasa, el volumen asociado no se toca. */
export async function removeContainer(
  credentials: SshCredentials,
  containerName: string,
  volumeName?: string
): Promise<void> {
  const result = await execCommand(credentials, `docker rm -f ${containerName}`);
  if (result.exitCode !== 0) {
    throw new Error(`docker rm falló (exit code ${result.exitCode}): ${result.stderr || result.stdout}`);
  }

  if (volumeName) {
    const volumeResult = await execCommand(credentials, `docker volume rm ${volumeName}`);
    if (volumeResult.exitCode !== 0) {
      throw new Error(`docker volume rm falló (exit code ${volumeResult.exitCode}): ${volumeResult.stderr || volumeResult.stdout}`);
    }
  }
}
