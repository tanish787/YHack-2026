import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
    useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useProfile } from "@/context/profile-context";
import { useProgress } from "@/context/progress-context";
import { useTranscript } from "@/context/transcript-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
    generateDailyWordChallengeWords,
    validateDailyWordChallengeUsage,
} from "@/services/llm-service";

const ACHIEVEMENTS_CONFIG = [
  {
    id: "first_step",
    label: "First Step",
    description: "Complete your first analysis",
    icon: "🎯",
  },
  {
    id: "week_warrior",
    label: "Week Warrior",
    description: "Maintain a 7-day streak",
    icon: "⚡",
  },
  {
    id: "month_master",
    label: "Month Master",
    description: "Maintain a 30-day streak",
    icon: "🔥",
  },
  {
    id: "filler_fighter",
    label: "Filler Fighter",
    description: "Reduce filler words by 50%",
    icon: "🎖️",
  },
  {
    id: "consistency_king",
    label: "Consistency King",
    description: "Practice every day for 2 weeks",
    icon: "👑",
  },
  {
    id: "perfect_practice",
    label: "Perfect Practice",
    description: "Complete 10 analyses",
    icon: "✨",
  },
  {
    id: "speed_demon",
    label: "Speed Demon",
    description: "Complete 5 analyses in one day",
    icon: "🚀",
  },
  {
    id: "milestone_50",
    label: "Golden Milestone",
    description: "Complete 50 analyses",
    icon: "🏆",
  },
  {
    id: "wordsmith_daily",
    label: "Wordsmith",
    description: "Complete your daily word challenge",
    icon: "📚",
  },
];

const DAILY_WORD_BANK = [
  "concise",
  "impactful",
  "precise",
  "insightful",
  "compelling",
  "credible",
  "cohesive",
  "nuanced",
  "confident",
  "strategic",
  "perspective",
  "context",
  "clarify",
  "evidence",
  "intentional",
  "articulate",
  "focused",
  "practical",
  "relevant",
  "specific",
  "structure",
  "prioritize",
  "objective",
  "adaptable",
  "effective",
  "collaborative",
  "thoughtful",
  "consistent",
  "measurable",
  "actionable",
];

const DAILY_WORDS_STORAGE_PREFIX = "@speech_coach/daily_words/";
const DAILY_WORD_USAGE_STORAGE_PREFIX = "@speech_coach/daily_word_usage/";

function getDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getFallbackDailyWords(dateKey: string, count = 3): string[] {
  const words = [...DAILY_WORD_BANK];
  const seed = hashString(dateKey);
  const picks: string[] = [];

  let cursor = seed % words.length;
  while (picks.length < count && words.length > 0) {
    cursor = (cursor + 7) % words.length;
    picks.push(words.splice(cursor, 1)[0]);
    if (words.length > 0) {
      cursor %= words.length;
    }
  }

  return picks;
}

