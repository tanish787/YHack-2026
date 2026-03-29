import { signInAnonymously } from 'firebase/auth';
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';

import type { CorrectionFocusId } from '@/constants/speech-coach';

import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from './client';

const DETAILS_MAX_LEN = 1200;

export type SpeechAnalyticsHistoryRecord = {
  id: string;
  createdAtMs: number;
  overallScore: number;
  details: string;
  fillerCount: number;
  vagueCount: number;
  suggestionsCount: number;
  vaguenessScore: number;
  correctionFocusId: CorrectionFocusId;
  fillerRatePercent: number;
  totalWordCount: number;
  /** Null when timing sample was too short / unreliable. */
  wordsPerMinute: number | null;
  repetitionRatePercent: number;
};

export type SaveSpeechAnalysisInput = {
  overallScore: number;
  details: string;
  fillers: string[];
  vagueLanguage: string[];
  suggestions: string[];
  vaguenessScore: number;
  correctionFocusId: CorrectionFocusId;
  fillerRatePercent: number;
  fillerItemCount: number;
  totalWordCount: number;
  wordsPerMinute: number | null;
  repetitionRatePercent: number;
};

function historyCollection(uid: string) {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error('Firestore is not initialized');
  }
  return collection(db, 'users', uid, 'analyticsHistory');
}

function timestampToMs(value: unknown): number {
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as Timestamp).toMillis === 'function'
  ) {
    return (value as Timestamp).toMillis();
  }
  return Date.now();
}

function asCorrectionFocusId(raw: unknown): CorrectionFocusId {
  const id = typeof raw === 'string' ? raw : '';
  if (
    id === 'fillers' ||
    id === 'pacing' ||
    id === 'hedging' ||
    id === 'repetition'
  ) {
    return id;
  }
  return 'fillers';
}

/**
 * Signs in anonymously if needed. Returns uid, or null if Firebase is not configured.
 */
export async function ensureAnonymousFirebaseUser(): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;

  const auth = getFirebaseAuth();
  if (!auth) return null;

  if (auth.currentUser) {
    return auth.currentUser.uid;
  }

  const credential = await signInAnonymously(auth);
  return credential.user.uid;
}

/**
 * Persists metrics for one "Analyze Speech" run (no raw transcript).
 */
export async function saveSpeechAnalysisHistory(
  input: SaveSpeechAnalysisInput,
): Promise<void> {
  if (!isFirebaseConfigured()) return;

  const uid = await ensureAnonymousFirebaseUser();
  if (!uid) return;

  const details = input.details.trim().slice(0, DETAILS_MAX_LEN);

  const payload: Record<string, unknown> = {
    overallScore: Math.round(Math.max(0, Math.min(100, input.overallScore))),
    details,
    fillerCount: input.fillerItemCount,
    vagueCount: input.vagueLanguage.length,
    suggestionsCount: input.suggestions.length,
    vaguenessScore: Math.round(
      Math.max(0, Math.min(100, input.vaguenessScore)),
    ),
    correctionFocusId: input.correctionFocusId,
    fillerRatePercent: input.fillerRatePercent,
    totalWordCount: input.totalWordCount,
    repetitionRatePercent: input.repetitionRatePercent,
    createdAt: serverTimestamp(),
  };

  if (input.wordsPerMinute != null) {
    payload.wordsPerMinute = input.wordsPerMinute;
  }

  await addDoc(historyCollection(uid), payload);
}

/**
 * Live-updates saved analysis rows for the current anonymous user (newest first).
 */
export function subscribeSpeechAnalysisHistory(
  onUpdate: (rows: SpeechAnalyticsHistoryRecord[]) => void,
  onError?: (err: Error) => void,
  maxRows = 80,
): () => void {
  if (!isFirebaseConfigured()) {
    onUpdate([]);
    return () => {};
  }

  let cancelled = false;
  let unsubscribe: (() => void) | null = null;

  void (async () => {
    try {
      const uid = await ensureAnonymousFirebaseUser();
      if (cancelled || !uid) {
        if (!cancelled) onUpdate([]);
        return;
      }

      const q = query(
        historyCollection(uid),
        orderBy('createdAt', 'desc'),
        limit(maxRows),
      );

      unsubscribe = onSnapshot(
        q,
        (snap) => {
          const rows: SpeechAnalyticsHistoryRecord[] = snap.docs.map((doc) => {
            const d = doc.data();
            const wpm = d.wordsPerMinute;
            return {
              id: doc.id,
              createdAtMs: timestampToMs(d.createdAt),
              overallScore:
                typeof d.overallScore === 'number' ? d.overallScore : 0,
              details: typeof d.details === 'string' ? d.details : '',
              fillerCount:
                typeof d.fillerCount === 'number' ? d.fillerCount : 0,
              vagueCount: typeof d.vagueCount === 'number' ? d.vagueCount : 0,
              suggestionsCount:
                typeof d.suggestionsCount === 'number' ? d.suggestionsCount : 0,
              vaguenessScore:
                typeof d.vaguenessScore === 'number' ? d.vaguenessScore : 0,
              correctionFocusId: asCorrectionFocusId(d.correctionFocusId),
              fillerRatePercent:
                typeof d.fillerRatePercent === 'number'
                  ? d.fillerRatePercent
                  : 0,
              totalWordCount:
                typeof d.totalWordCount === 'number' ? d.totalWordCount : 0,
              wordsPerMinute:
                typeof wpm === 'number' && Number.isFinite(wpm) ? wpm : null,
              repetitionRatePercent:
                typeof d.repetitionRatePercent === 'number'
                  ? d.repetitionRatePercent
                  : 0,
            };
          });
          onUpdate(rows);
        },
        (err) => {
          onError?.(err);
        },
      );
    } catch (e) {
      onError?.(e instanceof Error ? e : new Error(String(e)));
      onUpdate([]);
    }
  })();

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}
