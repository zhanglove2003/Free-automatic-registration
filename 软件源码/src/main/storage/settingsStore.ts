import Store from 'electron-store';
import type { AppSettings } from '../../shared/types.js';
import type { SettingsStore } from '../orchestrator/orchestrator.js';

interface PersistedSettingsSchema {
  settings?: AppSettings;
}

export class ElectronSettingsStore implements SettingsStore {
  private readonly store = new Store<PersistedSettingsSchema>({
    name: 'registration-settings',
  });

  load(): AppSettings | undefined {
    const settings = this.store.get('settings');
    return settings ? structuredClone(settings) : undefined;
  }

  save(settings: AppSettings): void {
    this.store.set('settings', structuredClone(settings));
  }
}
