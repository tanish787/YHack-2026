import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useTranscript } from "@/context/transcript-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  analyzeSpeechPatterns,
  validateApiConfiguration,
} from "@/services/llm-service";
import {
  loadPersonalBests,
  mergePersonalBests,
  resetPersonalBests,
  savePersonalBests,
  type PersonalBests,
} from "@/services/personal-bests";
import {
  computeSessionSpeechMetrics,
  getFillerBucketLabel,
  type FillerBucket,
} from "@/services/speech-metrics";

interface AnalysisResult {
  fillers: string[];
  vagueLanguage: string[];
  suggestions: string[];
  overall_score: number;
  details: string;
}

export default function AnalyticsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const {
    fullTranscript,
    topContentWords,
    segments,
    appendSegment,
    clearTranscript,
    ready,
  } = useTranscript();
  const [speechText, setSpeechText] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personalBests, setPersonalBests] = useState<PersonalBests | null>(
    null,
  );
  const [pbFlash, setPbFlash] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const sessionMetrics = useMemo(
    () => computeSessionSpeechMetrics(speechText),
    [speechText],
  );

  useEffect(() => {
    let cancelled = false;
    void loadPersonalBests().then((b) => {
      if (!cancelled) setPersonalBests(b);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (pbFlash.length > 0) setAdvancedOpen(true);
  }, [pbFlash]);

  const bgColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const muted = useThemeColor({}, "icon");
  const cardBg = colorScheme === "dark" ? "#1c2124" : "#f0f4f8";
  const hasSavedTranscript = segments.length > 0;

  const handleAnalyze = async () => {
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

    if (!speechText.trim()) {
      Alert.alert("Input Required", "Please enter some speech text to analyze");
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      console.log(
        "Analytics: Starting analysis with text:",
        speechText.substring(0, 50) + "...",
      );
      const result = await analyzeSpeechPatterns(speechText);
      setAnalysis(result);
      const trimmed = speechText.trim();
      const metrics = computeSessionSpeechMetrics(trimmed);
      const prev = await loadPersonalBests();
      const flashes: string[] = [];
      if (
        prev.bestFillerRatePercent === null ||
        metrics.fillerRatePercent < prev.bestFillerRatePercent
      ) {
        flashes.push("filler");
      }
      if (
        prev.bestPaceConsistencyScore === null ||
        metrics.paceConsistencyScore > prev.bestPaceConsistencyScore
      ) {
        flashes.push("pace");
      }
      if (metrics.longestCleanStreak > prev.longestCleanStreakWords) {
        flashes.push("streak");
      }
      const ttrOk = metrics.vocabulary.totalWords >= 8;
      if (
        ttrOk &&
        (prev.bestTypeTokenRatio === null ||
          metrics.vocabulary.typeTokenRatio > prev.bestTypeTokenRatio)
      ) {
        flashes.push("vocab");
      }
      setPbFlash(flashes);
      const next = mergePersonalBests(prev, metrics);
      await savePersonalBests(next);
      setPersonalBests(next);
      setTimeout(() => setPbFlash([]), 6000);
      await appendSegment(trimmed, "analytics");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Analytics: Error occurred:", errorMessage);
      setError(errorMessage);
      Alert.alert("Analysis Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setSpeechText("");
    setAnalysis(null);
    setError(null);
    setPbFlash([]);
  };

  const handleSaveToTranscriptOnly = async () => {
    if (!speechText.trim()) {
      Alert.alert(
        "Input Required",
        "Enter some text to save to the transcript.",
      );
      return;
    }
    await appendSegment(speechText.trim(), "analytics");
    Alert.alert("Saved", "This text was added to your running transcript.");
  };

  const [clearingTranscript, setClearingTranscript] = useState(false);

  const handleClearStoredTranscript = async () => {
    if (clearingTranscript) return;
    setClearingTranscript(true);
    try {
      await clearTranscript();
      const freshBests = await resetPersonalBests();
      setPersonalBests(freshBests);
      setPbFlash([]);
      setAdvancedOpen(false);
      setSpeechText("");
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

        {/* Input Section */}
        <ThemedView style={[styles.section, { backgroundColor: cardBg }]}>
          <Text style={[styles.label, { color: textColor }]}>
            Paste your speech or conversation:
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
            placeholder="Enter your speech text here..."
            placeholderTextColor={
              colorScheme === "dark" ? "#9ca3af" : "#9ca3af"
            }
            multiline
            numberOfLines={6}
            value={speechText}
            onChangeText={setSpeechText}
            editable={!isLoading}
          />
        </ThemedView>

        <ThemedView style={[styles.section, { backgroundColor: cardBg }]}>
          <Pressable
            style={styles.advHeader}
            onPress={() => setAdvancedOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityLabel="Advanced analytics"
            accessibilityState={{ expanded: advancedOpen }}
          >
            <View style={styles.advHeaderTextCol}>
              <Text style={[styles.advTitle, { color: textColor }]}>
                Advanced analytics
              </Text>
              <Text style={[styles.advSubtitle, { color: muted }]}>
                Filler placement, vocabulary stats, personal bests
              </Text>
            </View>
            <Text
              style={[styles.advChevron, { color: muted }]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {advancedOpen ? "▼" : "▶"}
            </Text>
          </Pressable>

          {advancedOpen ? (
            <View style={styles.advBody}>
              {!hasSavedTranscript ? (
                <Text style={[styles.advEmptyText, { color: muted }]}>
                  To receive Advanced Analytics, usevthe Coach tab, tap{" "}
                  {"\u201c"}Analyze Speech{"\u201d"}, or {"\u201c"}Save to
                  transcript{"\u201d"} to build a transcript. Clearing the saved
                  transcript resets this section and your personal bests.
                </Text>
              ) : personalBests === null ? (
                <View style={styles.advLoadingRow}>
                  <ActivityIndicator color="#007AFF" />
                  <Text style={[styles.findingItem, { color: muted }]}>
                    Loading your records…
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.eduSubhead, { color: textColor }]}>
                    Personal bests
                  </Text>
                  <Text style={[styles.eduHint, { color: muted }]}>
                    Updated when you run {"\u201c"}Analyze Speech{"\u201d"}.
                    Lower filler rate is better; other scores, higher is better.
                  </Text>
                  <View style={styles.pbGrid}>
                    <View style={styles.pbRow}>
                      <Text style={[styles.pbLabel, { color: muted }]}>
                        Lowest filler rate
                      </Text>
                      <Text style={[styles.pbValue, { color: textColor }]}>
                        {personalBests.bestFillerRatePercent !== null
                          ? `${personalBests.bestFillerRatePercent.toFixed(1)}% of words`
                          : "—"}
                        {pbFlash.includes("filler") ? (
                          <Text style={styles.pbNew}> · New best</Text>
                        ) : null}
                      </Text>
                    </View>
                    <View style={styles.pbRow}>
                      <Text style={[styles.pbLabel, { color: muted }]}>
                        Most consistent pace
                      </Text>
                      <Text style={[styles.pbValue, { color: textColor }]}>
                        {personalBests.bestPaceConsistencyScore !== null
                          ? `${personalBests.bestPaceConsistencyScore} / 100`
                          : "—"}
                        {pbFlash.includes("pace") ? (
                          <Text style={styles.pbNew}> · New best</Text>
                        ) : null}
                      </Text>
                    </View>
                    <View style={styles.pbRow}>
                      <Text style={[styles.pbLabel, { color: muted }]}>
                        Longest clean streak
                      </Text>
                      <Text style={[styles.pbValue, { color: textColor }]}>
                        {personalBests.longestCleanStreakWords > 0
                          ? `${personalBests.longestCleanStreakWords} words without a filler`
                          : "—"}
                        {pbFlash.includes("streak") ? (
                          <Text style={styles.pbNew}> · New best</Text>
                        ) : null}
                      </Text>
                    </View>
                    <View style={[styles.pbRow, styles.pbRowLast]}>
                      <Text style={[styles.pbLabel, { color: muted }]}>
                        Richest vocabulary (sample)
                      </Text>
                      <Text style={[styles.pbValue, { color: textColor }]}>
                        {personalBests.bestTypeTokenRatio !== null
                          ? `${(personalBests.bestTypeTokenRatio * 100).toFixed(1)}% unique (TTR)`
                          : "—"}
                        {pbFlash.includes("vocab") ? (
                          <Text style={styles.pbNew}> · New best</Text>
                        ) : null}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.advDivider,
                      { backgroundColor: muted + "33" },
                    ]}
                  />

                  <Text style={[styles.eduSubhead, { color: textColor }]}>
                    Data-driven coaching (this sample)
                  </Text>
                  <Text style={[styles.eduHint, { color: muted }]}>
                    No AI—same metrics every time for the same text. Matches
                    common fillers and phrases like {"\u201c"}you know{"\u201d"}
                    , {"\u201c"}sort of{"\u201d"}.
                  </Text>

                  {speechText.trim().length === 0 ? (
                    <Text style={[styles.findingItem, { color: muted }]}>
                      Paste speech in the box above to see filler placement,
                      type-token ratio, and this sample’s stats.
                    </Text>
                  ) : (
                    <>
                      <Text
                        style={[
                          styles.eduSubhead,
                          { color: textColor, marginTop: 4 },
                        ]}
                      >
                        Filler placement
                      </Text>
                      {sessionMetrics.fillerHeatmap.totalFillers === 0 ? (
                        <Text style={[styles.findingItem, { color: muted }]}>
                          No fillers from our list in this text—or too little to
                          classify.
                        </Text>
                      ) : (
                        <>
                          {(
                            [
                              "topic_transition",
                              "after_question",
                              "sentence_start",
                              "mid_speech",
                            ] as FillerBucket[]
                          ).map((bucket) => {
                            const n =
                              sessionMetrics.fillerHeatmap.byBucket[bucket];
                            const max = Math.max(
                              1,
                              ...Object.values(
                                sessionMetrics.fillerHeatmap.byBucket,
                              ),
                            );
                            const wPct = Math.round((n / max) * 100);
                            return (
                              <View key={bucket} style={styles.heatmapRow}>
                                <View style={styles.heatmapLabelCol}>
                                  <Text
                                    style={[
                                      styles.heatmapLabelText,
                                      { color: textColor },
                                    ]}
                                    numberOfLines={2}
                                  >
                                    {getFillerBucketLabel(bucket)}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.heatmapCount,
                                      { color: muted },
                                    ]}
                                  >
                                    {n} filler{n === 1 ? "" : "s"}
                                  </Text>
                                </View>
                                <View
                                  style={[
                                    styles.heatmapTrack,
                                    {
                                      backgroundColor:
                                        colorScheme === "dark"
                                          ? "#2b3139"
                                          : "#e5e7eb",
                                    },
                                  ]}
                                >
                                  <View
                                    style={[
                                      styles.heatmapFill,
                                      {
                                        width: `${wPct}%`,
                                        backgroundColor:
                                          n > 0 ? "#f97316" : "transparent",
                                      },
                                    ]}
                                  />
                                </View>
                              </View>
                            );
                          })}
                          <Text
                            style={[styles.insightText, { color: textColor }]}
                          >
                            {sessionMetrics.fillerHeatmap.insight}
                          </Text>
                        </>
                      )}

                      <Text
                        style={[
                          styles.eduSubhead,
                          { color: textColor, marginTop: 18 },
                        ]}
                      >
                        Vocabulary diversity
                      </Text>
                      <Text style={[styles.findingItem, { color: textColor }]}>
                        Type-token ratio:{" "}
                        <Text style={{ fontWeight: "700" }}>
                          {(
                            sessionMetrics.vocabulary.typeTokenRatio * 100
                          ).toFixed(1)}
                          %
                        </Text>{" "}
                        unique words ({sessionMetrics.vocabulary.uniqueWords} /{" "}
                        {sessionMetrics.vocabulary.totalWords} words).
                      </Text>
                      <Text
                        style={[styles.eduHint, { color: muted, marginTop: 6 }]}
                      >
                        Higher means less repetition and broader word choice.
                        Longer samples are more meaningful.
                      </Text>

                      <Text
                        style={[
                          styles.eduSubhead,
                          { color: textColor, marginTop: 18 },
                        ]}
                      >
                        This sample at a glance
                      </Text>
                      <Text style={[styles.findingItem, { color: textColor }]}>
                        Filler rate:{" "}
                        {sessionMetrics.fillerRatePercent.toFixed(1)}% of words
                        · Clean streak: {sessionMetrics.longestCleanStreak}{" "}
                        words · Pace consistency:{" "}
                        {sessionMetrics.paceConsistencyScore} / 100
                      </Text>
                      <Text
                        style={[styles.eduHint, { color: muted, marginTop: 6 }]}
                      >
                        Pace score uses how similar your sentence lengths are
                        (from punctuation)—a simple proxy when timing isn’t
                        available.
                      </Text>
                    </>
                  )}
                </>
              )}
            </View>
          ) : null}
        </ThemedView>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={[
              styles.button,
              styles.analyzeButton,
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleAnalyze}
            disabled={isLoading}
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

        <Pressable
          style={[styles.saveTranscriptBtn, isLoading && styles.buttonDisabled]}
          onPress={handleSaveToTranscriptOnly}
          disabled={isLoading}
        >
          <Text style={[styles.saveTranscriptBtnText, { color: textColor }]}>
            Save text to transcript (no AI)
          </Text>
        </Pressable>

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
        {!analysis && !isLoading && speechText && !error && (
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
  saveTranscriptBtn: {
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  saveTranscriptBtnText: {
    fontSize: 15,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  eduHint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  eduSubhead: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },
  heatmapRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  heatmapLabelCol: {
    width: 128,
    flexShrink: 0,
  },
  heatmapLabelText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  heatmapCount: {
    fontSize: 11,
    marginTop: 2,
  },
  heatmapTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  heatmapFill: {
    height: "100%",
    borderRadius: 5,
  },
  insightText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    fontStyle: "italic",
  },
  advHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 2,
  },
  advHeaderTextCol: {
    flex: 1,
  },
  advTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  advSubtitle: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  advChevron: {
    fontSize: 14,
    fontWeight: "600",
    paddingLeft: 8,
  },
  advBody: {
    marginTop: 14,
    paddingTop: 4,
  },
  advDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
  },
  advLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  advEmptyText: {
    fontSize: 14,
    lineHeight: 21,
  },
  pbGrid: {
    gap: 0,
  },
  pbRow: {
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.35)",
  },
  pbRowLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  pbLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  pbValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  pbNew: {
    color: "#10b981",
    fontWeight: "700",
  },
});
