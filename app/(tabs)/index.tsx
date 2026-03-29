import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    Alert,
    AppState,
    AppStateStatus,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    startMicPcmStream,
    type StopMicStream,
} from "../../src/liveFiller/mic";
import { useAssemblyAiLive } from "../../src/liveFiller/useAssemblyAiLive";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useCoachContext } from "@/context/coach-context";
import { useTranscript } from "@/context/transcript-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
    transcribeBackgroundRecording,
    useBackgroundCaptureRecorder,
} from "@/src/backgroundCapture/recorder";

type PracticeContextId =
  | "presentation"
  | "interview"
  | "meeting"
  | "conversation";

const PRACTICE_CONTEXT_OPTIONS: Array<{
  id: PracticeContextId;
  title: string;
  subtitle: string;
}> = [
  {
    id: "presentation",
    title: "Presentation",
    subtitle: "Slides, demos, and speaking to a group",
  },
  {
    id: "interview",
    title: "Mock interview",
    subtitle: "Behavioral answers and confidence under pressure",
  },
  {
    id: "meeting",
    title: "Work meeting",
    subtitle: "Clear updates, concise points, and stakeholder Q&A",
  },
  {
    id: "conversation",
    title: "Everyday conversation",
    subtitle: "Natural flow, fewer fillers, and better clarity",
  },
];

