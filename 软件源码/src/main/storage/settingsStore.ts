import { randomBytes } from 'node:crypto';
import { safeStorage } from 'electron';
import Store from 'electron-store';
import type { AppSettings } from '../../shared/types.js';
import type { SettingsStore } from '../orchestrator/orchestrator.js';

interface PersistedSettingsSchema {
  settings?: AppSettings;
}

interface SettingsEncryptionKeySchema {
  settingsEncryptionKey?: string;
}

export interface EncryptionKeyStore {
  get(key: 'settingsEncryptionKey'): string | undefined;
  set(key: 'settingsEncryptionKey', value: string): void;
}

export interface SafeStorageAdapter {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

const SETTINGS_ENCRYPTION_KEY_FIELD = 'settingsEncryptionKey';

export class ElectronSettingsStore implements SettingsStore {
  private readonly keyStore = new Store<SettingsEncryptionKeySchema>({
    name: 'registration-settings-key',
  });

  private readonly store = new Store<PersistedSettingsSchema>({
    name: 'registration-settings',
    encryptionKey: resolveSettingsEncryptionKey(this.keyStore),
  });

  load(): AppSettings | undefined {
    const settings = this.store.get('settings');
    return settings ? structuredClone(settings) : undefined;
  }

  save(settings: AppSettings): void {
    this.store.set('settings', structuredClone(settings));
  }
}

export function resolveSettingsEncryptionKey(
  keyStore: EncryptionKeyStore,
  safeStorageImpl: SafeStorageAdapter = safeStorage,
  generateKey: () => string = () => randomBytes(32).toString('base64url'),
): string {
  if (!safeStorageImpl.isEncryptionAvailable()) {
    throw new Error('Electron safeStorage encryption is unavailable; refusing to persist registration settings');
  }

  const encryptedKey = keyStore.get(SETTINGS_ENCRYPTION_KEY_FIELD);
  if (encryptedKey) {
    return safeStorageImpl.decryptString(Buffer.from(encryptedKey, 'base64'));
  }

  const key = generateKey();
  keyStore.set(SETTINGS_ENCRYPTION_KEY_FIELD, safeStorageImpl.encryptString(key).toString('base64'));
  return key;
}
