import { Platform } from 'react-native';
import { League, Lineup } from '../types';

const LINEUPS_KEY = '@escalarml/lineups';
const LEAGUES_KEY = '@escalarml/leagues';

let storage: {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
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

export async function getLineups(): Promise<Lineup[]> {
  const data = await storage.getItem(LINEUPS_KEY);
  return data ? JSON.parse(data) : [];
}

export async function saveLineup(lineup: Lineup): Promise<void> {
  const lineups = await getLineups();
  const idx = lineups.findIndex((l) => l.id === lineup.id);
  if (idx >= 0) {
    lineups[idx] = lineup;
  } else {
    lineups.unshift(lineup);
  }
  await storage.setItem(LINEUPS_KEY, JSON.stringify(lineups));
}

export async function deleteLineup(id: string): Promise<void> {
  const lineups = await getLineups();
  const filtered = lineups.filter((l) => l.id !== id);
  await storage.setItem(LINEUPS_KEY, JSON.stringify(filtered));
}

export async function getLineupsByRodada(rodada: number): Promise<Lineup[]> {
  const lineups = await getLineups();
  return lineups.filter((l) => l.rodada === rodada);
}

export async function getLeagues(): Promise<League[]> {
  const data = await storage.getItem(LEAGUES_KEY);
  return data ? JSON.parse(data) : [];
}

export async function saveLeague(league: League): Promise<void> {
  const leagues = await getLeagues();
  const idx = leagues.findIndex((l) => l.id === league.id);
  if (idx >= 0) {
    leagues[idx] = league;
  } else {
    leagues.unshift(league);
  }
  await storage.setItem(LEAGUES_KEY, JSON.stringify(leagues));
}

export async function deleteLeague(id: string): Promise<void> {
  const leagues = await getLeagues();
  const filtered = leagues.filter((l) => l.id !== id);
  await storage.setItem(LEAGUES_KEY, JSON.stringify(filtered));
}

// ── Export/Import ──

export interface BackupData {
  version: string;
  exported_at: string;
  lineups: Lineup[];
  leagues: League[];
}

export async function exportAllData(): Promise<BackupData> {
  const lineups = await getLineups();
  const leagues = await getLeagues();
  return {
    version: '1',
    exported_at: new Date().toISOString(),
    lineups,
    leagues,
  };
}

export async function importAllData(data: BackupData, merge = false): Promise<{ lineups: number; leagues: number }> {
  if (merge) {
    const existingLineups = await getLineups();
    const existingLeagues = await getLeagues();
    const existingLineupIds = new Set(existingLineups.map((l) => l.id));
    const existingLeagueIds = new Set(existingLeagues.map((l) => l.id));
    const newLineups = data.lineups.filter((l) => !existingLineupIds.has(l.id));
    const newLeagues = data.leagues.filter((l) => !existingLeagueIds.has(l.id));
    await storage.setItem(LINEUPS_KEY, JSON.stringify([...newLineups, ...existingLineups]));
    await storage.setItem(LEAGUES_KEY, JSON.stringify([...newLeagues, ...existingLeagues]));
    return { lineups: newLineups.length, leagues: newLeagues.length };
  } else {
    await storage.setItem(LINEUPS_KEY, JSON.stringify(data.lineups));
    await storage.setItem(LEAGUES_KEY, JSON.stringify(data.leagues));
    return { lineups: data.lineups.length, leagues: data.leagues.length };
  }
}
