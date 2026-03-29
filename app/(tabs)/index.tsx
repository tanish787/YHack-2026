import Slider from '@react-native-community/slider';
import { useAssemblyAiLive } from '@/src/liveFiller/useAssemblyAiLive';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  startMicPcmStream,
  type StopMicStream,
} from '@/src/liveFiller/mic';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  IMPROVEMENT_GOALS,
  PROFICIENCY_LEVELS,
  type ImprovementGoalId,
  type ProficiencyLevel,
} from '@/constants/user-profile';
import {
  CORRECTION_FOCUS_OPTIONS,
  type CorrectionFocusId,
} from '@/constants/speech-coach';
import { useCoachContext } from '@/context/coach-context';
import { useProfile } from '@/context/profile-context';
import { useTranscript } from '@/context/transcript-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { width } = useWindowDimensions();
  const isWide = width >= 520;
  const { profile, setProficiencyLevel, setAge, toggleGoal } = useProfile();
  const { selectedFocus, setSelectedFocus } = useCoachContext();
  const { segments, appendSegment } = useTranscript();

  const textColor = useThemeColor({}, 'text');
  const bg = useThemeColor({}, 'background');
  const tint = useThemeColor({}, 'tint');
  const muted = useThemeColor({}, 'icon');

  const isDark = colorScheme === 'dark';
  const accentColor = isDark ? '#7dd3fc' : '#0284c7';
  const cardBg = isDark ? '#1f2937' : '#f3f4f6';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const subText = isDark ? '#d1d5db' : '#6b7280';

  const surface = colorScheme === 'dark' ? '#1c2124' : '#f0f4f8';
  const surface2 = colorScheme === 'dark' ? '#252b30' : '#e2e8f0';
  const accent = colorScheme === 'dark' ? '#7dd3fc' : '#0369a1';
  const accentSoft = colorScheme === 'dark' ? '#164e63' : '#bae6fd';

  const [listening, setListening] = useState(false);
  const [mistakeCount, setMistakeCount] = useState(0);
  const stopMicRef = useRef<StopMicStream | null>(null);

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

  const onListeningChange = useCallback(
    async (next: boolean) => {
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(
          next
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light,
        );
      }

      if (next) {
        setMistakeCount(0);
        resetTranscript();

        try {
          await connect();
          stopMicRef.current = await startMicPcmStream(sendPcmChunk);
          setListening(true);
        } catch (err) {
          console.error('Failed to start listening:', err);
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
        if (chunk) {
          await appendSegment(chunk, 'listening');
        }
        setListening(false);
      }
    },
    [
      appendSegment,
      connect,
      disconnect,
      resetTranscript,
      sendPcmChunk,
      transcript,
    ],
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        (nextState === 'inactive' || nextState === 'background') &&
        listening
      ) {
        void onListeningChange(false);
      }
    });

    return () => {
      sub.remove();
    };
  }, [listening, onListeningChange]);

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

  const selectFocus = useCallback(
    (id: CorrectionFocusId) => {
      if (id === selectedFocus) return;
      if (Platform.OS !== 'web') {
        void Haptics.selectionAsync();
      }
      setSelectedFocus(id);
      if (listening) {
        setMistakeCount(0);
      }
    },
    [listening, selectedFocus, setSelectedFocus],
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

  const resetMistakes = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setMistakeCount(0);
  }, []);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: bg }]}
      edges={['top']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          isWide && styles.scrollWide,
          Platform.OS === 'web' && styles.scrollWeb,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ThemedView style={styles.inner}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.heading}>
              Your Profile
            </ThemedText>
            <ThemedText style={[styles.subheading, { color: subText }]}>
              Tell us about yourself
            </ThemedText>
          </View>

          <View style={styles.hero}>
            <ThemedText style={[styles.kicker, { color: accent }]}>
              Live coaching
            </ThemedText>
            <ThemedText type="title" style={styles.heroTitle}>
              Speech habits
            </ThemedText>
            <ThemedText style={[styles.heroSub, { color: muted }]}>
              Turn on listening when you&apos;re ready to practice. Haptic
              feedback can flag slips in real time once your speech layer is
              connected.
            </ThemedText>
          </View>

          <View style={[styles.coachCard, { backgroundColor: surface }]}>
            <View style={styles.listeningRow}>
              <View style={styles.listeningCopy}>
                <ThemedText
                  type="defaultSemiBold"
                  style={styles.listeningTitle}
                >
                  Coaching Mode
                </ThemedText>
                <ThemedText style={[styles.listeningHint, { color: muted }]}>
                  {listening
                    ? connected
                      ? 'Session in progress'
                      : 'Connecting...'
                    : 'Microphone idle'}
                </ThemedText>
              </View>
              <Switch
                value={listening}
                onValueChange={(v) => void onListeningChange(v)}
                trackColor={{ false: surface2, true: accentSoft }}
                thumbColor={listening ? accent : '#f4f4f5'}
                ios_backgroundColor={surface2}
                accessibilityLabel="Toggle active listening"
              />
            </View>
            {error ? (
              <ThemedText style={[styles.transcriptHint, { color: '#dc2626' }]}>
                Live error: {error}
              </ThemedText>
            ) : null}
            <ThemedText style={[styles.transcriptHint, { color: muted }]}>
              {connecting ? 'Connecting to live transcription...' : null}
              {connecting ? '\n' : ''}
              {segments.length > 0
                ? `${segments.length} segment${segments.length === 1 ? '' : 's'} saved · view full transcript on Analytics`
                : 'Saved segments show on the Analytics tab'}
            </ThemedText>
          </View>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            What to correct
          </ThemedText>
          <ThemedText style={[styles.sectionHint, { color: muted }]}>
            Choose the habit you want feedback on this session.
          </ThemedText>

          <View style={styles.focusGrid}>
            {CORRECTION_FOCUS_OPTIONS.map((opt) => {
              const selected = selectedFocus === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => selectFocus(opt.id)}
                  style={({ pressed }) => [
                    styles.focusCard,
                    {
                      backgroundColor: selected
                        ? accentSoft + (colorScheme === 'dark' ? '55' : 'cc')
                        : surface,
                      borderColor: selected ? accent : 'transparent',
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <ThemedText
                    type="defaultSemiBold"
                    style={styles.focusCardTitle}
                  >
                    {opt.title}
                  </ThemedText>
                  <ThemedText style={[styles.focusCardSub, { color: muted }]}>
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
                ? 'Live filler detections this session'
                : 'Start listening to begin a session'}
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
                        {
                          color: isSelected
                            ? 'rgba(255,255,255,0.85)'
                            : subText,
                        },
                      ]}
                    >
                      {level.description}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionLabel}>
              Your Age
            </ThemedText>
            <View
              style={[styles.ageCard, { backgroundColor: cardBg, borderColor }]}
            >
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

          <View style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionLabel}>
              Improvement Goals
            </ThemedText>
            <ThemedText style={[styles.goalsHint, { color: subText }]}>
              Select the areas you want to focus on
            </ThemedText>
            {IMPROVEMENT_GOALS.map((goal) => {
              const isSelected = profile.improvementGoals.includes(goal.id);
              const isDisabled =
                !isSelected && profile.improvementGoals.length >= 4;
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
                      opacity:
                        pressed ? 0.85 : isDisabled && !isSelected ? 0.5 : 1,
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
                        {
                          color: isSelected
                            ? 'rgba(255,255,255,0.85)'
                            : subText,
                        },
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
        </ThemedView>
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
  scrollWide: {
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  scrollWeb: {
    flexGrow: 1,
    minHeight: '100%',
  },
  inner: {
    flex: 1,
    paddingTop: 8,
  },
  header: {
    marginBottom: 24,
  },
  heading: {
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
  },
  hero: {
    marginBottom: 24,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroTitle: {
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 16,
    lineHeight: 24,
  },
  coachCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 28,
  },
  listeningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  sectionTitle: {
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  focusGrid: {
    gap: 12,
    marginBottom: 28,
  },
  focusCard: {
    borderRadius: 14,
    padding: 16,
    minHeight: 88,
    borderWidth: 2,
  },
  focusCardTitle: {
    fontSize: 17,
    marginBottom: 6,
  },
  focusCardSub: {
    fontSize: 14,
    lineHeight: 20,
  },
  mistakesSection: {
    marginBottom: 10,
  },
  mistakeCard: {
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    marginBottom: 28,
  },
  mistakeCount: {
    fontSize: 56,
    fontWeight: '700',
    lineHeight: 62,
    fontVariant: ['tabular-nums'],
  },
  mistakeLabel: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 320,
  },
  mistakeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    marginTop: 18,
  },
  textBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  textBtnLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
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
  option: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
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
  selectedCount: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
});
