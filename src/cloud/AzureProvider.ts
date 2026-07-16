import { ClientSecretCredential } from "@azure/identity";
import { ComputeManagementClient } from "@azure/arm-compute";
import type { AzureCredentials, CloudProvider, PowerState } from "./CloudProvider.js";

const RUNNING_CODES = new Set(["PowerState/running"]);
const TRANSITIONING_CODES = new Set([
  "PowerState/starting",
  "PowerState/stopping",
  "PowerState/deallocating",
]);

export class AzureProvider implements CloudProvider {
  private readonly client: ComputeManagementClient;
  private readonly resourceGroup: string;
  private readonly vmName: string;

  constructor(credentials: AzureCredentials, clientOverride?: ComputeManagementClient) {
    this.resourceGroup = credentials.resourceGroup;
    this.vmName = credentials.vmName;

    this.client =
      clientOverride ??
      new ComputeManagementClient(
        new ClientSecretCredential(credentials.tenantId, credentials.clientId, credentials.clientSecret),
        credentials.subscriptionId
      );
  }

  async start(): Promise<void> {
    await this.client.virtualMachines.beginStartAndWait(this.resourceGroup, this.vmName);
  }

  async stop(): Promise<void> {
    // deallocate (no solo power-off) para dejar de facturar el cómputo de la VM.
    await this.client.virtualMachines.beginDeallocateAndWait(this.resourceGroup, this.vmName);
  }

  async getPowerState(): Promise<PowerState> {
    const instanceView = await this.client.virtualMachines.instanceView(this.resourceGroup, this.vmName);
    const statuses = instanceView.statuses ?? [];
    const powerCode = statuses.find((s) => s.code?.startsWith("PowerState/"))?.code ?? "";

    return {
      running: RUNNING_CODES.has(powerCode),
      transitioning: TRANSITIONING_CODES.has(powerCode),
    };
  }
}
