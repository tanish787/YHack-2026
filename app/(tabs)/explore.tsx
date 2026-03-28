import { Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function AboutScreen() {
  const muted = useThemeColor({}, 'icon');
  const bg = useThemeColor({}, 'background');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
      <ThemedView style={styles.inner}>
        <ThemedText type="title" style={styles.title}>
          About
        </ThemedText>
        <ThemedText style={[styles.p, { color: muted }]}>
          This app helps you notice speaking habits in the moment—fillers, pace, hedging, and more—
          with quick, private feedback you can feel on your phone.
        </ThemedText>
        <ThemedText style={[styles.p, { color: muted }]}>
          {Platform.OS === 'web'
            ? 'On the web you can try the layout and controls. Full microphone coaching runs best on an iPhone with Expo or a development build.'
            : 'Use the Coach tab to start a session. Connect your speech pipeline to bump the “moments flagged” counter when the listener catches a slip.'}
        </ThemedText>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  title: { marginBottom: 16 },
  p: { fontSize: 16, lineHeight: 24, marginBottom: 14 },
});