export default function ProgressScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const { profile } = useProfile();
  const { fullTranscript, archivedSessions } = useTranscript();
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const isVeryCompact = width < 350;

  const {
    progress,
    getStreakData,
    hasClaimedWordReward,
    claimWordReward,
    checkAndUnlockAchievements,
  } = useProgress();

  const textColor = useThemeColor({}, "text");
  const bg = useThemeColor({}, "background");

  const isDark = colorScheme === "dark";
  const accentColor = isDark ? "#7dd3fc" : "#0369a1";
  const accentSoft = isDark ? "#164e63" : "#bae6fd";
  const successColor = isDark ? "#86efac" : "#22c55e";
  const warningColor = isDark ? "#fbbf24" : "#f59e0b";
  const subText = isDark ? "#d1d5db" : "#6b7280";
  const lockedColor = isDark ? "#4b5563" : "#9ca3af";

  const streakData = useMemo(() => getStreakData(), [getStreakData]);
  const todayKey = useMemo(() => getDateKey(), []);
  const [dailyWords, setDailyWords] = useState<string[]>(() =>
    getFallbackDailyWords(todayKey),
  );
  const [matchedDailyWords, setMatchedDailyWords] = useState<string[]>([]);
  const [validatingDailyWords, setValidatingDailyWords] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const storageKey = `${DAILY_WORDS_STORAGE_PREFIX}${todayKey}`;

    const loadDailyWords = async () => {
      try {
        const cached = await AsyncStorage.getItem(storageKey);
        if (cached) {
          const parsed = JSON.parse(cached) as string[];
          if (
            Array.isArray(parsed) &&
            parsed.length >= 3 &&
            parsed.every((w) => typeof w === "string")
          ) {
            if (!cancelled) {
              setDailyWords(parsed.slice(0, 3));
            }
            return;
          }
        }

        const llmWords = await generateDailyWordChallengeWords(
          profile.proficiencyLevel,
          profile.improvementGoals,
          profile.age,
        );

        if (!cancelled) {
          setDailyWords(llmWords);
        }
        await AsyncStorage.setItem(storageKey, JSON.stringify(llmWords));
      } catch (error) {
        const fallback = getFallbackDailyWords(todayKey);
        if (!cancelled) {
          setDailyWords(fallback);
        }
      }
    };

    void loadDailyWords();

    return () => {
      cancelled = true;
    };
  }, [
    todayKey,
    profile.proficiencyLevel,
    profile.improvementGoals,
    profile.age,
  ]);

  const todaysTranscriptText = useMemo(() => {
    const todayArchived = archivedSessions
      .filter(
        (session) => getDateKey(new Date(session.archivedAt)) === todayKey,
      )
      .map((session) => session.transcript)
      .join(" ");

    return `${fullTranscript} ${todayArchived}`.toLowerCase();
  }, [archivedSessions, fullTranscript, todayKey]);

  const tokenMatchedDailyWords = useMemo(() => {
    const normalized = todaysTranscriptText.replace(/[^a-zA-Z\s']/g, " ");
    const tokenSet = new Set(normalized.split(/\s+/).filter(Boolean));
    return dailyWords.filter((word) => tokenSet.has(word.toLowerCase()));
  }, [dailyWords, todaysTranscriptText]);

  useEffect(() => {
    let cancelled = false;

    const validateUsage = async () => {
      if (dailyWords.length === 0) {
        setMatchedDailyWords([]);
        return;
      }

      if (tokenMatchedDailyWords.length === 0) {
        setMatchedDailyWords([]);
        return;
      }

      const sourceHash = hashString(
        `${todayKey}|${dailyWords.join(",")}|${todaysTranscriptText}`,
      ).toString();
      const storageKey = `${DAILY_WORD_USAGE_STORAGE_PREFIX}${todayKey}`;

      try {
        const cached = await AsyncStorage.getItem(storageKey);
        if (cached) {
          const parsed = JSON.parse(cached) as {
            sourceHash?: string;
            matchedWords?: string[];
          };
          if (
            parsed?.sourceHash === sourceHash &&
            Array.isArray(parsed.matchedWords)
          ) {
            if (!cancelled) {
              setMatchedDailyWords(
                parsed.matchedWords.filter((word) =>
                  tokenMatchedDailyWords.includes(word),
                ),
              );
            }
            return;
          }
        }

        if (!cancelled) {
          setValidatingDailyWords(true);
        }

        const earnedWords = await validateDailyWordChallengeUsage(
          todaysTranscriptText,
          dailyWords,
        );

        if (!cancelled) {
          const validatedWords = earnedWords.filter((word) =>
            tokenMatchedDailyWords.includes(word),
          );
          setMatchedDailyWords(validatedWords);
        }

        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify({
            sourceHash,
            matchedWords: earnedWords,
          }),
        );
      } catch {
        if (!cancelled) {
          setMatchedDailyWords([]);
        }
      } finally {
        if (!cancelled) {
          setValidatingDailyWords(false);
        }
      }
    };

    void validateUsage();

    return () => {
      cancelled = true;
    };
  }, [dailyWords, todayKey, todaysTranscriptText, tokenMatchedDailyWords]);

  const hasClaimedToday = hasClaimedWordReward(todayKey);
  const shouldShowClaimButton = matchedDailyWords.length > 0 || hasClaimedToday;
  const isClaimButtonDisabled =
    hasClaimedToday || matchedDailyWords.length === 0;

  useEffect(() => {
    checkAndUnlockAchievements();
  }, [checkAndUnlockAchievements, progress]);

  const getAchievementStatus = useCallback(
    (achievementId: string) => {
      return progress.achievements.includes(achievementId);
    },
    [progress.achievements],
  );

  const claimTodayWordReward = useCallback(() => {
    const points = claimWordReward(todayKey, matchedDailyWords.length);
    if (points <= 0) {
      Alert.alert(
        "No reward yet",
        "Use at least one challenge word today first.",
      );
      return;
    }
    Alert.alert(
      "Reward unlocked",
      `You earned ${points} points for today's word challenge.`,
    );
  }, [claimWordReward, matchedDailyWords.length, todayKey]);

  const showLongestStreak = useCallback(() => {
    Alert.alert(
      "Longest streak",
      `Your best run is ${streakData.longest} day${streakData.longest === 1 ? "" : "s"}.`,
    );
  }, [streakData.longest]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: bg }]}
      edges={["top"]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
            <IconSymbol size={17} name="person.fill" color={accentColor} />
          </Pressable>
          <ThemedText style={[styles.kicker, { color: accentColor }]}>
            Name of Product
          </ThemedText>
          <ThemedText type="title" style={styles.heading}>
            Your Progress
          </ThemedText>
          <ThemedText style={[styles.subheading, { color: subText }]}>
            Track your progress, activity, and achievements
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Daily Word Challenge
          </ThemedText>
          <ThemedText style={[styles.challengeHint, { color: subText }]}>
            Use these words naturally in your conversations today to earn
            rewards.
          </ThemedText>
          <View style={styles.challengeWordRow}>
            {dailyWords.map((word) => {
              const matched = matchedDailyWords.includes(word);
              return (
                <View
                  key={word}
                  style={[
                    styles.challengeWordChip,
                    {
                      borderColor: matched ? successColor : lockedColor,
                      backgroundColor: matched
                        ? isDark
                          ? "#113024"
                          : "#dcfce7"
                        : "transparent",
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.challengeWordText,
                      { color: matched ? successColor : textColor },
                    ]}
                  >
                    {word}
                  </ThemedText>
                </View>
              );
            })}
          </View>
          <ThemedText style={[styles.challengeMeta, { color: subText }]}>
            Progress: {matchedDailyWords.length}/{dailyWords.length} words used
            · Points: {progress.rewardPoints}
          </ThemedText>
          {validatingDailyWords ? (
            <ThemedText
              style={[styles.challengeValidationText, { color: subText }]}
            >
              Validating sentence usage...
            </ThemedText>
          ) : null}

          {shouldShowClaimButton ? (
            <Pressable
              onPress={claimTodayWordReward}
              disabled={isClaimButtonDisabled}
              style={({ pressed }) => [
                styles.challengeClaimBtn,
                {
                  backgroundColor: isClaimButtonDisabled
                    ? accentSoft + (isDark ? "66" : "99")
                    : accentColor,
                  borderColor: isClaimButtonDisabled ? accentSoft : accentColor,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.challengeClaimBtnText,
                  { color: isClaimButtonDisabled ? accentColor : "#ffffff" },
                ]}
              >
                {hasClaimedToday
                  ? "Reward claimed today"
                  : matchedDailyWords.length >= dailyWords.length
                    ? "Claim 50 points + Wordsmith badge"
                    : "Claim points for today's used words"}
              </ThemedText>
            </Pressable>
          ) : null}

          {hasClaimedToday ? (
            <ThemedText style={[styles.feedback, { color: successColor }]}>
              Nice work. Come back tomorrow for a fresh word set.
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.statsGrid}>
          <Pressable
            onPress={showLongestStreak}
            style={({ pressed }) => [
              styles.statBox,
              isCompact && styles.statBoxCompact,
              isVeryCompact && styles.statBoxVeryCompact,
              { opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Show longest streak"
          >
            <ThemedText style={styles.statEmoji}>🔥</ThemedText>
            <ThemedText style={[styles.statValue, { color: accentColor }]}>
              {streakData.current}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: subText }]}>
              Current Day Streak
            </ThemedText>
          </Pressable>

          <View
            style={[
              styles.statBox,
              isCompact && styles.statBoxCompact,
              isVeryCompact && styles.statBoxVeryCompact,
            ]}
          >
            <ThemedText style={styles.statEmoji}>✨</ThemedText>
            <ThemedText style={[styles.statValue, { color: accentColor }]}>
              {streakData.totalDays}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: subText }]}>
              Days Practiced
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            🏆 Achievements ({progress.achievements.length}/
            {ACHIEVEMENTS_CONFIG.length})
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.achievementsCarouselContent}
          >
            {ACHIEVEMENTS_CONFIG.map((achievement) => {
              const isUnlocked = getAchievementStatus(achievement.id);
              return (
                <View
                  key={achievement.id}
                  style={[
                    styles.achievementCard,
                    isCompact && styles.achievementCardCompact,
                    isVeryCompact && styles.achievementCardVeryCompact,
                    {
                      opacity: isUnlocked ? 1 : 0.6,
                      borderColor: isUnlocked
                        ? successColor + "55"
                        : lockedColor + "55",
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.achievementIcon,
                      {
                        fontSize: isUnlocked ? 40 : 32,
                        lineHeight: isUnlocked ? 48 : 40,
                      },
                    ]}
                  >
                    {achievement.icon}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.achievementName,
                      { color: isUnlocked ? textColor : lockedColor },
                    ]}
                  >
                    {achievement.label}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.achievementDesc,
                      { color: isUnlocked ? subText : lockedColor },
                    ]}
                  >
                    {achievement.description}
                  </ThemedText>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
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
  heading: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
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

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    columnGap: 10,
    marginBottom: 28,
  },
  statBox: {
    width: "48%",
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  statBoxCompact: {
    width: "100%",
  },
  statBoxVeryCompact: {
    width: "100%",
  },
  statEmoji: {
    fontSize: 28,
    lineHeight: 34,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
    textAlign: "center",
    flexShrink: 1,
  },

  section: {
    marginBottom: 28,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
    marginBottom: 8,
  },

  challengeHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  challengeWordRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  challengeWordChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  challengeWordText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  challengeMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  challengeValidationText: {
    fontSize: 12,
    lineHeight: 16,
  },
  challengeClaimBtn: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  challengeClaimBtnText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    textAlign: "center",
  },
  feedback: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    marginTop: 8,
  },

  emptyState: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: 20,
  },
  activityList: {
    gap: 12,
  },
  activityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  activityDate: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    minWidth: 50,
  },
  activityStats: {
    flexDirection: "row",
    gap: 12,
  },
  activityTag: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },

  achievementsCarouselContent: {
    paddingRight: 4,
    gap: 12,
  },
  achievementCard: {
    width: 200,
    minHeight: 170,
    alignItems: "center",
    justifyContent: "flex-start",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 14,
    gap: 8,
  },
  achievementCardCompact: {
    width: 190,
  },
  achievementCardVeryCompact: {
    width: 180,
  },
  achievementIcon: {
    fontWeight: "700",
    paddingTop: 2,
    paddingBottom: 2,
  },
  achievementName: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "center",
  },
  achievementDesc: {
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 16,
    textAlign: "center",
  },

  spacer: {
    height: 20,
  },
});
