import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import {
    IMPROVEMENT_GOALS,
    PROFICIENCY_LEVELS,
    type ImprovementGoalId,
    type ProficiencyLevel,
} from '@/constants/user-profile';
import { useProfile } from '@/context/profile-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { profile, setProficiencyLevel, setAge, toggleGoal } = useProfile();

  const textColor = useThemeColor({}, 'text');
  const bg = useThemeColor({}, 'background');

  const isDark = colorScheme === 'dark';
  const accentColor = isDark ? '#7dd3fc' : '#0284c7';
  const cardBg = isDark ? '#1f2937' : '#f3f4f6';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const subText = isDark ? '#d1d5db' : '#6b7280';

  const selectProficiency = useCallback(
    (level: ProficiencyLevel) => {
      if (level === profile.proficiencyLevel) return;
      if (Platform.OS !== 'web') {
        void Haptics.selectionAsync();
      }
      setProficiencyLevel(level);
    },
    [profile.proficiencyLevel, setProficiencyLevel],
  );

  const handleToggleGoal = useCallback(
    (goalId: ImprovementGoalId) => {
      if (Platform.OS !== 'web') {
        void Haptics.selectionAsync();
      }
      toggleGoal(goalId);
    },
    [toggleGoal],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
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
            Tell us about yourself
          </ThemedText>
        </View>

        {/* Proficiency Level Section */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionLabel}>
            English Proficiency
          </ThemedText>
          {PROFICIENCY_LEVELS.map((level) => {
            const isSelected = profile.proficiencyLevel === level.id;
            return (
              <Pressable
                key={level.id}
                onPress={() => selectProficiency(level.id)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: isSelected ? accentColor : cardBg,
                    borderColor: isSelected ? accentColor : borderColor,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor: isSelected ? '#ffffff' : borderColor,
                      backgroundColor: isSelected ? '#ffffff' : 'transparent',
                    },
                  ]}
                >
                  {isSelected && (
                    <View
                      style={[
                        styles.radioDot,
                        { backgroundColor: accentColor },
                      ]}
                    />
                  )}
                </View>
                <View style={styles.textContainer}>
                  <ThemedText
                    style={[
                      styles.optionTitle,
                      { color: isSelected ? '#ffffff' : textColor },
                    ]}
                  >
                    {level.label}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.optionDescription,
                      { color: isSelected ? 'rgba(255,255,255,0.85)' : subText },
                    ]}
                  >
                    {level.description}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Age Section */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionLabel}>
            Your Age
          </ThemedText>
          <View style={[styles.ageCard, { backgroundColor: cardBg, borderColor }]}>
            {Platform.OS === 'web' ? (
              <>
                <input
                  type="range"
                  min="1"
                  max="120"
                  value={Math.round(profile.age)}
                  onChange={(e) => setAge(Number(e.target.value))}
                  style={{
                    width: '100%',
                    height: 6,
                    borderRadius: 3,
                    outline: 'none',
                    backgroundColor: borderColor,
                    accentColor: accentColor,
                  }}
                />
              </>
            ) : (
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={120}
                step={1}
                value={profile.age}
                onValueChange={(value) => setAge(value)}
                minimumTrackTintColor={accentColor}
                maximumTrackTintColor={borderColor}
                thumbTintColor={accentColor}
              />
            )}
            <View style={styles.ageDisplay}>
              <ThemedText style={[styles.ageValue, { color: accentColor }]}>
                {Math.round(profile.age)}
              </ThemedText>
              <ThemedText style={[styles.ageLabel, { color: subText }]}>
                years old
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Improvement Goals Section */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionLabel}>
            Improvement Goals
          </ThemedText>
          <ThemedText style={[styles.goalsHint, { color: subText }]}>
            Select the areas you want to focus on
          </ThemedText>
          {IMPROVEMENT_GOALS.map((goal) => {
            const isSelected = profile.improvementGoals.includes(goal.id);
            const isDisabled = !isSelected && profile.improvementGoals.length >= 4;
            return (
              <Pressable
                key={goal.id}
                onPress={() => handleToggleGoal(goal.id)}
                disabled={isDisabled && !isSelected}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: isSelected ? accentColor : cardBg,
                    borderColor: isSelected ? accentColor : borderColor,
                    opacity: pressed ? 0.85 : isDisabled && !isSelected ? 0.5 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: isSelected ? '#ffffff' : borderColor,
                      backgroundColor: isSelected ? accentColor : 'transparent',
                    },
                  ]}
                >
                  {isSelected && (
                    <ThemedText style={styles.checkmark}>✓</ThemedText>
                  )}
                </View>
                <View style={styles.textContainer}>
                  <ThemedText
                    style={[
                      styles.optionTitle,
                      { color: isSelected ? '#ffffff' : textColor },
                    ]}
                  >
                    {goal.title}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.optionDescription,
                      { color: isSelected ? 'rgba(255,255,255,0.85)' : subText },
                    ]}
                  >
                    {goal.subtitle}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
          {profile.improvementGoals.length > 0 && (
            <ThemedText style={[styles.selectedCount, { color: accentColor }]}>
              ✓ {profile.improvementGoals.length} goal selected
            </ThemedText>
          )}
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

  // Section
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 16,
    marginBottom: 12,
  },
  goalsHint: {
    fontSize: 13,
    marginBottom: 12,
  },

  // Option Button (Proficiency & Goals)
  option: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },

  // Radio Button
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Checkbox
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Text Container
  textContainer: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },

  // Age Section
  ageCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
  },
  slider: {
    width: '100%',
    height: 40,
    marginBottom: 16,
  },
  ageDisplay: {
    alignItems: 'center',
    gap: 4,
  },
  ageValue: {
    fontSize: 36,
    fontWeight: '700',
  },
  ageLabel: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Goals Section
  selectedCount: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
});
