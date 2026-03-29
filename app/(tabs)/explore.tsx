import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/context/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  respondToFriendRequest,
  sendFriendRequestByEmail,
  subscribeUserFriends,
} from "@/services/firebase";
import type { UserFriendsState } from "@/services/firebase/account-data";

export default function FriendsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const router = useRouter();
  const { isAccountUser, loading, user } = useAuth();
  const muted = useThemeColor({}, "icon");
  const bg = useThemeColor({}, "background");
  const accent = colorScheme === "dark" ? "#7dd3fc" : "#0369a1";
  const accentSoft = colorScheme === "dark" ? "#164e63" : "#bae6fd";
  const [friendEmail, setFriendEmail] = useState("");
  const [friendsState, setFriendsState] = useState<UserFriendsState>({
    friends: [],
    incoming: [],
    outgoing: [],
  });
  const [saving, setSaving] = useState(false);

  const canAddFriend = useMemo(() => {
    if (!isAccountUser || !user) return false;
    const value = friendEmail.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }, [friendEmail, isAccountUser, user]);

  useEffect(() => {
    if (!isAccountUser || !user) {
      setFriendsState({ friends: [], incoming: [], outgoing: [] });
      return;
    }

    const unsubscribe = subscribeUserFriends(
      user.uid,
      user.email ?? null,
      (state) => setFriendsState(state),
      (error) => {
        console.warn("Failed to sync friends:", error);
        setFriendsState({ friends: [], incoming: [], outgoing: [] });
      },
    );

    return unsubscribe;
  }, [isAccountUser, user]);

  const handleAddFriend = useCallback(async () => {
    if (!isAccountUser || !user) {
      Alert.alert(
        "Create an account",
        "Sign up to add friends and compare progress.",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Sign up",
            onPress: () => {
              router.push("/(tabs)/profile");
            },
          },
        ],
      );
      return;
    }

    const email = friendEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert("Invalid email", "Enter a valid friend email address.");
      return;
    }

    if (user.email && email === user.email.toLowerCase()) {
      Alert.alert("Not allowed", "You cannot add yourself as a friend.");
      return;
    }

    if (friendsState.friends.some((item) => item.email === email)) {
      Alert.alert("Already added", "This friend is already in your list.");
      return;
    }

    setSaving(true);
    try {
      await sendFriendRequestByEmail(user.uid, user.email ?? "", email);
      setFriendEmail("");
      Alert.alert(
        "Request sent",
        `${email} will appear in your friends list after they accept.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not add friend.";
      Alert.alert("Could not add friend", message);
    } finally {
      setSaving(false);
    }
  }, [friendEmail, friendsState.friends, isAccountUser, router, user]);

  const handleRespond = useCallback(
    async (pairId: string, accept: boolean) => {
      if (!isAccountUser || !user) return;
      try {
        await respondToFriendRequest(
          user.uid,
          user.email ?? "",
          pairId,
          accept,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not update friend request.";
        Alert.alert("Friend request update failed", message);
      }
    },
    [isAccountUser, user],
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: bg }]}
      edges={["top"]}
    >
      <ScrollView
        style={styles.inner}
        contentContainerStyle={styles.innerContent}
      >
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
            <IconSymbol size={26} name="person.fill" color={accent} />
          </Pressable>
          <Image
            source={require("../../assets/images/SpeechTree.png")}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <ThemedText type="title" style={styles.headerTitle}>
            Friends
          </ThemedText>
        </View>
        <ThemedText style={[styles.p, { color: muted }]}>
          Follow your friends, keep each other accountable, and compare weekly
          speaking streaks.
        </ThemedText>

        {!loading && !isAccountUser ? (
          <ThemedView style={[styles.friendCard, { borderColor: accentSoft }]}>
            <ThemedText style={styles.friendName}>
              Sign up to add friends
            </ThemedText>
            <ThemedText style={[styles.friendMeta, { color: muted }]}>
              You need an account to use friends and leaderboard features.
            </ThemedText>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: accent,
                  opacity: pressed ? 0.85 : 1,
                  marginTop: 10,
                },
              ]}
              onPress={() => router.push("/(tabs)/profile")}
              accessibilityRole="button"
              accessibilityLabel="Go to sign up"
            >
              <ThemedText style={styles.primaryButtonText}>
                Go to Sign Up
              </ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}

        {isAccountUser ? (
          <ThemedView style={[styles.friendCard, { borderColor: accentSoft }]}>
            <ThemedText style={styles.friendName}>Add a friend</ThemedText>
            <TextInput
              value={friendEmail}
              onChangeText={setFriendEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="friend@email.com"
              placeholderTextColor={muted}
              style={[
                styles.friendInput,
                {
                  color: accent,
                  borderColor: accentSoft,
                  backgroundColor:
                    colorScheme === "dark" ? "#111827" : "#ffffff",
                },
              ]}
            />
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: canAddFriend ? accent : accentSoft,
                  opacity: pressed || saving || !canAddFriend ? 0.75 : 1,
                },
              ]}
              onPress={() => void handleAddFriend()}
              disabled={saving || !canAddFriend}
              accessibilityRole="button"
              accessibilityLabel="Add friend"
            >
              <ThemedText style={styles.primaryButtonText}>
                {saving ? "Adding..." : "Add Friend"}
              </ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}

        <ThemedView style={[styles.friendCard, { borderColor: accentSoft }]}>
          <ThemedText style={styles.friendName}>Your friends</ThemedText>
          {friendsState.friends.length === 0 ? (
            <ThemedText style={[styles.friendMeta, { color: muted }]}>
              No friends added yet.
            </ThemedText>
          ) : (
            <View style={styles.friendList}>
              {friendsState.friends.map((item) => (
                <Pressable
                  key={item.pairId}
                  onPress={() =>
                    router.push({
                      pathname: "/friend/[email]",
                      params: { email: item.email },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.email} profile`}
                  style={[
                    styles.friendChip,
                    {
                      borderColor: accentSoft,
                      backgroundColor: accentSoft + "44",
                    },
                  ]}
                >
                  <ThemedText
                    style={[styles.friendChipText, { color: accent }]}
                  >
                    {item.email}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          )}
        </ThemedView>

        <ThemedView style={[styles.friendCard, { borderColor: accentSoft }]}>
          <ThemedText style={styles.friendName}>Incoming requests</ThemedText>
          {friendsState.incoming.length === 0 ? (
            <ThemedText style={[styles.friendMeta, { color: muted }]}>
              No incoming friend requests.
            </ThemedText>
          ) : (
            <View style={styles.friendList}>
              {friendsState.incoming.map((item) => (
                <View key={item.pairId} style={styles.requestRow}>
                  <ThemedText style={[styles.requestEmail, { color: accent }]}>
                    {item.email}
                  </ThemedText>
                  <View style={styles.requestActions}>
                    <Pressable
                      onPress={() => void handleRespond(item.pairId, true)}
                      style={({ pressed }) => [
                        styles.requestButton,
                        {
                          backgroundColor: accent,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <ThemedText style={styles.requestButtonText}>
                        Accept
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => void handleRespond(item.pairId, false)}
                      style={({ pressed }) => [
                        styles.requestButton,
                        {
                          backgroundColor:
                            colorScheme === "dark" ? "#7f1d1d" : "#991b1b",
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <ThemedText style={styles.requestButtonText}>
                        Decline
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ThemedView>

        <ThemedView style={[styles.friendCard, { borderColor: accentSoft }]}>
          <ThemedText style={styles.friendName}>Outgoing requests</ThemedText>
          {friendsState.outgoing.length === 0 ? (
            <ThemedText style={[styles.friendMeta, { color: muted }]}>
              No pending outgoing requests.
            </ThemedText>
          ) : (
            <View style={styles.friendList}>
              {friendsState.outgoing.map((item) => (
                <View
                  key={item.pairId}
                  style={[
                    styles.friendChip,
                    {
                      borderColor: accentSoft,
                      backgroundColor: accentSoft + "22",
                    },
                  ]}
                >
                  <ThemedText
                    style={[styles.friendChipText, { color: accent }]}
                  >
                    Pending: {item.email}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  inner: {
    flex: 1,
  },
  innerContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
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
  brandLogo: {
    width: "100%",
    maxWidth: 940,
    height: 256,
    marginBottom: -72,
    marginTop: -64,
    alignSelf: "flex-start",
    marginLeft: -64,
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
    width: 51,
    height: 51,
    backgroundColor: "transparent",
  },
  profileBtnFloating: {
    position: "absolute",
    top: 0,
    right: 16,
    zIndex: 2,
  },
  headerTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
  },
  p: { fontSize: 16, lineHeight: 24, marginBottom: 14 },
  friendCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  friendName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  friendMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  friendInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 10,
  },
  friendList: {
    marginTop: 8,
    gap: 8,
  },
  friendChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  friendChipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  requestRow: {
    paddingVertical: 6,
    gap: 8,
  },
  requestEmail: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
  },
  requestButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  requestButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  primaryButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
});
