import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getTopContentWords, type WordFrequency } from '@/services/word-analysis';

const STORAGE_KEY = '@speech_coach/transcript_segments_v1';

export type TranscriptSource = 'listening' | 'analytics';

export type TranscriptSegment = {
  id: string;
  text: string;
  source: TranscriptSource;
  createdAt: number;
};

type TranscriptContextValue = {
  segments: TranscriptSegment[];
  ready: boolean;
  /** All saved speech joined for analysis / LLM. */
  fullTranscript: string;
  /** Most frequent non–stop words across the full transcript. */
  topContentWords: WordFrequency[];
  appendSegment: (text: string, source: TranscriptSource) => Promise<void>;
  clearTranscript: () => Promise<void>;
};

const TranscriptContext = createContext<TranscriptContextValue | null>(null);

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function TranscriptProvider({ children }: { children: React.ReactNode }) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (!raw) {
          setSegments([]);
        } else {
          const parsed = JSON.parse(raw) as TranscriptSegment[];
          if (Array.isArray(parsed)) {
            setSegments(
              parsed.filter(
                (s) =>
                  s &&
                  typeof s.id === 'string' &&
                  typeof s.text === 'string' &&
                  typeof s.createdAt === 'number',
              ),
            );
          } else {
            setSegments([]);
          }
        }
      } catch {
        setSegments([]);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Single writer to disk: avoids races where append’s setItem runs after clear. */
  useEffect(() => {
    if (!ready) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(segments));
  }, [segments, ready]);

  const appendSegment = useCallback(async (text: string, source: TranscriptSource) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setSegments((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.text.trim() === trimmed && last.source === source) {
        return prev;
      }
      const segment: TranscriptSegment = {
        id: makeId(),
        text: trimmed,
        source,
        createdAt: Date.now(),
      };
      return [...prev, segment];
    });
  }, []);

  const clearTranscript = useCallback(async () => {
    setSegments([]);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    } catch (e) {
      console.warn('clearTranscript: failed to persist', e);
      throw e;
    }
  }, []);

  const fullTranscript = useMemo(
    () => segments.map((s) => s.text).join('\n\n'),
    [segments],
  );

  const topContentWords = useMemo(
    () => getTopContentWords(fullTranscript, { limit: 30 }),
    [fullTranscript],
  );

  const value = useMemo<TranscriptContextValue>(
    () => ({
      segments,
      ready,
      fullTranscript,
      topContentWords,
      appendSegment,
      clearTranscript,
    }),
    [segments, ready, fullTranscript, topContentWords, appendSegment, clearTranscript],
  );

  return <TranscriptContext.Provider value={value}>{children}</TranscriptContext.Provider>;
}

export function useTranscript() {
  const ctx = useContext(TranscriptContext);
  if (!ctx) {
    throw new Error('useTranscript must be used within TranscriptProvider');
  }
  return ctx;
}
