export interface PowerState {
  running: boolean;
  transitioning: boolean;
}

export interface CloudProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  getPowerState(): Promise<PowerState>;
}

export interface AzureCredentials {
  type: "azure";
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
  resourceGroup: string;
  vmName: string;
}

export type CloudCredentials = AzureCredentials;
