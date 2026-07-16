import { describe, expect, it } from "vitest";
import { createCloudProvider } from "./factory.js";
import { AzureProvider } from "./AzureProvider.js";
import type { CloudCredentials } from "./CloudProvider.js";

const azureCreds: CloudCredentials = {
  type: "azure",
  tenantId: "tenant",
  clientId: "client",
  clientSecret: "secret",
  subscriptionId: "sub",
  resourceGroup: "rg",
  vmName: "vm",
};

describe("createCloudProvider", () => {
  it("devuelve un AzureProvider para type 'azure'", () => {
    const provider = createCloudProvider(azureCreds);
    expect(provider).toBeInstanceOf(AzureProvider);
  });

  it("lanza un error claro para un type desconocido", () => {
    const bogus = { ...azureCreds, type: "aws" } as unknown as CloudCredentials;
    expect(() => createCloudProvider(bogus)).toThrow(/desconocido/i);
  });
});
