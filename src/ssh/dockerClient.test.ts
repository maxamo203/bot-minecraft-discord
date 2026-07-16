import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeExecResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

let nextExecResult: FakeExecResult = { exitCode: 0, stdout: "", stderr: "" };
let lastExecutedCommand: string | undefined;

class FakeStream extends EventEmitter {
  stderr = new EventEmitter();
}

class FakeClient extends EventEmitter {
  connect() {
    // Simula el handshake asíncrono de ssh2 emitiendo "ready" en el próximo tick.
    queueMicrotask(() => this.emit("ready"));
    return this;
  }

  exec(command: string, callback: (err: Error | undefined, stream: FakeStream) => void) {
    lastExecutedCommand = command;
    const stream = new FakeStream();
    callback(undefined, stream);

    queueMicrotask(() => {
      if (nextExecResult.stdout) stream.emit("data", Buffer.from(nextExecResult.stdout));
      if (nextExecResult.stderr) stream.stderr.emit("data", Buffer.from(nextExecResult.stderr));
      stream.emit("close", nextExecResult.exitCode);
    });
  }

  end() {
    // no-op
  }
}

vi.mock("ssh2", () => ({
  Client: FakeClient,
}));

const { execCommand, runContainer, listContainers, listRunningContainers, removeContainer, extractNamedVolume, testSshConnection } =
  await import("./dockerClient.js");

const credentials = { host: "1.2.3.4", port: 22, username: "root", password: "pw" };

describe("dockerClient", () => {
  beforeEach(() => {
    nextExecResult = { exitCode: 0, stdout: "", stderr: "" };
    lastExecutedCommand = undefined;
  });

  it("arma el comando docker run correcto a partir de dockerRunArgs", async () => {
    nextExecResult = { exitCode: 0, stdout: "container-id\n" };

    await runContainer(credentials, "-d --name mc -p 25565:25565 itzg/minecraft-server");

    expect(lastExecutedCommand).toBe("docker run -d --name mc -p 25565:25565 itzg/minecraft-server");
  });

  it("propaga un exit code distinto de 0 como error", async () => {
    nextExecResult = { exitCode: 1, stderr: "no space left on device" };

    await expect(runContainer(credentials, "-d --name mc itzg/minecraft-server")).rejects.toThrow(
      /no space left on device/
    );
  });

  it("listContainers separa la salida en líneas y descarta vacías", async () => {
    nextExecResult = { exitCode: 0, stdout: "mc-survival\nmc-creative\n\n" };

    const names = await listContainers(credentials);

    expect(names).toEqual(["mc-survival", "mc-creative"]);
  });

  it("testSshConnection no lanza si el comando de prueba sale con exit 0", async () => {
    nextExecResult = { exitCode: 0, stdout: "ok\n" };
    await expect(testSshConnection(credentials)).resolves.toBeUndefined();
  });

  it("execCommand devuelve stdout, stderr y exitCode", async () => {
    nextExecResult = { exitCode: 0, stdout: "hola", stderr: "" };

    const result = await execCommand(credentials, "echo hola");

    expect(result).toEqual({ stdout: "hola", stderr: "", exitCode: 0 });
  });

  it("listRunningContainers usa 'docker ps' sin -a y separa líneas", async () => {
    nextExecResult = { exitCode: 0, stdout: "mc-survival\n\n" };

    const names = await listRunningContainers(credentials);

    expect(lastExecutedCommand).toBe("docker ps --format '{{.Names}}'");
    expect(names).toEqual(["mc-survival"]);
  });

  it("removeContainer corre 'docker rm -f' con el nombre del contenedor", async () => {
    nextExecResult = { exitCode: 0, stdout: "mc-survival\n" };

    await removeContainer(credentials, "mc-survival");

    expect(lastExecutedCommand).toBe("docker rm -f mc-survival");
  });

  it("removeContainer también borra el volumen cuando se pasa volumeName", async () => {
    nextExecResult = { exitCode: 0, stdout: "" };

    await removeContainer(credentials, "mc-survival", "minecraft-data");

    expect(lastExecutedCommand).toBe("docker volume rm minecraft-data");
  });

  it("removeContainer propaga el error si docker rm falla", async () => {
    nextExecResult = { exitCode: 1, stderr: "no such container" };

    await expect(removeContainer(credentials, "mc-survival")).rejects.toThrow(/no such container/);
  });

  describe("extractNamedVolume", () => {
    it("extrae el nombre de un volumen con -v", () => {
      expect(extractNamedVolume("-d -v minecraft-data:/data itzg/minecraft-server")).toBe("minecraft-data");
    });

    it("extrae el nombre de un volumen con --volume", () => {
      expect(extractNamedVolume("-d --volume minecraft-data:/data itzg/minecraft-server")).toBe("minecraft-data");
    });

    it("ignora bind mounts a rutas absolutas del host", () => {
      expect(extractNamedVolume("-d -v /home/user/mc:/data itzg/minecraft-server")).toBeUndefined();
    });

    it("devuelve undefined si no hay ningún -v", () => {
      expect(extractNamedVolume("-d --name mc itzg/minecraft-server")).toBeUndefined();
    });
  });
});
