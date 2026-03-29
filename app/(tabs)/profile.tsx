import { useCallback } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
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
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const { profile, setProficiencyLevel, setAge, toggleGoal } = useProfile();

  const textColor = useThemeColor({}, "text");
  const bg = useThemeColor({}, "background");

  const isDark = colorScheme === "dark";
  const accentColor = isDark ? "#7dd3fc" : "#0284c7";
  const successColor = isDark ? "#86efac" : "#22c55e";
  const subText = isDark ? "#d1d5db" : "#6b7280";
  const lockedColor = isDark ? "#4b5563" : "#9ca3af";

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
          <ThemedText style={[styles.kicker, { color: accentColor }]}>
            Name of Product
          </ThemedText>
          <ThemedText type="title" style={styles.heading}>
            Your Profile
          </ThemedText>
          <ThemedText style={[styles.subheading, { color: subText }]}>
            Customize your speech profile
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
  header: {
    marginBottom: 24,
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
    lineHeight: 22,
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
});
