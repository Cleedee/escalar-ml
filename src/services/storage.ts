import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lineup } from '../types';

const LINEUPS_KEY = '@escalarml/lineups';

export async function getLineups(): Promise<Lineup[]> {
  const data = await AsyncStorage.getItem(LINEUPS_KEY);
  return data ? JSON.parse(data) : [];
}

export async function saveLineup(lineup: Lineup): Promise<void> {
  const lineups = await getLineups();
  lineups.unshift(lineup);
  await AsyncStorage.setItem(LINEUPS_KEY, JSON.stringify(lineups));
}

export async function deleteLineup(id: string): Promise<void> {
  const lineups = await getLineups();
  const filtered = lineups.filter((l) => l.id !== id);
  await AsyncStorage.setItem(LINEUPS_KEY, JSON.stringify(filtered));
}

export async function getLineupsByRodada(rodada: number): Promise<Lineup[]> {
  const lineups = await getLineups();
  return lineups.filter((l) => l.rodada === rodada);
}
