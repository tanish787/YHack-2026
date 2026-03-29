import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SessionSpeechMetrics } from '@/services/speech-metrics';

const STORAGE_KEY = '@speech_coach/personal_bests_v1';

export type PersonalBests = {
  /** Lowest filler rate (%) seen across analyzed samples. */
  bestFillerRatePercent: number | null;
  /** Highest pace-consistency score (0–100). */
  bestPaceConsistencyScore: number | null;
  /** Longest run of words without a filler. */
  longestCleanStreakWords: number;
  /** Highest type-token ratio seen (0–1). */
  bestTypeTokenRatio: number | null;
};

const DEFAULT_BESTS: PersonalBests = {
  bestFillerRatePercent: null,
  bestPaceConsistencyScore: null,
  longestCleanStreakWords: 0,
  bestTypeTokenRatio: null,
};

export async function loadPersonalBests(): Promise<PersonalBests> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BESTS };
    const p = JSON.parse(raw) as Partial<PersonalBests>;
    return {
      bestFillerRatePercent:
        typeof p.bestFillerRatePercent === 'number' ? p.bestFillerRatePercent : null,
      bestPaceConsistencyScore:
        typeof p.bestPaceConsistencyScore === 'number' ? p.bestPaceConsistencyScore : null,
      longestCleanStreakWords:
        typeof p.longestCleanStreakWords === 'number' ? p.longestCleanStreakWords : 0,
      bestTypeTokenRatio:
        typeof p.bestTypeTokenRatio === 'number' ? p.bestTypeTokenRatio : null,
    };
  } catch {
    return { ...DEFAULT_BESTS };
  }
}

export async function savePersonalBests(b: PersonalBests): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(b));
}

/** Clears persisted personal bests (e.g. when the user clears the saved transcript). */
export async function resetPersonalBests(): Promise<PersonalBests> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_BESTS };
}

/**
 * Merge session metrics into stored bests. Call after a successful analysis
 * (or any committed sample you want to count).
 */
export function mergePersonalBests(
  current: PersonalBests,
  session: SessionSpeechMetrics,
): PersonalBests {
  const { fillerRatePercent, paceConsistencyScore, longestCleanStreak, vocabulary } =
    session;
  const ttr = vocabulary.totalWords >= 8 ? vocabulary.typeTokenRatio : null;

  const bestFillerRatePercent =
    current.bestFillerRatePercent === null
      ? fillerRatePercent
      : Math.min(current.bestFillerRatePercent, fillerRatePercent);

  const bestPaceConsistencyScore =
    current.bestPaceConsistencyScore === null
      ? paceConsistencyScore
      : Math.max(current.bestPaceConsistencyScore, paceConsistencyScore);

  const longestCleanStreakWords = Math.max(
    current.longestCleanStreakWords,
    longestCleanStreak,
  );

  let bestTypeTokenRatio = current.bestTypeTokenRatio;
  if (ttr !== null) {
    bestTypeTokenRatio =
      bestTypeTokenRatio === null ? ttr : Math.max(bestTypeTokenRatio, ttr);
  }

  return {
    bestFillerRatePercent,
    bestPaceConsistencyScore,
    longestCleanStreakWords,
    bestTypeTokenRatio,
  };
}
