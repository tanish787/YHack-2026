import { useCallback, useEffect, useMemo } from 'react';
import {
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useProgress } from '@/context/progress-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

const ACHIEVEMENTS_CONFIG = [
  { id: 'first_step', label: 'First Step', description: 'Complete your first analysis', icon: '🎯' },
  { id: 'week_warrior', label: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '⚡' },
  { id: 'month_master', label: 'Month Master', description: 'Maintain a 30-day streak', icon: '🔥' },
  { id: 'filler_fighter', label: 'Filler Fighter', description: 'Reduce filler words by 50%', icon: '🎖️' },
  { id: 'consistency_king', label: 'Consistency King', description: 'Practice every day for 2 weeks', icon: '👑' },
  { id: 'perfect_practice', label: 'Perfect Practice', description: 'Complete 10 analyses', icon: '✨' },
  { id: 'speed_demon', label: 'Speed Demon', description: 'Complete 5 analyses in one day', icon: '🚀' },
  { id: 'milestone_50', label: 'Golden Milestone', description: 'Complete 50 analyses', icon: '🏆' },
];

export default function ProgressScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { progress, getFillerWordTrend, getStreakData, checkAndUnlockAchievements } = useProgress();

  const textColor = useThemeColor({}, 'text');
  const bg = useThemeColor({}, 'background');

  const isDark = colorScheme === 'dark';
  const accentColor = isDark ? '#7dd3fc' : '#0284c7';
  const successColor = isDark ? '#86efac' : '#22c55e';
  const warningColor = isDark ? '#fbbf24' : '#f59e0b';
  const subText = isDark ? '#d1d5db' : '#6b7280';
  const lockedColor = isDark ? '#4b5563' : '#9ca3af';

  const streakData = useMemo(() => getStreakData(), [getStreakData]);
  const fillerTrend = useMemo(() => getFillerWordTrend(), [getFillerWordTrend]);

  useEffect(() => {
    checkAndUnlockAchievements();
  }, [checkAndUnlockAchievements, progress]);

  const getFillerTrendIcon = useCallback(() => {
    if (fillerTrend.percentChange < -10) return '📉';
    if (fillerTrend.percentChange < 0) return '↘️';
    if (fillerTrend.percentChange > 10) return '📈';
    if (fillerTrend.percentChange > 0) return '↗️';
    return '→';
  }, [fillerTrend.percentChange]);

  const getTrendColor = useCallback(() => {
    if (fillerTrend.percentChange < 0) return successColor;
    if (fillerTrend.percentChange > 0) return warningColor;
    return subText;
  }, [fillerTrend.percentChange, successColor, warningColor, subText]);

  const getAchievementStatus = useCallback((achievementId: string) => {
    return progress.achievements.includes(achievementId);
  }, [progress.achievements]);

  const totalAnalyses = progress.dailyEntries.reduce((sum, entry) => sum + entry.analysisCount, 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.heading}>
            Your Journey
          </ThemedText>
          <ThemedText style={[styles.subheading, { color: subText }]}>
            Keep practicing to unlock achievements
          </ThemedText>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsGrid}>
          {/* Streak */}
          <View style={styles.statBox}>
            <ThemedText style={[styles.statEmoji]}>🔥</ThemedText>
            <ThemedText style={[styles.statValue, { color: accentColor }]}>
              {streakData.current}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: subText }]}>
              Day Streak
            </ThemedText>
          </View>

          {/* Longest Streak */}
          <View style={styles.statBox}>
            <ThemedText style={[styles.statEmoji]}>📈</ThemedText>
            <ThemedText style={[styles.statValue, { color: successColor }]}>
              {streakData.longest}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: subText }]}>
              Longest Streak
            </ThemedText>
          </View>

          {/* Total Practices */}
          <View style={styles.statBox}>
            <ThemedText style={[styles.statEmoji]}>✨</ThemedText>
            <ThemedText style={[styles.statValue, { color: accentColor }]}>
              {streakData.totalDays}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: subText }]}>
              Days Practiced
            </ThemedText>
          </View>

          {/* Total Analyses */}
          <View style={styles.statBox}>
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
              <ThemedText style={[styles.fillerLabel, { color: subText }]}>Current</ThemedText>
              <ThemedText style={[styles.fillerValue, { color: accentColor }]}>
                {Math.round(fillerTrend.current)}
              </ThemedText>
            </View>
            <View style={styles.trendDisplay}>
              <ThemedText style={[styles.trendIcon, { color: getTrendColor() }]}>
                {getFillerTrendIcon()}
              </ThemedText>
              <ThemedText style={[styles.trendPercent, { color: getTrendColor() }]}>
                {fillerTrend.percentChange > 0 ? '+' : ''}
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
              {progress.dailyEntries.slice(-5).reverse().map((entry) => (
                <View key={entry.date} style={styles.activityRow}>
                  <ThemedText style={[styles.activityDate, { color: subText }]}>
                    {new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </ThemedText>
                  <View style={styles.activityStats}>
                    {entry.analysisCount > 0 && (
                      <ThemedText style={[styles.activityTag, { color: successColor }]}>
                        {entry.analysisCount}📝
                      </ThemedText>
                    )}
                    {entry.averageFillers > 0 && (
                      <ThemedText style={[styles.activityTag, { color: warningColor }]}>
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
            🏆 Achievements ({progress.achievements.length}/{ACHIEVEMENTS_CONFIG.length})
          </ThemedText>
          <View style={styles.achievementsGrid}>
            {ACHIEVEMENTS_CONFIG.map((achievement) => {
              const isUnlocked = getAchievementStatus(achievement.id);
              return (
                <View
                  key={achievement.id}
                  style={[
                    styles.achievementCard,
                    { opacity: isUnlocked ? 1 : 0.6 },
                  ]}
                >
                  <ThemedText style={[styles.achievementIcon, { fontSize: isUnlocked ? 40 : 32 }]}>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  statEmoji: {
    fontSize: 28,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Section
  section: {
    marginBottom: 28,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },

  // Filler Row
  fillerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  fillerCol: {
    alignItems: 'center',
    gap: 4,
  },
  fillerLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  fillerValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  trendDisplay: {
    alignItems: 'center',
    gap: 4,
  },
  trendIcon: {
    fontSize: 32,
  },
  trendPercent: {
    fontSize: 16,
    fontWeight: '700',
  },
  feedback: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
  },

  // Activity
  emptyState: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  activityList: {
    gap: 12,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  activityDate: {
    fontSize: 13,
    fontWeight: '500',
    minWidth: 50,
  },
  activityStats: {
    flexDirection: 'row',
    gap: 12,
  },
  activityTag: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Achievements
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievementCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  achievementIcon: {
    fontWeight: '700',
  },
  achievementName: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  achievementDesc: {
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
  },

  spacer: {
    height: 20,
  },
});
