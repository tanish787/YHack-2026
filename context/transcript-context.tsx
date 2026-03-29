import type { PracticeContextId } from "@/constants/speech-coach";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getTopContentWords,
  type WordFrequency,
} from "@/services/word-analysis";

const STORAGE_KEY = "@speech_coach/transcript_segments_v1";
const ARCHIVE_STORAGE_KEY = "@speech_coach/transcript_archive_v1";

export type TranscriptSource = "listening" | "background" | "analytics";

export type TranscriptSegment = {
  id: string;
  text: string;
  source: TranscriptSource;
  practiceContextId?: PracticeContextId;
  createdAt: number;
};

export type TranscriptArchiveReason = "live" | "background";

export type TranscriptArchiveSession = {
  id: string;
  reason: TranscriptArchiveReason;
  practiceContextId?: PracticeContextId;
  archivedAt: number;
  segments: TranscriptSegment[];
  transcript: string;
};

type TranscriptContextValue = {
  segments: TranscriptSegment[];
  archivedSessions: TranscriptArchiveSession[];
  ready: boolean;
  /** All saved speech joined for analysis / LLM. */
  fullTranscript: string;
  /** Most frequent non–stop words across the full transcript. */
  topContentWords: WordFrequency[];
  appendSegment: (
    text: string,
    source: TranscriptSource,
    options?: { practiceContextId?: PracticeContextId },
  ) => Promise<void>;
  startNewRecordingSession: (
    reason: TranscriptArchiveReason,
    options?: {
      practiceContextId?: PracticeContextId;
      pendingSegment?: {
        text: string;
        source: TranscriptSource;
        practiceContextId?: PracticeContextId;
      };
    },
  ) => Promise<void>;
  removeArchivedSession: (sessionId: string) => Promise<void>;
  clearArchivedSessions: () => Promise<void>;
  clearTranscript: () => Promise<void>;
};

const TranscriptContext = createContext<TranscriptContextValue | null>(null);

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function TranscriptProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [archivedSessions, setArchivedSessions] = useState<
    TranscriptArchiveSession[]
  >([]);
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
                  typeof s.id === "string" &&
                  typeof s.text === "string" &&
                  (s.source === "listening" ||
                    s.source === "background" ||
                    s.source === "analytics") &&
                  (s.practiceContextId === undefined ||
                    s.practiceContextId === "presentation" ||
                    s.practiceContextId === "interview" ||
                    s.practiceContextId === "meeting" ||
                    s.practiceContextId === "conversation") &&
                  typeof s.createdAt === "number",
              ),
            );
          } else {
            setSegments([]);
          }
        }

        try {
          const archivedRaw = await AsyncStorage.getItem(ARCHIVE_STORAGE_KEY);
          if (!cancelled) {
            if (!archivedRaw) {
              setArchivedSessions([]);
            } else {
              const archivedParsed = JSON.parse(
                archivedRaw,
              ) as TranscriptArchiveSession[];
              if (Array.isArray(archivedParsed)) {
                setArchivedSessions(
                  archivedParsed.filter(
                    (s) =>
                      s &&
                      typeof s.id === "string" &&
                      (s.reason === "live" || s.reason === "background") &&
                      (s.practiceContextId === undefined ||
                        s.practiceContextId === "presentation" ||
                        s.practiceContextId === "interview" ||
                        s.practiceContextId === "meeting" ||
                        s.practiceContextId === "conversation") &&
                      typeof s.archivedAt === "number" &&
                      Array.isArray(s.segments) &&
                      typeof s.transcript === "string",
                  ),
                );
              } else {
                setArchivedSessions([]);
              }
            }
          }
        } catch {
          if (!cancelled) setArchivedSessions([]);
        }
      } catch {
        setSegments([]);
        setArchivedSessions([]);
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

  useEffect(() => {
    if (!ready) return;
    void AsyncStorage.setItem(
      ARCHIVE_STORAGE_KEY,
      JSON.stringify(archivedSessions),
    );
  }, [archivedSessions, ready]);

  const appendSegment = useCallback(
    async (
      text: string,
      source: TranscriptSource,
      options?: { practiceContextId?: PracticeContextId },
    ) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setSegments((prev) => {
        const last = prev[prev.length - 1];
        if (
          last &&
          last.text.trim() === trimmed &&
          last.source === source &&
          last.practiceContextId === options?.practiceContextId
        ) {
          return prev;
        }
        const segment: TranscriptSegment = {
          id: makeId(),
          text: trimmed,
          source,
          practiceContextId: options?.practiceContextId,
          createdAt: Date.now(),
        };
        return [...prev, segment];
      });
    },
    [],
  );

  const startNewRecordingSession = useCallback(
    async (
      reason: TranscriptArchiveReason,
      options?: {
        practiceContextId?: PracticeContextId;
        pendingSegment?: {
          text: string;
          source: TranscriptSource;
          practiceContextId?: PracticeContextId;
        };
      },
    ) => {
      const pending = options?.pendingSegment;
      const pendingText = pending?.text.trim();

      const snapshot =
        pending && pendingText
          ? [
              ...segments,
              {
                id: makeId(),
                text: pendingText,
                source: pending.source,
                practiceContextId: pending.practiceContextId,
                createdAt: Date.now(),
              },
            ]
          : segments;

      if (snapshot.length > 0) {
        const inferredPracticeContextId = [...snapshot]
          .reverse()
          .find((segment) => segment.source === "listening")?.practiceContextId;
        const transcript = snapshot
          .map((s) => s.text)
          .join("\n\n")
          .trim();
        const archived: TranscriptArchiveSession = {
          id: makeId(),
          reason,
          practiceContextId:
            reason === "live"
              ? (options?.practiceContextId ?? inferredPracticeContextId)
              : undefined,
          archivedAt: Date.now(),
          segments: snapshot,
          transcript,
        };

        setArchivedSessions((prev) => [archived, ...prev].slice(0, 50));
      }

      setSegments([]);
    },
    [segments],
  );

  const removeArchivedSession = useCallback(async (sessionId: string) => {
    setArchivedSessions((prev) =>
      prev.filter((session) => session.id !== sessionId),
    );
  }, []);

  const clearArchivedSessions = useCallback(async () => {
    setArchivedSessions([]);
  }, []);

  const clearTranscript = useCallback(async () => {
    setSegments([]);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    } catch (e) {
      console.warn("clearTranscript: failed to persist", e);
      throw e;
    }
  }, []);

  const fullTranscript = useMemo(
    () => segments.map((s) => s.text).join("\n\n"),
    [segments],
  );

  const topContentWords = useMemo(
    () => getTopContentWords(fullTranscript, { limit: 10 }),
    [fullTranscript],
  );

  const value = useMemo<TranscriptContextValue>(
    () => ({
      segments,
      archivedSessions,
      ready,
      fullTranscript,
      topContentWords,
      appendSegment,
      startNewRecordingSession,
      removeArchivedSession,
      clearArchivedSessions,
      clearTranscript,
    }),
    [
      segments,
      archivedSessions,
      ready,
      fullTranscript,
      topContentWords,
      appendSegment,
      startNewRecordingSession,
      removeArchivedSession,
      clearArchivedSessions,
      clearTranscript,
    ],
  );

  return (
    <TranscriptContext.Provider value={value}>
      {children}
    </TranscriptContext.Provider>
  );
}

export function useTranscript() {
  const ctx = useContext(TranscriptContext);
  if (!ctx) {
    throw new Error("useTranscript must be used within TranscriptProvider");
  }
  return ctx;
}
