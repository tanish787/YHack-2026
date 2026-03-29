import { useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";

export default function AboutScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const router = useRouter();
  const muted = useThemeColor({}, "icon");
  const bg = useThemeColor({}, "background");
  const accent = colorScheme === "dark" ? "#7dd3fc" : "#0369a1";
  const accentSoft = colorScheme === "dark" ? "#164e63" : "#bae6fd";

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: bg }]}
      edges={["top"]}
    >
      <ThemedView style={styles.inner}>
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
            <IconSymbol size={17} name="person.fill" color={accent} />
          </Pressable>
          <ThemedText style={[styles.kicker, { color: accent }]}>
            Name of Product
          </ThemedText>
          <ThemedText type="title" style={styles.headerTitle}>
            About
          </ThemedText>
        </View>
        <ThemedText style={[styles.p, { color: muted }]}>
          This app helps you notice speaking habits in the moment—fillers, pace,
          hedging, and more— with quick, private feedback you can feel on your
          phone.
        </ThemedText>
        <ThemedText style={[styles.p, { color: muted }]}>
          {Platform.OS === "web"
            ? "On the web you can try the layout and controls. Full microphone coaching runs best on an iPhone with Expo or a development build."
            : "Use the Coach tab to start a session. Connect your speech pipeline to bump the “moments flagged” counter when the listener catches a slip."}
        </ThemedText>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    position: "relative",
  },
  kicker: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  header: {
    marginBottom: 24,
    position: "relative",
  },
  profileBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 9999,
    width: 34,
    height: 34,
    backgroundColor: "transparent",
  },
  profileBtnFloating: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 2,
  },
  headerTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
  },
  p: { fontSize: 16, lineHeight: 24, marginBottom: 14 },
});
