/**
 * Web app config from Firebase Console → Project settings → Your apps → Web app.
 * Set in `.env` (see keys below). Expo inlines `EXPO_PUBLIC_*` at bundle time.
 */
export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

function trimEnv(v: string | undefined): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  const apiKey = trimEnv(process.env.EXPO_PUBLIC_FIREBASE_API_KEY);
  const authDomain = trimEnv(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN);
  const projectId = trimEnv(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID);
  const storageBucket = trimEnv(
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  );
  const messagingSenderId = trimEnv(
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  );
  const appId = trimEnv(process.env.EXPO_PUBLIC_FIREBASE_APP_ID);

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: storageBucket ?? '',
    messagingSenderId: messagingSenderId ?? '',
    appId,
  };
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseWebConfig() !== null;
}
