import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  getFriendPublicProfileByEmail,
  type FriendPublicProfile,
} from "@/services/firebase";

const ACHIEVEMENT_LABELS: Record<string, string> = {
  first_step: "First Step",
  week_warrior: "Week Warrior",
  month_master: "Month Master",
  filler_fighter: "Filler Fighter",
  consistency_king: "Consistency King",
  perfect_practice: "Perfect Practice",
  speed_demon: "Speed Demon",
  milestone_50: "Golden Milestone",
  wordsmith_daily: "Wordsmith",
};

function toAchievementLabel(id: string): string {
  return ACHIEVEMENT_LABELS[id] || id.replace(/_/g, " ");
}

export default function FriendProfileScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const colorScheme = useColorScheme() ?? "light";
  const bg = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "icon");
  const cardBg = colorScheme === "dark" ? "#1c2124" : "#f0f4f8";
  const accent = colorScheme === "dark" ? "#7dd3fc" : "#0369a1";
  const accentSoft = colorScheme === "dark" ? "#164e63" : "#bae6fd";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<FriendPublicProfile | null>(null);

  const normalizedEmail = useMemo(
    () => (typeof email === "string" ? email.trim().toLowerCase() : ""),
    [email],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!normalizedEmail) {
        setError("Missing friend email.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await getFriendPublicProfileByEmail(normalizedEmail);
        if (cancelled) return;

        if (!result) {
          setError("Could not find this friend profile.");
          setProfile(null);
          return;
        }

        setProfile(result);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load profile.",
        );
        setProfile(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [normalizedEmail]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: bg }]}
      edges={["top"]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              {
                borderColor: accentSoft,
                backgroundColor:
                  accentSoft + (colorScheme === "dark" ? "55" : "99"),
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <ThemedText style={[styles.backButtonText, { color: accent }]}>
              Back
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText type="title" style={styles.title}>
          Friend Profile
        </ThemedText>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={accent} />
            <ThemedText style={[styles.helperText, { color: muted }]}>
              Loading friend data...
            </ThemedText>
          </View>
        ) : null}

        {!loading && error ? (
          <ThemedView
            style={[
              styles.card,
              { backgroundColor: cardBg, borderColor: accentSoft },
            ]}
          >
            <ThemedText style={[styles.errorText, { color: "#dc2626" }]}>
              {error}
            </ThemedText>
          </ThemedView>
        ) : null}

        {!loading && profile ? (
          <>
            <ThemedView
              style={[
                styles.card,
                { backgroundColor: cardBg, borderColor: accentSoft },
              ]}
            >
              <ThemedText style={styles.username}>
                {profile.username}
              </ThemedText>
              <ThemedText style={[styles.helperText, { color: muted }]}>
                {profile.email}
              </ThemedText>
            </ThemedView>

            <ThemedView
              style={[
                styles.card,
                { backgroundColor: cardBg, borderColor: accentSoft },
              ]}
            >
              <ThemedText style={styles.sectionTitle}>Stats</ThemedText>
              <View style={styles.statRow}>
                <ThemedText style={[styles.statLabel, { color: muted }]}>
                  Current streak
                </ThemedText>
                <ThemedText style={[styles.statValue, { color: text }]}>
                  {profile.progress.currentStreak}
                </ThemedText>
              </View>
              <View style={styles.statRow}>
                <ThemedText style={[styles.statLabel, { color: muted }]}>
                  Longest streak
                </ThemedText>
                <ThemedText style={[styles.statValue, { color: text }]}>
                  {profile.progress.longestStreak}
                </ThemedText>
              </View>
              <View style={styles.statRow}>
                <ThemedText style={[styles.statLabel, { color: muted }]}>
                  Practice days
                </ThemedText>
                <ThemedText style={[styles.statValue, { color: text }]}>
                  {profile.progress.totalPracticeDays}
                </ThemedText>
              </View>
              <View style={styles.statRow}>
                <ThemedText style={[styles.statLabel, { color: muted }]}>
                  Reward points
                </ThemedText>
                <ThemedText style={[styles.statValue, { color: text }]}>
                  {profile.progress.rewardPoints}
                </ThemedText>
              </View>
            </ThemedView>

            <ThemedView
              style={[
                styles.card,
                { backgroundColor: cardBg, borderColor: accentSoft },
              ]}
            >
              <ThemedText style={styles.sectionTitle}>
                Achievements ({profile.progress.achievements.length})
              </ThemedText>
              {profile.progress.achievements.length === 0 ? (
                <ThemedText style={[styles.helperText, { color: muted }]}>
                  No achievements unlocked yet.
                </ThemedText>
              ) : (
                <View style={styles.achievementList}>
                  {profile.progress.achievements.map((id) => (
                    <View
                      key={id}
                      style={[
                        styles.achievementChip,
                        { borderColor: accentSoft },
                      ]}
                    >
                      <ThemedText
                        style={[styles.achievementText, { color: accent }]}
                      >
                        {toAchievementLabel(id)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )}
            </ThemedView>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  backButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
  },
  loadingWrap: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  username: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  statValue: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  achievementList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  achievementChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  achievementText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
});
