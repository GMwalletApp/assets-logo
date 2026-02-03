import { TrustWalletProvider } from './trustwallet.js';
import type { LogoProvider, ProviderFactory } from '../interfaces/provider.js';

class DefaultProviderFactory implements ProviderFactory {
  private providers: Map<string, LogoProvider> = new Map();

  constructor() {
    this.providers.set('trustwallet', new TrustWalletProvider());
  }

  create(name: string): LogoProvider {
    const provider = this.providers.get(name.toLowerCase());
    if (!provider) {
      throw new Error(`Unknown logo provider: ${name}. Available providers: ${this.listProviders().join(', ')}`);
    }
    return provider;
  }

  getDefaultProvider(): LogoProvider {
    const defaultName = process.env.LOGO_PROVIDER || 'trustwallet';
    return this.create(defaultName);
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

export const providerFactory = new DefaultProviderFactory();

export function getProvider(name?: string): LogoProvider {
  return name ? providerFactory.create(name) : providerFactory.getDefaultProvider();
}

export function listProviders(): string[] {
  return providerFactory.listProviders();
}
