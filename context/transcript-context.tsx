import type { PracticeContextId } from "@/constants/speech-coach";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/context/auth-context";
import {
  clearUserSessionHistory,
  saveUserSessionHistory,
  subscribeUserSessionHistory,
} from "@/services/firebase";
import {
  getTopContentWords,
  type WordFrequency,
} from "@/services/word-analysis";

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
  const { user, isAccountUser, loading } = useAuth();
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [archivedSessions, setArchivedSessions] = useState<
    TranscriptArchiveSession[]
  >([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!isAccountUser || !user) {
      setSegments([]);
      setArchivedSessions([]);
      setReady(true);
      return;
    }

    setReady(false);
    const unsubscribe = subscribeUserSessionHistory(
      user.uid,
      (sessions) => {
        setArchivedSessions(sessions);
        setReady(true);
      },
      (error) => {
        console.warn("Session history sync failed:", error);
        setArchivedSessions([]);
        setReady(true);
      },
    );

    return unsubscribe;
  }, [isAccountUser, loading, user]);

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

        setArchivedSessions((prev) => {
          const nextSessions = [archived, ...prev].slice(0, 50);
          if (isAccountUser && user) {
            void saveUserSessionHistory(user.uid, nextSessions).catch(
              (error) => {
                console.warn("Failed to persist session history:", error);
              },
            );
          }
          return nextSessions;
        });
      }

      setSegments([]);
    },
    [isAccountUser, segments, user],
  );

  const removeArchivedSession = useCallback(
    async (sessionId: string) => {
      setArchivedSessions((prev) => {
        const next = prev.filter((session) => session.id !== sessionId);
        if (isAccountUser && user) {
          void saveUserSessionHistory(user.uid, next).catch((error) => {
            console.warn("Failed to persist session deletion:", error);
          });
        }
        return next;
      });
    },
    [isAccountUser, user],
  );

  const clearArchivedSessions = useCallback(async () => {
    setArchivedSessions([]);
    if (isAccountUser && user) {
      try {
        await clearUserSessionHistory(user.uid);
      } catch (error) {
        console.warn("Failed to clear remote session history:", error);
      }
    }
  }, [isAccountUser, user]);

  const clearTranscript = useCallback(async () => {
    setSegments([]);
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
