import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
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
import { useAuth } from "@/context/auth-context";
import { useProfile } from "@/context/profile-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { isFirebaseConfigured } from "@/services/firebase";

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const { profile, setProficiencyLevel, setAge, toggleGoal } = useProfile();
  const { user, isAccountUser, loading, signIn, signOut, signUp } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const firebaseReady = isFirebaseConfigured();

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

  const canSubmitAuth = useMemo(
    () => email.trim().length > 3 && password.length >= 6,
    [email, password],
  );

  const canSignUp = useMemo(
    () => canSubmitAuth && username.trim().length >= 2,
    [canSubmitAuth, username],
  );

  const handleSignUp = useCallback(async () => {
    if (!canSignUp || authBusy) return;
    setAuthBusy(true);
    try {
      await signUp(email.trim(), password, username.trim());
      Alert.alert("Welcome", "Your account is ready. Progress sync is on.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Sign up failed.";
      Alert.alert("Sign up failed", message);
    } finally {
      setAuthBusy(false);
    }
  }, [authBusy, canSignUp, email, password, signUp, username]);

  const handleSignIn = useCallback(async () => {
    if (!canSubmitAuth || authBusy) return;
    setAuthBusy(true);
    try {
      await signIn(email.trim(), password, username.trim());
      Alert.alert("Signed in", "Progress sync is on for this account.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Sign in failed.";
      Alert.alert("Sign in failed", message);
    } finally {
      setAuthBusy(false);
    }
  }, [authBusy, canSubmitAuth, email, password, signIn]);

  const handleSignOut = useCallback(async () => {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      await signOut();
      Alert.alert("Signed out", "Data sync is off until you sign in again.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Sign out failed.";
      Alert.alert("Sign out failed", message);
    } finally {
      setAuthBusy(false);
    }
  }, [authBusy, signOut]);

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
          <Image
            source={require("../../assets/images/SpeechTree.png")}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <ThemedText type="title" style={styles.heading}>
            Your Profile
          </ThemedText>
          <ThemedText style={[styles.subheading, { color: subText }]}>
            Customize your speech profile
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Account
          </ThemedText>

          {loading ? (
            <View style={styles.authLoadingRow}>
              <ActivityIndicator size="small" color={accentColor} />
              <ThemedText style={[styles.authStatus, { color: subText }]}>
                Checking account status...
              </ThemedText>
            </View>
          ) : isAccountUser && user ? (
            <View style={styles.authCard}>
              <ThemedText style={[styles.authStatus, { color: textColor }]}>
                Signed in as {user.email ?? "account user"}
              </ThemedText>
              <Pressable
                onPress={() => void handleSignOut()}
                style={({ pressed }) => [
                  styles.authPrimaryButton,
                  {
                    backgroundColor: isDark ? "#7f1d1d" : "#fee2e2",
                    borderColor: isDark ? "#ef4444" : "#fca5a5",
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                disabled={authBusy}
              >
                <ThemedText
                  style={[
                    styles.authPrimaryButtonText,
                    { color: isDark ? "#fecaca" : "#991b1b" },
                  ]}
                >
                  Sign out
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.authCard}>
              <ThemedText style={[styles.authStatus, { color: subText }]}>
                Create an account to save progress and session history in the
                cloud.
              </ThemedText>
              {!firebaseReady ? (
                <ThemedText style={[styles.authWarning, { color: "#ef4444" }]}>
                  Firebase is not configured. Add EXPO_PUBLIC_FIREBASE_* values
                  in your env before signing up.
                </ThemedText>
              ) : null}

              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Username"
                placeholderTextColor={subText}
                style={[
                  styles.authInput,
                  {
                    color: textColor,
                    borderColor: lockedColor,
                    backgroundColor: isDark ? "#111827" : "#ffffff",
                  },
                ]}
              />

              <ThemedText style={[styles.authHint, { color: subText }]}>
                Username is required for sign up. On sign in, it is optional.
              </ThemedText>

              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="Email"
                placeholderTextColor={subText}
                style={[
                  styles.authInput,
                  {
                    color: textColor,
                    borderColor: lockedColor,
                    backgroundColor: isDark ? "#111827" : "#ffffff",
                  },
                ]}
              />

              <TextInput
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                placeholder="Password (6+ characters)"
                placeholderTextColor={subText}
                style={[
                  styles.authInput,
                  {
                    color: textColor,
                    borderColor: lockedColor,
                    backgroundColor: isDark ? "#111827" : "#ffffff",
                  },
                ]}
              />

              <View style={styles.authButtonRow}>
                <Pressable
                  onPress={() => void handleSignUp()}
                  disabled={authBusy || !canSignUp || !firebaseReady}
                  style={({ pressed }) => [
                    styles.authPrimaryButton,
                    {
                      backgroundColor: accentColor,
                      borderColor: accentColor,
                      opacity: pressed || authBusy || !canSignUp ? 0.75 : 1,
                    },
                  ]}
                >
                  <ThemedText style={styles.authPrimaryButtonText}>
                    Sign up
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => void handleSignIn()}
                  disabled={authBusy || !canSubmitAuth || !firebaseReady}
                  style={({ pressed }) => [
                    styles.authSecondaryButton,
                    {
                      borderColor: accentColor,
                      opacity: pressed || authBusy || !canSubmitAuth ? 0.75 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.authSecondaryButtonText,
                      { color: accentColor },
                    ]}
                  >
                    Sign in
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          )}
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
    paddingHorizontal: 20,
    paddingTop: 12,
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
  brandLogo: {
    width: "100%",
    maxWidth: 940,
    height: 256,
    marginBottom: -72,
    marginTop: -64,
    alignSelf: "flex-start",
    marginLeft: -64,
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
  authCard: {
    gap: 10,
  },
  authStatus: {
    fontSize: 13,
    lineHeight: 18,
  },
  authWarning: {
    fontSize: 12,
    lineHeight: 16,
  },
  authHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  authLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  authInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 18,
  },
  authButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  authPrimaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  authPrimaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  authSecondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  authSecondaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
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
