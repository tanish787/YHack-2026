import { useCallback, useEffect, useMemo } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import {
  IMPROVEMENT_GOALS,
  PROFICIENCY_LEVELS,
  type ImprovementGoalId,
  type ProficiencyLevel,
} from "@/constants/user-profile";
import { useProfile } from "@/context/profile-context";
import { useProgress } from "@/context/progress-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";

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
];

export default function ProgressScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const isVeryCompact = width < 350;
  const {
    progress,
    getFillerWordTrend,
    getStreakData,
    checkAndUnlockAchievements,
  } = useProgress();
  const { profile, setProficiencyLevel, setAge, toggleGoal } = useProfile();

  const textColor = useThemeColor({}, "text");
  const bg = useThemeColor({}, "background");

  const isDark = colorScheme === "dark";
  const accentColor = isDark ? "#7dd3fc" : "#0284c7";
  const successColor = isDark ? "#86efac" : "#22c55e";
  const warningColor = isDark ? "#fbbf24" : "#f59e0b";
  const subText = isDark ? "#d1d5db" : "#6b7280";
  const lockedColor = isDark ? "#4b5563" : "#9ca3af";

  const streakData = useMemo(() => getStreakData(), [getStreakData]);
  const fillerTrend = useMemo(() => getFillerWordTrend(), [getFillerWordTrend]);

  useEffect(() => {
    checkAndUnlockAchievements();
  }, [checkAndUnlockAchievements, progress]);

  const getFillerTrendIcon = useCallback(() => {
    if (fillerTrend.percentChange < -10) return "📉";
    if (fillerTrend.percentChange < 0) return "↘️";
    if (fillerTrend.percentChange > 10) return "📈";
    if (fillerTrend.percentChange > 0) return "↗️";
    return "→";
  }, [fillerTrend.percentChange]);

  const getTrendColor = useCallback(() => {
    if (fillerTrend.percentChange < 0) return successColor;
    if (fillerTrend.percentChange > 0) return warningColor;
    return subText;
  }, [fillerTrend.percentChange, successColor, warningColor, subText]);

  const getAchievementStatus = useCallback(
    (achievementId: string) => {
      return progress.achievements.includes(achievementId);
    },
    [progress.achievements],
  );

  const selectProficiency = useCallback(
    (level: ProficiencyLevel) => {
      if (level === profile.proficiencyLevel) return;
      setProficiencyLevel(level);
    },
    [profile.proficiencyLevel, setProficiencyLevel],
  );

  const adjustAge = useCallback(
    (delta: number) => {
      setAge(profile.age + delta);
    },
    [profile.age, setAge],
  );

  const toggleImprovementGoal = useCallback(
    (goalId: ImprovementGoalId) => {
      toggleGoal(goalId);
    },
    [toggleGoal],
  );

  const totalAnalyses = progress.dailyEntries.reduce(
    (sum, entry) => sum + entry.analysisCount,
    0,
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: bg }]}
      edges={["top"]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.heading}>
            Your Profile
          </ThemedText>
          <ThemedText style={[styles.subheading, { color: subText }]}>
            Customize your speech goals and track your journey
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            English Proficiency
          </ThemedText>
          <View style={styles.optionList}>
            {PROFICIENCY_LEVELS.map((level) => {
              const selected = profile.proficiencyLevel === level.id;
              return (
                <Pressable
                  key={level.id}
                  onPress={() => selectProficiency(level.id)}
                  style={({ pressed }) => [
                    styles.optionCard,
                    {
                      borderColor: selected ? accentColor : lockedColor,
                      backgroundColor: selected
                        ? isDark
                          ? "#103047"
                          : "#e0f2fe"
                        : "transparent",
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    style={[styles.optionTitle, { color: textColor }]}
                  >
                    {level.label}
                  </ThemedText>
                  <ThemedText
                    style={[styles.optionDescription, { color: subText }]}
                  >
                    {level.description}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Focus Goals
          </ThemedText>
          <View style={styles.optionList}>
            {IMPROVEMENT_GOALS.map((goal) => {
              const selected = profile.improvementGoals.includes(goal.id);
              return (
                <Pressable
                  key={goal.id}
                  onPress={() => toggleImprovementGoal(goal.id)}
                  style={({ pressed }) => [
                    styles.optionCard,
                    {
                      borderColor: selected ? successColor : lockedColor,
                      backgroundColor: selected
                        ? isDark
                          ? "#113024"
                          : "#dcfce7"
                        : "transparent",
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    style={[styles.optionTitle, { color: textColor }]}
                  >
                    {goal.title}
                  </ThemedText>
                  <ThemedText
                    style={[styles.optionDescription, { color: subText }]}
                  >
                    {goal.subtitle}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Age
          </ThemedText>
          <View style={styles.ageRow}>
            <Pressable
              onPress={() => adjustAge(-1)}
              style={({ pressed }) => [
                styles.ageButton,
                { borderColor: lockedColor, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <ThemedText style={[styles.ageButtonText, { color: textColor }]}>
                -
              </ThemedText>
            </Pressable>
            <View style={styles.ageValueWrap}>
              <ThemedText style={[styles.ageValue, { color: accentColor }]}>
                {Math.round(profile.age)}
              </ThemedText>
            </View>
            <Pressable
              onPress={() => adjustAge(1)}
              style={({ pressed }) => [
                styles.ageButton,
                { borderColor: lockedColor, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <ThemedText style={[styles.ageButtonText, { color: textColor }]}>
                +
              </ThemedText>
            </Pressable>
          </View>
          <ThemedText style={[styles.ageHint, { color: subText }]}>
            {Platform.OS === "web"
              ? "Use the buttons to adjust your age."
              : "Tap minus or plus to adjust your age."}
          </ThemedText>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsGrid}>
          {/* Streak */}
          <View
            style={[
              styles.statBox,
              isCompact && styles.statBoxCompact,
              isVeryCompact && styles.statBoxVeryCompact,
            ]}
          >
            <ThemedText style={[styles.statEmoji]}>🔥</ThemedText>
            <ThemedText style={[styles.statValue, { color: accentColor }]}>
              {streakData.current}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: subText }]}>
              Day Streak
            </ThemedText>
          </View>

          {/* Longest Streak */}
          <View
            style={[
              styles.statBox,
              isCompact && styles.statBoxCompact,
              isVeryCompact && styles.statBoxVeryCompact,
            ]}
          >
            <ThemedText style={[styles.statEmoji]}>📈</ThemedText>
            <ThemedText style={[styles.statValue, { color: successColor }]}>
              {streakData.longest}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: subText }]}>
              Longest Streak
            </ThemedText>
          </View>

          {/* Total Practices */}
          <View
            style={[
              styles.statBox,
              isCompact && styles.statBoxCompact,
              isVeryCompact && styles.statBoxVeryCompact,
            ]}
          >
            <ThemedText style={[styles.statEmoji]}>✨</ThemedText>
            <ThemedText style={[styles.statValue, { color: accentColor }]}>
              {streakData.totalDays}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: subText }]}>
              Days Practiced
            </ThemedText>
          </View>

          {/* Total Analyses */}
          <View
            style={[
              styles.statBox,
              isCompact && styles.statBoxCompact,
              isVeryCompact && styles.statBoxVeryCompact,
            ]}
          >
            <ThemedText style={[styles.statEmoji]}>📊</ThemedText>
            <ThemedText style={[styles.statValue, { color: successColor }]}>
              {totalAnalyses}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: subText }]}>
              Analyses Done
            </ThemedText>
          </View>
        </View>

        {/* Filler Word Improvement */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Filler Word Progress
          </ThemedText>
          <View style={styles.fillerRow}>
            <View style={styles.fillerCol}>
              <ThemedText style={[styles.fillerLabel, { color: subText }]}>
                Current
              </ThemedText>
              <ThemedText style={[styles.fillerValue, { color: accentColor }]}>
                {Math.round(fillerTrend.current)}
              </ThemedText>
            </View>
            <View style={styles.trendDisplay}>
              <ThemedText
                style={[styles.trendIcon, { color: getTrendColor() }]}
              >
                {getFillerTrendIcon()}
              </ThemedText>
              <ThemedText
                style={[styles.trendPercent, { color: getTrendColor() }]}
              >
                {fillerTrend.percentChange > 0 ? "+" : ""}
                {Math.round(fillerTrend.percentChange)}%
              </ThemedText>
            </View>
          </View>
          {fillerTrend.percentChange < 0 && (
            <ThemedText style={[styles.feedback, { color: successColor }]}>
              🎉 Excellent! Fewer fillers than last time!
            </ThemedText>
          )}
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Latest Sessions
          </ThemedText>
          {progress.dailyEntries.length === 0 ? (
            <ThemedText style={[styles.emptyState, { color: subText }]}>
              Start practicing to build your streak!
            </ThemedText>
          ) : (
            <View style={styles.activityList}>
              {progress.dailyEntries
                .slice(-5)
                .reverse()
                .map((entry) => (
                  <View key={entry.date} style={styles.activityRow}>
                    <ThemedText
                      style={[styles.activityDate, { color: subText }]}
                    >
                      {new Date(`${entry.date}T00:00:00`).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </ThemedText>
                    <View style={styles.activityStats}>
                      {entry.analysisCount > 0 && (
                        <ThemedText
                          style={[styles.activityTag, { color: successColor }]}
                        >
                          {entry.analysisCount}📝
                        </ThemedText>
                      )}
                      {entry.averageFillers > 0 && (
                        <ThemedText
                          style={[styles.activityTag, { color: warningColor }]}
                        >
                          {Math.round(entry.averageFillers)}💬
                        </ThemedText>
                      )}
                    </View>
                  </View>
                ))}
            </View>
          )}
        </View>

        {/* Achievements Grid */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            🏆 Achievements ({progress.achievements.length}/
            {ACHIEVEMENTS_CONFIG.length})
          </ThemedText>
          <View style={styles.achievementsGrid}>
            {ACHIEVEMENTS_CONFIG.map((achievement) => {
              const isUnlocked = getAchievementStatus(achievement.id);
              return (
                <View
                  key={achievement.id}
                  style={[
                    styles.achievementCard,
                    isCompact && styles.achievementCardCompact,
                    isVeryCompact && styles.achievementCardVeryCompact,
                    { opacity: isUnlocked ? 1 : 0.6 },
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
          </View>
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
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // Header
  header: {
    marginBottom: 24,
  },
  heading: {
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
  },

  // Stats Grid
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

  // Section
  section: {
    marginBottom: 28,
    gap: 12,
  },
  optionList: {
    gap: 10,
  },
  optionCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 4,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  optionDescription: {
    fontSize: 12,
    lineHeight: 18,
  },
  ageRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  ageButtonText: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24,
  },
  ageValueWrap: {
    minWidth: 72,
    alignItems: "center",
  },
  ageValue: {
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 38,
  },
  ageHint: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
    marginBottom: 8,
  },

  // Filler Row
  fillerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  fillerCol: {
    alignItems: "center",
    gap: 4,
  },
  fillerLabel: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  fillerValue: {
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 38,
  },
  trendDisplay: {
    alignItems: "center",
    gap: 4,
  },
  trendIcon: {
    fontSize: 32,
    lineHeight: 38,
  },
  trendPercent: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  feedback: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    marginTop: 8,
  },

  // Activity
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

  // Achievements
  achievementsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    columnGap: 10,
  },
  achievementCard: {
    width: "48%",
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 14,
    gap: 8,
  },
  achievementCardCompact: {
    width: "100%",
  },
  achievementCardVeryCompact: {
    width: "100%",
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
