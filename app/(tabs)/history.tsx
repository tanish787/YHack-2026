import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getCorrectionFocusTitle } from "@/constants/speech-coach";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  isFirebaseConfigured,
  subscribeSpeechAnalysisHistory,
  type SpeechAnalyticsHistoryRecord,
} from "@/services/firebase";

const CHART_MAX_BARS = 14;

function normalizeSeries(values: number[]): number[] {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return values.map(() => 0.35);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (max <= min) return values.map(() => 0.5);
  return values.map((v) =>
    Number.isFinite(v) ? (v - min) / (max - min) : 0.35,
  );
}

function MiniTrend({
  label,
  values,
  format,
  colorScheme,
  muted,
  accent,
}: {
  label: string;
  values: number[];
  format: (n: number) => string;
  colorScheme: "light" | "dark";
  muted: string;
  accent: string;
}) {
  const norms = normalizeSeries(values);
  const barBg = colorScheme === "dark" ? "#2b3139" : "#e5e7eb";
  return (
    <View style={styles.trendBlock}>
      <Text style={[styles.trendLabel, { color: muted }]}>{label}</Text>
      <View style={styles.trendBars}>
        {norms.map((h, i) => {
          const fillH = Math.round(8 + h * 56);
          return (
            <View
              key={i}
              style={[styles.trendBarTrack, { backgroundColor: barBg }]}
            >
              <View
                style={[
                  styles.trendBarFill,
                  { height: fillH, backgroundColor: accent },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.trendEnds}>
        <Text style={[styles.trendEndText, { color: muted }]}>
          {values.length ? format(values[0]) : "—"}
        </Text>
        <Text style={[styles.trendEndText, { color: muted }]}>→</Text>
        <Text style={[styles.trendEndText, { color: muted }]}>
          {values.length ? format(values[values.length - 1]) : "—"}
        </Text>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const bgColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const muted = useThemeColor({}, "icon");
  const tint = useThemeColor({}, "tint");
  const cardBg = colorScheme === "dark" ? "#1c2124" : "#f0f4f8";
  const accent = colorScheme === "dark" ? "#38bdf8" : "#0284c7";

  const [rows, setRows] = useState<SpeechAnalyticsHistoryRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setRows([]);
      setError(null);
      return;
    }
    return subscribeSpeechAnalysisHistory(
      (next) => {
        setRows(next);
        setError(null);
      },
      (err) => setError(err.message),
    );
  }, []);

  const chronological = useMemo(() => {
    return [...rows].sort((a, b) => a.createdAtMs - b.createdAtMs);
  }, [rows]);

  const chartSlice = useMemo(() => {
    const s = chronological.slice(-CHART_MAX_BARS);
    return s;
  }, [chronological]);

  const scoreSeries = useMemo(
    () => chartSlice.map((r) => r.overallScore),
    [chartSlice],
  );
  const fillerRateSeries = useMemo(
    () => chartSlice.map((r) => r.fillerRatePercent),
    [chartSlice],
  );
  const vaguenessSeries = useMemo(
    () => chartSlice.map((r) => r.vaguenessScore),
    [chartSlice],
  );
  const repetitionSeries = useMemo(
    () => chartSlice.map((r) => r.repetitionRatePercent),
    [chartSlice],
  );
  const wpmSeries = useMemo(
    () =>
      chartSlice.map((r) =>
        r.wordsPerMinute != null ? r.wordsPerMinute : NaN,
      ),
    [chartSlice],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
      <ScrollView
        style={[styles.container, { backgroundColor: bgColor }]}
        contentContainerStyle={styles.contentBottom}
      >
        <View style={styles.header}>
          <ThemedText style={[styles.kicker, { color: tint }]}>
            Name of Product
          </ThemedText>
          <ThemedText type="title">Session history</ThemedText>
          <ThemedText style={[styles.subtitle, { color: muted }]}>
            Metrics saved when you run Analyze Speech (no transcript in the
            cloud). Focus shows what you chose under What to correct.
          </ThemedText>
        </View>

        {!isFirebaseConfigured() ? (
          <ThemedView style={[styles.card, { backgroundColor: cardBg }]}>
            <Text style={[styles.body, { color: muted }]}>
              Add EXPO_PUBLIC_FIREBASE_* keys to .env and restart Expo to sync
              history.
            </Text>
          </ThemedView>
        ) : error ? (
          <ThemedView style={[styles.card, { backgroundColor: "#fee2e2" }]}>
            <Text style={[styles.body, { color: "#991b1b" }]}>{error}</Text>
          </ThemedView>
        ) : rows.length === 0 ? (
          <ThemedView style={[styles.card, { backgroundColor: cardBg }]}>
            <Text style={[styles.body, { color: muted }]}>
              No sessions yet. Run an analysis on the Analytics tab to record
              your first snapshot.
            </Text>
          </ThemedView>
        ) : (
          <>
            <ThemedView style={[styles.card, { backgroundColor: cardBg }]}>
              <ThemedText type="subtitle" style={styles.cardTitle}>
                Progress over time
              </ThemedText>
              <Text style={[styles.cardHint, { color: muted }]}>
                Oldest → newest (up to {CHART_MAX_BARS} sessions). Lower filler
                rate and vagueness are usually better; WPM is context-dependent.
              </Text>
              {chartSlice.length >= 2 ? (
                <View style={styles.trendGrid}>
                  <MiniTrend
                    label="Quality score"
                    values={scoreSeries}
                    format={(n) => `${Math.round(n)}`}
                    colorScheme={colorScheme}
                    muted={muted}
                    accent={tint}
                  />
                  <MiniTrend
                    label="Filler rate (% of words)"
                    values={fillerRateSeries}
                    format={(n) => `${n.toFixed(1)}%`}
                    colorScheme={colorScheme}
                    muted={muted}
                    accent="#f59e0b"
                  />
                  <MiniTrend
                    label="Vagueness (model 0–100)"
                    values={vaguenessSeries}
                    format={(n) => `${Math.round(n)}`}
                    colorScheme={colorScheme}
                    muted={muted}
                    accent="#a855f7"
                  />
                  <MiniTrend
                    label="Repetition burden"
                    values={repetitionSeries}
                    format={(n) => `${n.toFixed(1)}%`}
                    colorScheme={colorScheme}
                    muted={muted}
                    accent="#ef4444"
                  />
                  <MiniTrend
                    label="Words / min (when known)"
                    values={wpmSeries}
                    format={(n) =>
                      Number.isFinite(n) ? `${Math.round(n)}` : "—"
                    }
                    colorScheme={colorScheme}
                    muted={muted}
                    accent={accent}
                  />
                </View>
              ) : (
                <Text style={[styles.body, { color: muted }]}>
                  Add at least two analysis runs to see trend lines.
                </Text>
              )}
            </ThemedView>

            <ThemedText type="subtitle" style={styles.listHeading}>
              All sessions
            </ThemedText>
            {rows.map((row) => (
              <ThemedView
                key={row.id}
                style={[
                  styles.sessionCard,
                  {
                    backgroundColor: cardBg,
                    borderColor: muted + "33",
                  },
                ]}
              >
                <View style={styles.sessionTop}>
                  <Text style={[styles.sessionScore, { color: textColor }]}>
                    {row.overallScore}
                  </Text>
                  <View style={styles.sessionMetaCol}>
                    <Text style={[styles.sessionDate, { color: muted }]}>
                      {new Date(row.createdAtMs).toLocaleString()}
                    </Text>
                    <Text style={[styles.sessionFocus, { color: tint }]}>
                      Focus: {getCorrectionFocusTitle(row.correctionFocusId)}
                    </Text>
                  </View>
                </View>
                <View style={styles.metricsGrid}>
                  <MetricChip
                    label="Filler rate"
                    value={`${row.fillerRatePercent.toFixed(1)}%`}
                    sub={`${row.fillerCount} LLM hits · ${row.totalWordCount} words`}
                    textColor={textColor}
                    muted={muted}
                  />
                  <MetricChip
                    label="WPM"
                    value={
                      row.wordsPerMinute != null ? `${row.wordsPerMinute}` : "—"
                    }
                    sub="From segment timestamps when reliable"
                    textColor={textColor}
                    muted={muted}
                  />
                  <MetricChip
                    label="Vagueness"
                    value={`${row.vaguenessScore}`}
                    sub="0–100 (model)"
                    textColor={textColor}
                    muted={muted}
                  />
                  <MetricChip
                    label="Repetition"
                    value={`${row.repetitionRatePercent.toFixed(1)}%`}
                    sub="Repeated bigram burden"
                    textColor={textColor}
                    muted={muted}
                  />
                </View>
                {row.details ? (
                  <Text style={[styles.sessionDetails, { color: textColor }]}>
                    {row.details}
                  </Text>
                ) : null}
              </ThemedView>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricChip({
  label,
  value,
  sub,
  textColor,
  muted,
}: {
  label: string;
  value: string;
  sub: string;
  textColor: string;
  muted: string;
}) {
  return (
    <View style={styles.metricChip}>
      <Text style={[styles.metricLabel, { color: muted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: textColor }]}>{value}</Text>
      <Text style={[styles.metricSub, { color: muted }]}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentBottom: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  kicker: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  cardTitle: {
    marginBottom: 8,
  },
  cardHint: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  trendGrid: {
    gap: 18,
  },
  trendBlock: {
    gap: 8,
  },
  trendLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  trendBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 72,
    gap: 4,
  },
  trendBarTrack: {
    flex: 1,
    height: "100%",
    borderRadius: 4,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  trendBarFill: {
    width: "100%",
    borderRadius: 4,
    minHeight: 4,
  },
  trendEnds: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trendEndText: {
    fontSize: 11,
  },
  listHeading: {
    marginBottom: 12,
  },
  sessionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  sessionTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  sessionScore: {
    fontSize: 28,
    fontWeight: "800",
  },
  sessionMetaCol: {
    flex: 1,
    gap: 4,
  },
  sessionDate: {
    fontSize: 12,
  },
  sessionFocus: {
    fontSize: 14,
    fontWeight: "600",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricChip: {
    width: "47%",
    minWidth: 140,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 2,
  },
  metricSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  sessionDetails: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
});
