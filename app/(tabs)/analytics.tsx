import { Link } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getCorrectionFocusTitle } from "@/constants/speech-coach";
import { PRACTICE_CONTEXT_OPTIONS } from "@/constants/speech-coach";
import { useCoachContext } from "@/context/coach-context";
import { useProfile } from "@/context/profile-context";
import { useProgress } from "@/context/progress-context";
import {
  useTranscript,
  type TranscriptArchiveSession,
} from "@/context/transcript-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { saveSpeechAnalysisHistory } from "@/services/firebase";
import {
  analyzeSpeechPatterns,
  validateApiConfiguration,
} from "@/services/llm-service";
import { buildSpeechHistoryPayload } from "@/services/speech-history-payload";
import {
  transcribeBackgroundRecording,
  useBackgroundCaptureRecorder,
} from "@/src/backgroundCapture/recorder";

interface AnalysisResult {
  fillers: string[];
  vagueLanguage: string[];
  suggestions: string[];
  overall_score: number;
  details: string;
  vagueness_score: number;
}

export default function AnalyticsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const {
    fullTranscript,
    topContentWords,
    segments,
    archivedSessions,
    appendSegment,
    startNewRecordingSession,
    removeArchivedSession,
    clearArchivedSessions,
    clearTranscript,
    ready,
  } = useTranscript();
  const router = useRouter();
  const params = useLocalSearchParams<{ autorun?: string; trigger?: string }>();
  const { selectedFocus, selectedPracticeContext } = useCoachContext();
  const { profile } = useProfile();
  const { recordAnalysis, recordPractice } = useProgress();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    recording: backgroundRecording,
    start,
    stop,
  } = useBackgroundCaptureRecorder();
  const [processingBackgroundAudio, setProcessingBackgroundAudio] =
    useState(false);
  const [backgroundStatus, setBackgroundStatus] = useState<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const autoRunLockRef = useRef(false);

  const bgColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const muted = useThemeColor({}, "icon");
  const cardBg = colorScheme === "dark" ? "#1c2124" : "#f0f4f8";
  const borderColor = colorScheme === "dark" ? "#334155" : "#cbd5e1";

  const recentArchivedSessions = archivedSessions.slice(0, 8);

  const practiceTitleById = useMemo(() => {
    return new Map(
      PRACTICE_CONTEXT_OPTIONS.map((item) => [item.id, item.title]),
    );
  }, []);

  const formatArchiveTime = useCallback((timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return "Unknown time";
    }
  }, []);

  const getArchiveReasonLabel = useCallback(
    (session: TranscriptArchiveSession) => {
      if (session.reason === "background") {
        return "Background Capture";
      }

      const practiceTitle = session.practiceContextId
        ? practiceTitleById.get(session.practiceContextId)
        : undefined;
      return practiceTitle
        ? `${practiceTitle} Practice`
        : "Presentation Practice";
    },
    [practiceTitleById],
  );

  const confirmDeleteArchivedSession = useCallback(
    (sessionId: string) => {
      Alert.alert(
        "Delete archived session?",
        "This removes the session from local history.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              void removeArchivedSession(sessionId);
            },
          },
        ],
      );
    },
    [removeArchivedSession],
  );

  const confirmClearAllHistory = useCallback(() => {
    Alert.alert(
      "Clear all session history?",
      "All archived sessions will be removed from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: () => {
            void clearArchivedSessions();
          },
        },
      ],
    );
  }, [clearArchivedSessions]);

  const stopAndTranscribeBackgroundCapture = useCallback(async () => {
    setProcessingBackgroundAudio(true);
    setBackgroundStatus("Stopping recording...");

    try {
      const stopResult = await stop();

      if (!stopResult.uri) {
        setBackgroundStatus("No recording found to transcribe.");
        return;
      }

      setBackgroundStatus("Transcribing recorded audio...");
      const transcript = await transcribeBackgroundRecording(stopResult.uri);
      const trimmed = transcript.trim();

      if (!trimmed) {
        setBackgroundStatus("No speech detected in the background recording.");
        return;
      }

      await appendSegment(trimmed, "background");
      setBackgroundStatus("Background transcript added.");
      await handleAnalyze(trimmed, "background");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to process background recording.";
      setBackgroundStatus(message);
      Alert.alert("Background Capture Error", message);
    } finally {
      setProcessingBackgroundAudio(false);
    }
  }, [appendSegment, stop]);

  const handleBackgroundCapturePress = useCallback(async () => {
    if (backgroundRecording) {
      await stopAndTranscribeBackgroundCapture();
      return;
    }

    try {
      await startNewRecordingSession("background");
      await start();
      setBackgroundStatus("Recording in background is active.");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to start background recording.";
      setBackgroundStatus(message);
      Alert.alert("Background Capture Error", message);
    }
  }, [
    backgroundRecording,
    start,
    startNewRecordingSession,
    stopAndTranscribeBackgroundCapture,
  ]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const wasInBackground = /inactive|background/.test(appStateRef.current);
      appStateRef.current = nextState;

      if (wasInBackground && nextState === "active" && backgroundRecording) {
        void stopAndTranscribeBackgroundCapture();
      }
    });

    return () => {
      sub.remove();
    };
  }, [backgroundRecording, stopAndTranscribeBackgroundCapture]);

  const handleAnalyze = async (
    transcriptOverride?: string,
    runTrigger: "manual" | "live" | "background" = "manual",
  ) => {
    // Validate configuration first
    const config = validateApiConfiguration();
    if (!config.valid) {
      Alert.alert(
        "Configuration Error",
        config.error ||
          "API key not configured. Please set K2_THINK_V2_API_KEY in .env.local",
      );
      return;
    }

    const transcriptToAnalyze = (transcriptOverride ?? fullTranscript).trim();
    const listeningTranscript = segments
      .filter((s) => s.source === "listening")
      .map((s) => s.text)
      .join("\n\n")
      .trim();
    if (!transcriptToAnalyze) {
      Alert.alert(
        "No Transcript Available",
        "Start a listening session on the Coach tab first.",
      );
      return;
    }
    /* await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    }); */

    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      if (__DEV__) {
        console.log('═══════════════════════════════════════════════════════');
        console.log('📊 ANALYTICS PAGE - INITIATING ANALYSIS');
        console.log('═══════════════════════════════════════════════════════');
        console.log(
          `📝 Input Text: ${transcriptToAnalyze.substring(0, 100)}${transcriptToAnalyze.length > 100 ? '...' : ''}`,
        );
        console.log(`🎯 Selected Focus: ${selectedFocus}`);
        console.log(`👤 User Proficiency: ${profile.proficiencyLevel}`);
        console.log(
          `🎯 Improvement Goals: ${profile.improvementGoals.join(', ')}`,
        );
        console.log(
          `📏 Text Length: ${transcriptToAnalyze.length} characters`,
        );
        console.log('───────────────────────────────────────────────────────');
      }

      const result = await analyzeSpeechPatterns(
        transcriptToAnalyze,
        selectedFocus,
        profile.proficiencyLevel,
        profile.improvementGoals,
        profile.age,
        runTrigger === "live" ||
          (runTrigger === "manual" &&
            transcriptToAnalyze === listeningTranscript &&
            listeningTranscript.length > 0)
          ? selectedPracticeContext
          : undefined,
      );

      if (__DEV__) {
        console.log("───────────────────────────────────────────────────────");
        console.log("✅ Analysis Complete - Updating UI");
        console.log(
          "═══════════════════════════════════════════════════════\n",
        );
      }

      setAnalysis(result);

      const fillerCount = result.fillers.length;
      recordAnalysis(fillerCount);

      const estimatedMinutes = Math.max(
        1,
        Math.ceil(transcriptToAnalyze.length / 100),
      );
      recordPractice(estimatedMinutes);

      void saveSpeechAnalysisHistory(
        buildSpeechHistoryPayload(
          transcriptToAnalyze,
          segments,
          selectedFocus,
          result,
        ),
      ).catch((syncErr) => {
        console.warn("Firebase history sync failed:", syncErr);
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      console.error("❌ Analytics Error:", errorMessage);
      setError(errorMessage);
      Alert.alert("Analysis Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (params.autorun !== "1") {
      autoRunLockRef.current = false;
      return;
    }

    if (!ready || isLoading || processingBackgroundAudio) return;
    if (autoRunLockRef.current) return;

    autoRunLockRef.current = true;
    const trigger = params.trigger === "background" ? "background" : "live";

    router.replace("/(tabs)/analytics");
    void handleAnalyze(undefined, trigger);
  }, [
    handleAnalyze,
    isLoading,
    params.autorun,
    params.trigger,
    processingBackgroundAudio,
    ready,
    router,
  ]);

  const handleClear = () => {
    setAnalysis(null);
    setError(null);
  };

  const [clearingTranscript, setClearingTranscript] = useState(false);

  const handleClearStoredTranscript = async () => {
    if (clearingTranscript) return;
    setClearingTranscript(true);
    try {
      await clearTranscript();
      setAnalysis(null);
      setError(null);
    } catch {
      Alert.alert(
        "Couldn’t clear",
        "Storage didn’t update. Try again or restart the app.",
      );
    } finally {
      setClearingTranscript(false);
    }
  };

  const ScoreIndicator = ({ score }: { score: number }) => {
    const getScoreColor = () => {
      if (score >= 80) return "#10b981"; // Green
      if (score >= 60) return "#f59e0b"; // Amber
      return "#ef4444"; // Red
    };

    return (
      <View style={styles.scoreContainer}>
        <View
          style={[
            styles.scoreCircle,
            { backgroundColor: getScoreColor(), borderColor: getScoreColor() },
          ]}
        >
          <Text style={styles.scoreText}>{score}</Text>
        </View>
        <Text style={styles.scoreLabel}>Speech Quality Score</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
      <ScrollView style={[styles.container, { backgroundColor: bgColor }]}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title">Speech Analytics</ThemedText>
          <ThemedText style={styles.subtitle}>
            Get AI-powered feedback on your speech patterns
          </ThemedText>
        </View>

        <ThemedView style={[styles.section, { backgroundColor: cardBg }]}>
          <Text style={[styles.label, { color: textColor }]}>
            Session history
          </Text>
          <Text style={[styles.transcriptMeta, { color: muted }]}>
            Each analysis saves scores and metrics to Firebase (not your raw
            transcript). View trends on the History tab.
          </Text>
          <Link href="/history" asChild>
            <Pressable
              style={styles.historyLinkBtn}
              accessibilityRole="link"
              accessibilityLabel="Open session history"
            >
              <Text style={[styles.historyLinkText, { color: "#007AFF" }]}>
                Open History →
              </Text>
            </Pressable>
          </Link>
        </ThemedView>

        {ready && (
          <ThemedView style={[styles.section, { backgroundColor: cardBg }]}>
            <Text style={[styles.label, { color: textColor }]}>
              Saved transcript
            </Text>
            <Text style={[styles.transcriptMeta, { color: muted }]}>
              {segments.length} segment{segments.length === 1 ? "" : "s"} ·
              built from listening sessions and text you analyze or save here
            </Text>
            {fullTranscript.trim().length > 0 ? (
              <ScrollView
                style={styles.transcriptScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                <Text style={[styles.transcriptBody, { color: textColor }]}>
                  {fullTranscript}
                </Text>
              </ScrollView>
            ) : (
              <Text style={[styles.emptyTranscript, { color: muted }]}>
                Nothing saved yet. Turn off a listening session on the Coach tab
                or analyze / save text below.
              </Text>
            )}
            <Text style={[styles.label, { color: textColor, marginTop: 16 }]}>
              Top words (not including stop words)
            </Text>
            {topContentWords.length > 0 ? (
              <View style={styles.chipWrap}>
                {topContentWords.map(({ word, count }) => (
                  <View
                    key={word}
                    style={[styles.chip, { borderColor: muted + "55" }]}
                  >
                    <Text style={[styles.chipText, { color: textColor }]}>
                      {word} <Text style={{ color: muted }}>({count})</Text>
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyTranscript, { color: muted }]}>
                Add more speech to see frequent content words.
              </Text>
            )}
            {fullTranscript.trim().length > 0 || segments.length > 0 ? (
              <Pressable
                style={[
                  styles.linkBtn,
                  clearingTranscript && styles.linkBtnDisabled,
                ]}
                onPress={() => void handleClearStoredTranscript()}
                disabled={clearingTranscript}
                accessibilityRole="button"
                accessibilityLabel="Clear saved transcript and analysis"
              >
                <Text style={styles.linkBtnText}>
                  {clearingTranscript ? "Clearing…" : "Clear saved transcript"}
                </Text>
              </Pressable>
            ) : null}
          </ThemedView>
        )}

        {ready && (
          <ThemedView style={[styles.section, { backgroundColor: cardBg }]}>
            <View style={styles.historySectionHeader}>
              <Text style={[styles.label, { color: textColor }]}>
                Session history
              </Text>
              {recentArchivedSessions.length > 0 ? (
                <Pressable
                  onPress={confirmClearAllHistory}
                  accessibilityRole="button"
                  accessibilityLabel="Clear all session history"
                >
                  <Text style={styles.historyClearAllText}>Clear all</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={[styles.transcriptMeta, { color: muted }]}>
              Previous transcripts are archived locally when a new recording
              starts.
            </Text>

            {recentArchivedSessions.length === 0 ? (
              <Text style={[styles.emptyTranscript, { color: muted }]}>
                No archived sessions yet.
              </Text>
            ) : (
              <ScrollView
                style={styles.historyScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                <View style={styles.historyList}>
                  {recentArchivedSessions.map((session) => {
                    const preview = session.transcript
                      .replace(/\s+/g, " ")
                      .trim();
                    const trigger =
                      session.reason === "live" ? "live" : "background";

                    return (
                      <View
                        key={session.id}
                        style={[
                          styles.historyCard,
                          {
                            borderColor,
                            backgroundColor:
                              colorScheme === "dark" ? "#111827" : "#ffffff",
                          },
                        ]}
                      >
                        <View style={styles.historyHeader}>
                          <Text
                            style={[styles.historyReason, { color: textColor }]}
                          >
                            {getArchiveReasonLabel(session)}
                          </Text>
                          <Text style={[styles.historyTime, { color: muted }]}>
                            {formatArchiveTime(session.archivedAt)}
                          </Text>
                        </View>

                        <Text style={[styles.historyMeta, { color: muted }]}>
                          {session.segments.length} segment
                          {session.segments.length === 1 ? "" : "s"}
                        </Text>

                        <Text
                          style={[styles.historyPreview, { color: textColor }]}
                        >
                          {preview.length > 180
                            ? `${preview.slice(0, 180)}…`
                            : preview}
                        </Text>

                        <Pressable
                          style={({ pressed }) => [
                            styles.historyAnalyzeBtn,
                            { opacity: pressed ? 0.85 : 1 },
                          ]}
                          onPress={() =>
                            void handleAnalyze(session.transcript, trigger)
                          }
                          disabled={isLoading || processingBackgroundAudio}
                        >
                          <Text style={styles.historyAnalyzeBtnText}>
                            Analyze this session
                          </Text>
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [
                            styles.historyDeleteBtn,
                            { opacity: pressed ? 0.75 : 1 },
                          ]}
                          onPress={() =>
                            confirmDeleteArchivedSession(session.id)
                          }
                          accessibilityRole="button"
                          accessibilityLabel="Delete archived session"
                        >
                          <Text style={styles.historyDeleteBtnText}>
                            Delete
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </ThemedView>
        )}

        {/* Input Section */}
        <ThemedView style={[styles.section, { backgroundColor: cardBg }]}>
          <Text style={[styles.label, { color: textColor }]}>
            Saved speech or conversation:
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colorScheme === "dark" ? "#2b3139" : "#ffffff",
                color: textColor,
                borderColor: colorScheme === "dark" ? "#404854" : "#e5e7eb",
              },
            ]}
            placeholder="Your saved transcript will appear here..."
            placeholderTextColor={
              colorScheme === "dark" ? "#9ca3af" : "#9ca3af"
            }
            multiline
            numberOfLines={6}
            value={fullTranscript}
            editable={false}
          />
          <View style={styles.backgroundCaptureSection}>
            <Pressable
              style={[
                styles.backgroundCaptureBtn,
                backgroundRecording
                  ? styles.backgroundCaptureStopBtn
                  : styles.backgroundCaptureStartBtn,
                processingBackgroundAudio && styles.buttonDisabled,
              ]}
              onPress={() => void handleBackgroundCapturePress()}
              disabled={processingBackgroundAudio}
            >
              <Text style={styles.backgroundCaptureBtnText}>
                {backgroundRecording
                  ? "Stop Background Capture"
                  : "Start Background Capture"}
              </Text>
            </Pressable>
            {backgroundStatus ? (
              <Text style={[styles.backgroundCaptureStatus, { color: muted }]}>
                {backgroundStatus}
              </Text>
            ) : null}
          </View>
        </ThemedView>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={[
              styles.button,
              styles.analyzeButton,
              (isLoading || processingBackgroundAudio) && styles.buttonDisabled,
            ]}
            onPress={() => void handleAnalyze()}
            disabled={isLoading || processingBackgroundAudio}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Analyze Speech</Text>
            )}
          </Pressable>

          <Pressable
            style={[styles.button, styles.clearButton]}
            onPress={handleClear}
          >
            <Text style={[styles.buttonText, { color: "#007AFF" }]}>Clear</Text>
          </Pressable>
        </View>

        {/* Loading State */}
        {isLoading && (
          <ThemedView
            style={[styles.loadingContainer, { backgroundColor: cardBg }]}
          >
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={[styles.loadingText, { color: textColor }]}>
              Analyzing your speech...
            </Text>
          </ThemedView>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <ThemedView
            style={[styles.errorContainer, { backgroundColor: "#fee2e2" }]}
          >
            <Text style={[styles.errorText, { color: "#991b1b" }]}>
              ⚠️ {error}
            </Text>
          </ThemedView>
        )}

        {/* Results Section */}
        {analysis && !isLoading && (
          <ThemedView
            style={[styles.resultsContainer, { backgroundColor: cardBg }]}
          >
            {/* Score */}
            <ScoreIndicator score={analysis.overall_score} />

            {/* Overall Summary */}
            <View style={styles.summaryBox}>
              <Text style={[styles.summaryTitle, { color: textColor }]}>
                Summary
              </Text>
              <Text style={[styles.summaryText, { color: textColor }]}>
                {analysis.details}
              </Text>
              <Text
                style={[styles.summaryMeta, { color: muted, marginTop: 10 }]}
              >
                Vagueness index (model): {analysis.vagueness_score}/100 · Focus:{" "}
                {getCorrectionFocusTitle(selectedFocus)}
              </Text>
            </View>

            {/* Filler Words */}
            {analysis.fillers && analysis.fillers.length > 0 && (
              <View style={styles.findingBox}>
                <Text style={[styles.findingTitle, { color: "#ef4444" }]}>
                  🔴 Filler Words Found
                </Text>
                {analysis.fillers.map((filler, idx) => (
                  <Text
                    key={idx}
                    style={[styles.findingItem, { color: textColor }]}
                  >
                    • {filler}
                  </Text>
                ))}
              </View>
            )}

            {/* Vague Language */}
            {analysis.vagueLanguage && analysis.vagueLanguage.length > 0 && (
              <View style={styles.findingBox}>
                <Text style={[styles.findingTitle, { color: "#f59e0b" }]}>
                  🟡 Vague Language
                </Text>
                {analysis.vagueLanguage.map((vague, idx) => (
                  <Text
                    key={idx}
                    style={[styles.findingItem, { color: textColor }]}
                  >
                    • {"\u201c"}
                    {vague}
                    {"\u201d"}
                  </Text>
                ))}
              </View>
            )}

            {/* Suggestions */}
            {analysis.suggestions && analysis.suggestions.length > 0 && (
              <View style={styles.findingBox}>
                <Text style={[styles.findingTitle, { color: "#10b981" }]}>
                  ✅ Suggestions for Improvement
                </Text>
                {analysis.suggestions.map((suggestion, idx) => (
                  <Text
                    key={idx}
                    style={[styles.findingItem, { color: textColor }]}
                  >
                    • {suggestion}
                  </Text>
                ))}
              </View>
            )}
          </ThemedView>
        )}

        {/* Empty State */}
        {!analysis && !isLoading && fullTranscript.trim() && !error && (
          <ThemedView style={[styles.emptyState, { backgroundColor: cardBg }]}>
            <Text style={[styles.emptyStateText, { color: textColor }]}>
              Tap {"\u201c"}Analyze Speech{"\u201d"} to get started
            </Text>
          </ThemedView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  subtitle: {
    marginTop: 8,
    opacity: 0.7,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: "top",
    minHeight: 120,
  },
  backgroundCaptureSection: {
    marginTop: 14,
    gap: 8,
  },
  backgroundCaptureBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  backgroundCaptureStartBtn: {
    backgroundColor: "#7c3aed",
  },
  backgroundCaptureStopBtn: {
    backgroundColor: "#b91c1c",
  },
  backgroundCaptureBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  backgroundCaptureStatus: {
    fontSize: 13,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  analyzeButton: {
    backgroundColor: "#007AFF",
  },
  clearButton: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#007AFF",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  loadingContainer: {
    padding: 24,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
  },
  scoreContainer: {
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 16,
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    marginBottom: 12,
  },
  scoreText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666666",
  },
  summaryBox: {
    padding: 12,
    backgroundColor: "rgba(0, 122, 255, 0.1)",
    borderRadius: 8,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 19,
  },
  summaryMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
  resultsContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  findingBox: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  findingTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  findingItem: {
    fontSize: 13,
    marginVertical: 4,
    lineHeight: 18,
  },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  emptyStateText: {
    fontSize: 14,
    opacity: 0.6,
  },
  transcriptMeta: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  transcriptScroll: {
    maxHeight: 160,
    marginBottom: 4,
  },
  transcriptBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  emptyTranscript: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  historyList: {
    gap: 12,
  },
  historyScroll: {
    maxHeight: 320,
  },
  historySectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  historyClearAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ef4444",
  },
  historyCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  historyReason: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  historyTime: {
    fontSize: 12,
  },
  historyMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  historyPreview: {
    fontSize: 13,
    lineHeight: 19,
  },
  historyAnalyzeBtn: {
    alignSelf: "flex-start",
    marginTop: 2,
    borderRadius: 8,
    backgroundColor: "#0ea5e9",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  historyAnalyzeBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  historyDeleteBtn: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ef4444",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  historyDeleteBtnText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "700",
  },
  linkBtn: {
    marginTop: 14,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  linkBtnDisabled: {
    opacity: 0.5,
  },
  linkBtnText: {
    fontSize: 14,
    color: "#ef4444",
    fontWeight: "600",
  },
  historyLinkBtn: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingVertical: 8,
  },
  historyLinkText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
