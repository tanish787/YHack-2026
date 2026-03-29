import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTranscript } from '@/context/transcript-context';
import {
    CORRECTION_FOCUS_OPTIONS,
    type CorrectionFocusId,
} from '@/constants/speech-coach';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function CoachScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { width } = useWindowDimensions();
  const isWide = width >= 520;
  const { segments, appendSegment } = useTranscript();

  const tint = useThemeColor({}, 'tint');
  const muted = useThemeColor({}, 'icon');
  const bg = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');

  const surface = colorScheme === 'dark' ? '#1c2124' : '#f0f4f8';
  const surface2 = colorScheme === 'dark' ? '#252b30' : '#e2e8f0';
  const accent = colorScheme === 'dark' ? '#7dd3fc' : '#0369a1';
  const accentSoft = colorScheme === 'dark' ? '#164e63' : '#bae6fd';

  const [listening, setListening] = useState(false);
  const [focusId, setFocusId] = useState<CorrectionFocusId>('fillers');
  const [mistakeCount, setMistakeCount] = useState(0);
  /** Holds live or pasted speech until the session ends; replace with STT callbacks later. */
  const [listeningCapture, setListeningCapture] = useState('');

  const onListeningChange = useCallback(
    async (next: boolean) => {
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(
          next ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
        );
      }
      if (next) {
        setMistakeCount(0);
        setListeningCapture('');
      } else {
        const chunk = listeningCapture.trim();
        if (chunk) {
          await appendSegment(chunk, 'listening');
        }
        setListeningCapture('');
      }
      setListening(next);
    },
    [listeningCapture, appendSegment],
  );

  const selectFocus = useCallback(
    (id: CorrectionFocusId) => {
      if (id === focusId) return;
      if (Platform.OS !== 'web') {
        void Haptics.selectionAsync();
      }
      setFocusId(id);
      if (listening) {
        setMistakeCount(0);
      }
    },
    [focusId, listening],
  );

  const resetMistakes = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setMistakeCount(0);
  }, []);

  const simulateDetection = useCallback(() => {
    if (!listening) return;
    setMistakeCount((c) => c + 1);
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [listening]);

  const content = (
    <>
      <View style={styles.hero}>
        <ThemedText style={[styles.kicker, { color: accent }]}>Live coaching</ThemedText>
        <ThemedText type="title" style={styles.heroTitle}>
          Speech habits
        </ThemedText>
        <ThemedText style={[styles.heroSub, { color: muted }]}>
          Turn on listening when you&apos;re ready to practice. Haptic feedback can flag slips in real
          time once your speech layer is connected.
        </ThemedText>
      </View>

      <View style={[styles.card, { backgroundColor: surface }]}>
        <View style={styles.listeningRow}>
          <View style={styles.listeningCopy}>
            <ThemedText type="defaultSemiBold" style={styles.listeningTitle}>
              Active listening
            </ThemedText>
            <ThemedText style={[styles.listeningHint, { color: muted }]}>
              {listening ? 'Session in progress' : 'Microphone idle'}
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
        {listening ? (
          <TextInput
            style={[
              styles.captureInput,
              {
                color: textColor,
                backgroundColor: surface2,
                borderColor: colorScheme === 'dark' ? '#404854' : '#e5e7eb',
              },
            ]}
            placeholder="Transcript from the mic will appear here. Paste or type for now, then turn listening off to save."
            placeholderTextColor={muted}
            multiline
            value={listeningCapture}
            onChangeText={setListeningCapture}
            textAlignVertical="top"
          />
        ) : null}
        <ThemedText style={[styles.transcriptHint, { color: muted }]}>
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

      <View style={styles.optionGrid}>
        {CORRECTION_FOCUS_OPTIONS.map((opt) => {
          const selected = focusId === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => selectFocus(opt.id)}
              style={({ pressed }) => [
                styles.optionCard,
                {
                  backgroundColor: selected ? accentSoft + (colorScheme === 'dark' ? '55' : 'cc') : surface,
                  borderColor: selected ? accent : 'transparent',
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}>
              <ThemedText type="defaultSemiBold" style={styles.optionTitle}>
                {opt.title}
              </ThemedText>
              <ThemedText style={[styles.optionSub, { color: muted }]}>{opt.subtitle}</ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="subtitle" style={[styles.sectionTitle, styles.mistakesSection]}>
        Moments flagged
      </ThemedText>
      <View style={[styles.mistakeCard, { backgroundColor: surface }]}>
        <ThemedText style={[styles.mistakeCount, { color: accent }]}>{mistakeCount}</ThemedText>
        <ThemedText style={[styles.mistakeLabel, { color: muted }]}>
          {listening
            ? 'Detections this session (wire your recognizer to increment)'
            : 'Start listening to begin a session'}
        </ThemedText>
        <View style={styles.mistakeActions}>
          <Pressable
            onPress={resetMistakes}
            style={({ pressed }) => [
              styles.textBtn,
              { opacity: pressed ? 0.7 : mistakeCount === 0 ? 0.4 : 1 },
            ]}
            disabled={mistakeCount === 0}>
            <ThemedText style={[styles.textBtnLabel, { color: tint }]}>Reset count</ThemedText>
          </Pressable>
          {__DEV__ ? (
            <Pressable
              onPress={simulateDetection}
              style={({ pressed }) => [styles.textBtn, { opacity: pressed ? 0.7 : listening ? 1 : 0.35 }]}
              disabled={!listening}>
              <ThemedText style={[styles.textBtnLabel, { color: muted }]}>Test +1 (dev)</ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          isWide && styles.scrollWide,
          Platform.OS === 'web' && styles.scrollWeb,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
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
  card: {
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
  captureInput: {
    marginTop: 14,
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
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
    alignItems: 'center',
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
});