export default function CoachScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const { segments, appendSegment, startNewRecordingSession } = useTranscript();
  const { selectedPracticeContext, setSelectedPracticeContext } =
    useCoachContext();

  const tint = useThemeColor({}, "tint");
  const muted = useThemeColor({}, "icon");
  const bg = useThemeColor({}, "background");
  const surface = colorScheme === "dark" ? "#1c2124" : "#f0f4f8";
  const surface2 = colorScheme === "dark" ? "#252b30" : "#e2e8f0";
  const accent = colorScheme === "dark" ? "#7dd3fc" : "#0369a1";
  const accentSoft = colorScheme === "dark" ? "#164e63" : "#bae6fd";

  const [listening, setListening] = useState(false);
  const [mistakeCount, setMistakeCount] = useState(0);
  const stopMicRef = useRef<StopMicStream | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const {
    recording: backgroundRecording,
    start: startBackgroundCapture,
    stop: stopBackgroundCapture,
  } = useBackgroundCaptureRecorder();
  const [processingBackgroundAudio, setProcessingBackgroundAudio] =
    useState(false);
  const [backgroundStatus, setBackgroundStatus] = useState<string | null>(null);

  const {
    connect,
    disconnect,
    sendPcmChunk,
    resetTranscript,
    connected,
    connecting,
    transcript,
    lastHits,
    error,
  } = useAssemblyAiLive();

  useEffect(() => {
    if (!listening || lastHits.length === 0) return;
    setMistakeCount((count) => count + lastHits.length);
  }, [lastHits, listening]);

  const startBackgroundModeFromLive = useCallback(async () => {
    await stopMicRef.current?.();
    stopMicRef.current = null;
    disconnect();

    const liveChunk = transcript.trim();
    await startNewRecordingSession("live", {
      practiceContextId: selectedPracticeContext ?? undefined,
      pendingSegment: liveChunk
        ? {
            text: liveChunk,
            source: "listening",
            practiceContextId: selectedPracticeContext ?? undefined,
          }
        : undefined,
    });

    resetTranscript();
    setListening(false);
    await startBackgroundCapture();
    setBackgroundStatus("Background mode is active.");
  }, [
    disconnect,
    resetTranscript,
    selectedPracticeContext,
    startBackgroundCapture,
    startNewRecordingSession,
    transcript,
  ]);

  const onListeningChange = useCallback(
    async (next: boolean, options?: { showBackgroundPrompt?: boolean }) => {
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(
          next
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light,
        );
      }

      if (next) {
        setMistakeCount(0);
        await startNewRecordingSession("live");
        resetTranscript();
        setBackgroundStatus(null);

        try {
          await connect();
          stopMicRef.current = await startMicPcmStream(sendPcmChunk);
          setListening(true);
        } catch (err) {
          console.error("Failed to start listening:", err);
          await stopMicRef.current?.();
          stopMicRef.current = null;
          disconnect();
          setListening(false);
        }
      } else {
        await stopMicRef.current?.();
        stopMicRef.current = null;
        disconnect();

        const chunk = transcript.trim();
        setListening(false);

        const showBackgroundPrompt = options?.showBackgroundPrompt ?? true;
        if (showBackgroundPrompt) {
          Alert.alert(
            "End session",
            "Do you want to continue in Background Mode or analyze this session now?",
            [
              {
                text: "Analyze now",
                onPress: () => {
                  void (async () => {
                    if (chunk) {
                      await appendSegment(chunk, "listening", {
                        practiceContextId: selectedPracticeContext ?? undefined,
                      });
                    }
                    router.push({
                      pathname: "/(tabs)/analytics",
                      params: { autorun: "1", trigger: "live" },
                    });
                  })();
                },
              },
              {
                text: "Background Mode",
                onPress: () => {
                  void startBackgroundModeFromLive().catch((err) => {
                    const message =
                      err instanceof Error
                        ? err.message
                        : "Failed to start background recording.";
                    setBackgroundStatus(message);
                    Alert.alert("Background Mode Error", message);
                  });
                },
              },
              {
                text: "Cancel",
                style: "cancel",
                onPress: () => {
                  void (async () => {
                    if (chunk) {
                      await appendSegment(chunk, "listening", {
                        practiceContextId: selectedPracticeContext ?? undefined,
                      });
                    }
                  })();
                },
              },
            ],
          );
          return;
        }

        if (chunk) {
          await appendSegment(chunk, "listening", {
            practiceContextId: selectedPracticeContext ?? undefined,
          });
        }
        router.push({
          pathname: "/(tabs)/analytics",
          params: { autorun: "1", trigger: "live" },
        });
      }
    },
    [
      appendSegment,
      connect,
      disconnect,
      resetTranscript,
      router,
      sendPcmChunk,
      selectedPracticeContext,
      startBackgroundModeFromLive,
      startNewRecordingSession,
      transcript,
    ],
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (
        (nextState === "inactive" || nextState === "background") &&
        listening
      ) {
        void onListeningChange(false, { showBackgroundPrompt: false });
      }
    });

    return () => {
      sub.remove();
    };
  }, [listening, onListeningChange]);

  const selectPracticeContext = useCallback(
    (id: PracticeContextId) => {
      if (Platform.OS !== "web") {
        void Haptics.selectionAsync();
      }
      setSelectedPracticeContext((current) => (current === id ? null : id));
      if (listening) {
        setMistakeCount(0);
      }
    },
    [setSelectedPracticeContext, listening],
  );

  const resetMistakes = useCallback(() => {
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setMistakeCount(0);
  }, []);

  const stopAndTranscribeBackgroundCapture = useCallback(async () => {
    setProcessingBackgroundAudio(true);
    setBackgroundStatus("Stopping recording...");

    try {
      const stopResult = await stopBackgroundCapture();

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
      setBackgroundStatus("Background transcript added. Opening Analysis...");
      router.push({
        pathname: "/(tabs)/analytics",
        params: { autorun: "1", trigger: "background" },
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to process background recording.";
      setBackgroundStatus(message);
      Alert.alert("Background Mode Error", message);
    } finally {
      setProcessingBackgroundAudio(false);
    }
  }, [appendSegment, router, stopBackgroundCapture]);

  const handleBackgroundCapturePress = useCallback(async () => {
    if (backgroundRecording) {
      await stopAndTranscribeBackgroundCapture();
    }
  }, [backgroundRecording, stopAndTranscribeBackgroundCapture]);

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

  const content = (
    <>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push("/(tabs)/profile")}
          style={({ pressed }) => [
            styles.profileBtn,
            styles.profileBtnFloating,
            {
              borderColor: accentSoft,
              backgroundColor:
                accentSoft + (colorScheme === "dark" ? "55" : "99"),
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <IconSymbol size={17} name="person.fill" color={accent} />
        </Pressable>
        <ThemedText style={[styles.kicker, { color: accent }]}>
          Name of Product
        </ThemedText>
        <ThemedText type="title" style={styles.heroTitle}>
          Live Coaching
        </ThemedText>
        <ThemedText style={[styles.heroSub, { color: muted }]}>
          Turn on listening when you&apos;re ready to practice. Haptic feedback
          can flag slips in real time once your speech layer is connected.
        </ThemedText>
      </View>

      <View style={[styles.card, { backgroundColor: surface }]}>
        <View style={styles.listeningRow}>
          <View style={styles.listeningCopy}>
            <ThemedText type="defaultSemiBold" style={styles.listeningTitle}>
              Live Coaching
            </ThemedText>
            <ThemedText style={[styles.listeningHint, { color: muted }]}>
              {listening
                ? connected
                  ? "Session in progress"
                  : "Connecting..."
                : "Microphone idle"}
            </ThemedText>
          </View>
          <Switch
            value={listening}
            onValueChange={(v) => void onListeningChange(v)}
            trackColor={{ false: surface2, true: accentSoft }}
            thumbColor={listening ? accent : "#f4f4f5"}
            ios_backgroundColor={surface2}
            accessibilityLabel="Toggle active listening"
          />
        </View>
        {error ? (
          <ThemedText style={[styles.transcriptHint, { color: "#dc2626" }]}>
            Live error: {error}
          </ThemedText>
        ) : null}
        <ThemedText style={[styles.transcriptHint, { color: muted }]}>
          {connecting ? "Connecting to live transcription..." : null}
          {connecting ? "\n" : ""}
          {segments.length > 0
            ? `${segments.length} segment${segments.length === 1 ? "" : "s"} saved · view full transcript on Analytics`
            : "Saved segments show on the Analytics tab"}
        </ThemedText>
      </View>

      {backgroundRecording || processingBackgroundAudio || backgroundStatus ? (
        <View style={[styles.card, { backgroundColor: surface }]}>
          <ThemedText style={[styles.backgroundModeTitle, { color: accent }]}>
            Background Mode
          </ThemedText>
          {backgroundRecording ? (
            <Pressable
              style={[
                styles.backgroundCaptureBtn,
                styles.backgroundCaptureStopBtn,
                processingBackgroundAudio && styles.buttonDisabled,
              ]}
              onPress={() => void handleBackgroundCapturePress()}
              disabled={processingBackgroundAudio}
            >
              <ThemedText style={styles.backgroundCaptureBtnText}>
                Stop Background Mode
              </ThemedText>
            </Pressable>
          ) : null}
          {backgroundStatus ? (
            <ThemedText
              style={[styles.backgroundCaptureStatus, { color: muted }]}
            >
              {backgroundStatus}
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      <ThemedText type="subtitle" style={styles.sectionTitle}>
        What are you practicing right now?
      </ThemedText>
      <ThemedText style={[styles.sectionHint, { color: muted }]}>
        Pick a situation for targeted coaching, or leave all options unselected
        for general live coaching.
      </ThemedText>

      <View style={styles.optionGrid}>
        {PRACTICE_CONTEXT_OPTIONS.map((opt) => {
          const selected = selectedPracticeContext === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => selectPracticeContext(opt.id)}
              style={({ pressed }) => [
                styles.optionCard,
                {
                  backgroundColor: selected
                    ? accentSoft + (colorScheme === "dark" ? "55" : "cc")
                    : surface,
                  borderColor: selected ? accent : "transparent",
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <ThemedText type="defaultSemiBold" style={styles.optionTitle}>
                {opt.title}
              </ThemedText>
              <ThemedText style={[styles.optionSub, { color: muted }]}>
                {opt.subtitle}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText
        type="subtitle"
        style={[styles.sectionTitle, styles.mistakesSection]}
      >
        Moments flagged
      </ThemedText>
      <View style={[styles.mistakeCard, { backgroundColor: surface }]}>
        <ThemedText style={[styles.mistakeCount, { color: accent }]}>
          {mistakeCount}
        </ThemedText>
        <ThemedText style={[styles.mistakeLabel, { color: muted }]}>
          {listening
            ? "Live filler detections this session"
            : "Start listening to begin a session"}
        </ThemedText>
        <View style={styles.mistakeActions}>
          <Pressable
            onPress={resetMistakes}
            style={({ pressed }) => [
              styles.textBtn,
              { opacity: pressed ? 0.7 : mistakeCount === 0 ? 0.4 : 1 },
            ]}
            disabled={mistakeCount === 0}
          >
            <ThemedText style={[styles.textBtnLabel, { color: tint }]}>
              Reset count
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: bg }]}
      edges={["top"]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          Platform.OS === "web" && styles.scrollWeb,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ThemedView style={styles.inner}>{content}</ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  scrollWeb: {
    flexGrow: 1,
    minHeight: "100%",
  },
  inner: {
    flex: 1,
    paddingTop: 20,
    position: "relative",
  },
  profileBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 9999,
    width: 34,
    height: 34,
  },
  profileBtnFloating: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 2,
  },
  header: {
    marginBottom: 24,
    position: "relative",
  },
  kicker: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 28,
  },
  listeningRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  listeningCopy: {
    flex: 1,
  },
  listeningTitle: {
    fontSize: 18,
  },
  listeningHint: {
    fontSize: 14,
    marginTop: 4,
  },
  transcriptHint: {
    fontSize: 13,
    marginTop: 10,
    lineHeight: 18,
  },
  backgroundModeTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  backgroundCaptureBtn: {
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  backgroundCaptureStopBtn: {
    backgroundColor: "#b91c1c",
  },
  backgroundCaptureBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  backgroundCaptureStatus: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  sectionTitle: {
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  optionGrid: {
    gap: 12,
    marginBottom: 28,
  },
  optionCard: {
    borderRadius: 14,
    padding: 16,
    minHeight: 88,
    borderWidth: 2,
  },
  optionTitle: {
    fontSize: 17,
    marginBottom: 6,
  },
  optionSub: {
    fontSize: 14,
    lineHeight: 20,
  },
  mistakesSection: {
    marginBottom: 10,
  },
  mistakeCard: {
    borderRadius: 16,
    padding: 22,
    alignItems: "center",
  },
  mistakeCount: {
    fontSize: 56,
    fontWeight: "700",
    lineHeight: 62,
    fontVariant: ["tabular-nums"],
  },
  mistakeLabel: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 320,
  },
  mistakeActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 20,
    marginTop: 18,
  },
  textBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  textBtnLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
});
