import type { CloudCredentials, CloudProvider } from "./CloudProvider.js";
import { AzureProvider } from "./AzureProvider.js";

export function createCloudProvider(credentials: CloudCredentials): CloudProvider {
  switch (credentials.type) {
    case "azure":
      return new AzureProvider(credentials);
    default: {
      const unknownType: string = (credentials as { type: string }).type;
      throw new Error(`Proveedor cloud desconocido: "${unknownType}"`);
    }
  }
}
