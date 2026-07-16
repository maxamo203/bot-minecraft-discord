import { describe, expect, it, vi } from "vitest";
import { AzureProvider } from "./AzureProvider.js";
import type { AzureCredentials } from "./CloudProvider.js";
import type { ComputeManagementClient } from "@azure/arm-compute";

const credentials: AzureCredentials = {
  type: "azure",
  tenantId: "tenant",
  clientId: "client",
  clientSecret: "secret",
  subscriptionId: "sub",
  resourceGroup: "my-rg",
  vmName: "my-vm",
};

function makeFakeClient(overrides: Partial<ComputeManagementClient["virtualMachines"]> = {}) {
  return {
    virtualMachines: {
      beginStartAndWait: vi.fn().mockResolvedValue(undefined),
      beginDeallocateAndWait: vi.fn().mockResolvedValue(undefined),
      instanceView: vi.fn().mockResolvedValue({ statuses: [] }),
      ...overrides,
    },
  } as unknown as ComputeManagementClient;
}

describe("AzureProvider", () => {
  it("start() llama a beginStartAndWait con el resource group y vm correctos", async () => {
    const client = makeFakeClient();
    const provider = new AzureProvider(credentials, client);

    await provider.start();

    expect(client.virtualMachines.beginStartAndWait).toHaveBeenCalledWith("my-rg", "my-vm");
  });

  it("stop() llama a beginDeallocateAndWait (no solo power-off)", async () => {
    const client = makeFakeClient();
    const provider = new AzureProvider(credentials, client);

    await provider.stop();

    expect(client.virtualMachines.beginDeallocateAndWait).toHaveBeenCalledWith("my-rg", "my-vm");
  });

  it("getPowerState() traduce PowerState/running a { running: true, transitioning: false }", async () => {
    const client = makeFakeClient({
      instanceView: vi.fn().mockResolvedValue({ statuses: [{ code: "PowerState/running" }] }),
    });
    const provider = new AzureProvider(credentials, client);

    const state = await provider.getPowerState();

    expect(state).toEqual({ running: true, transitioning: false });
  });

  it("getPowerState() traduce PowerState/deallocated a { running: false, transitioning: false }", async () => {
    const client = makeFakeClient({
      instanceView: vi.fn().mockResolvedValue({ statuses: [{ code: "PowerState/deallocated" }] }),
    });
    const provider = new AzureProvider(credentials, client);

    const state = await provider.getPowerState();

    expect(state).toEqual({ running: false, transitioning: false });
  });

  it("getPowerState() traduce estados de transición (starting/stopping/deallocating)", async () => {
    for (const code of ["PowerState/starting", "PowerState/stopping", "PowerState/deallocating"]) {
      const client = makeFakeClient({
        instanceView: vi.fn().mockResolvedValue({ statuses: [{ code }] }),
      });
      const provider = new AzureProvider(credentials, client);

      const state = await provider.getPowerState();

      expect(state).toEqual({ running: false, transitioning: true });
    }
  });
});
