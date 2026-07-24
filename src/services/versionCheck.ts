import { Platform } from 'react-native';
import { APP_VERSION } from '../config';
import { fetchHealth } from './api';

const LAST_PROMPTED_KEY = '@escalarml/last_prompted_version';

let storage: {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

if (Platform.OS === 'web') {
  storage = {
    getItem: async (key) => localStorage.getItem(key),
    setItem: async (key, value) => { localStorage.setItem(key, value); },
  };
} else {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  storage = AsyncStorage;
}

function parseSemver(v: string): number[] {
  return v.split('.').map((s) => {
    const n = parseInt(s, 10);
    return isNaN(n) ? 0 : n;
  });
}

export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseSemver(latest);
  const b = parseSemver(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

export async function getLastPromptedVersion(): Promise<string | null> {
  try {
    return await storage.getItem(LAST_PROMPTED_KEY);
  } catch {
    return null;
  }
}

export async function setLastPromptedVersion(version: string): Promise<void> {
  try {
    await storage.setItem(LAST_PROMPTED_KEY, version);
  } catch {}
}

export async function checkForUpdate(): Promise<{
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
}> {
  const currentVersion = APP_VERSION;
  try {
    const health = await fetchHealth();
    const latestVersion = health.version || '';
    if (!latestVersion) {
      return { hasUpdate: false, latestVersion, currentVersion };
    }
    const hasUpdate = isNewerVersion(latestVersion, currentVersion);
    return { hasUpdate, latestVersion, currentVersion };
  } catch {
    return { hasUpdate: false, latestVersion: '', currentVersion };
  }
}
