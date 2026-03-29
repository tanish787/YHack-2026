import {
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  updateProfile,
  type User,
} from "firebase/auth";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getFirebaseAuth,
  isFirebaseConfigured,
  saveUserAccountProfile,
} from "@/services/firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isAccountUser: boolean;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string, username?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeAuthError(error: unknown): Error {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    switch (code) {
      case "auth/invalid-email":
        return new Error("Please enter a valid email address.");
      case "auth/weak-password":
        return new Error("Password must be at least 6 characters.");
      case "auth/email-already-in-use":
        return new Error("An account with this email already exists.");
      case "auth/operation-not-allowed":
        return new Error(
          "Email/password sign-in is disabled in Firebase. Enable it in Firebase Console -> Authentication -> Sign-in method.",
        );
      case "auth/network-request-failed":
        return new Error(
          "Network error. Check your internet connection and try again.",
        );
      case "auth/too-many-requests":
        return new Error(
          "Too many attempts. Please wait a minute and try again.",
        );
      case "auth/invalid-api-key":
        return new Error(
          "Firebase API key is invalid. Check EXPO_PUBLIC_FIREBASE_* values.",
        );
      case "auth/app-not-authorized":
        return new Error(
          "This app is not authorized for your Firebase project. Verify your Firebase app config.",
        );
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return new Error("Incorrect email or password.");
      default:
        return new Error(`Authentication failed (${code}).`);
    }
  }
  return error instanceof Error
    ? error
    : new Error("Authentication failed. Please try again.");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setUser(null);
      setLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setUser(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        setUser(nextUser);
        setLoading(false);
      },
      () => {
        setUser(null);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const isAccountUser = !!user && !user.isAnonymous;

    return {
      user,
      loading,
      isAccountUser,
      signUp: async (email: string, password: string, username: string) => {
        const auth = getFirebaseAuth();
        if (!auth) {
          throw new Error("Firebase authentication is not configured.");
        }

        const normalizedUsername = username.trim();
        if (!normalizedUsername) {
          throw new Error("Please enter a username.");
        }

        try {
          if (auth.currentUser?.isAnonymous) {
            await firebaseSignOut(auth);
          }
          const credential = await createUserWithEmailAndPassword(
            auth,
            email.trim(),
            password,
          );
          await updateProfile(credential.user, {
            displayName: normalizedUsername,
          });
          await saveUserAccountProfile(
            credential.user.uid,
            credential.user.email ?? email.trim(),
            normalizedUsername,
          );
        } catch (error) {
          throw normalizeAuthError(error);
        }
      },
      signIn: async (email: string, password: string, username?: string) => {
        const auth = getFirebaseAuth();
        if (!auth) {
          throw new Error("Firebase authentication is not configured.");
        }

        try {
          if (auth.currentUser?.isAnonymous) {
            await firebaseSignOut(auth);
          }
          const credential = await signInWithEmailAndPassword(
            auth,
            email.trim(),
            password,
          );
          const nextUsername = username?.trim();
          if (nextUsername) {
            if (credential.user.displayName !== nextUsername) {
              await updateProfile(credential.user, {
                displayName: nextUsername,
              });
            }
            await saveUserAccountProfile(
              credential.user.uid,
              credential.user.email ?? email.trim(),
              nextUsername,
            );
          }
        } catch (error) {
          throw normalizeAuthError(error);
        }
      },
      signOut: async () => {
        const auth = getFirebaseAuth();
        if (!auth) return;
        await firebaseSignOut(auth);
      },
    };
  }, [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
