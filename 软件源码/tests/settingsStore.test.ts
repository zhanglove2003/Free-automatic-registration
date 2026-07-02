import { describe, expect, it, vi } from 'vitest';
import { resolveSettingsEncryptionKey, type EncryptionKeyStore, type SafeStorageAdapter } from '../src/main/storage/settingsStore.js';

class MemoryKeyStore implements EncryptionKeyStore {
  values = new Map<string, string>();

  get(key: string): string | undefined {
    return this.values.get(key);
  }

  set(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function fakeSafeStorage(): SafeStorageAdapter {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`, 'utf8'),
    decryptString: (value: Buffer) => value.toString('utf8').replace(/^encrypted:/, ''),
  };
}

describe('ElectronSettingsStore encryption key handling', () => {
  it('stores a generated settings encryption key through safeStorage instead of plaintext', () => {
    const keyStore = new MemoryKeyStore();

    const key = resolveSettingsEncryptionKey(keyStore, fakeSafeStorage(), () => 'plain-secret-key');

    expect(key).toBe('plain-secret-key');
    expect(keyStore.values.get('settingsEncryptionKey')).toBe(Buffer.from('encrypted:plain-secret-key', 'utf8').toString('base64'));
    expect(keyStore.values.get('settingsEncryptionKey')).not.toContain('plain-secret-key');
  });

  it('reuses the previously protected settings encryption key', () => {
    const keyStore = new MemoryKeyStore();
    const generateKey = vi.fn(() => 'new-key');
    keyStore.set('settingsEncryptionKey', Buffer.from('encrypted:stored-key', 'utf8').toString('base64'));

    const key = resolveSettingsEncryptionKey(keyStore, fakeSafeStorage(), generateKey);

    expect(key).toBe('stored-key');
    expect(generateKey).not.toHaveBeenCalled();
  });
});
