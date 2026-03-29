import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

import {
  getFirebaseWebConfig,
  isFirebaseConfigured,
} from '@/config/firebase-env';

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;

function getOrInitApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (getApps().length > 0) {
    return getApps()[0]!;
  }
  const cfg = getFirebaseWebConfig();
  if (!cfg) return null;
  try {
    appInstance = initializeApp(cfg);
    return appInstance;
  } catch (e) {
    console.warn(
      '[Firebase] initializeApp failed — check EXPO_PUBLIC_FIREBASE_* in .env',
      e,
    );
    return null;
  }
}

/**
 * Firestore instance, or null if Firebase env is not set.
 */
export function getFirebaseDb(): Firestore | null {
  if (!isFirebaseConfigured()) return null;
  if (dbInstance) return dbInstance;
  const app = getOrInitApp();
  if (!app) return null;
  dbInstance = getFirestore(app);
  return dbInstance;
}

function authErrorCode(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    return String((e as { code: string }).code);
  }
  return '';
}

/**
 * Auth with AsyncStorage persistence on native. Never throws — failures degrade
 * to “no cloud history” instead of a red screen.
 */
export function getFirebaseAuth() {
  const app = getOrInitApp();
  if (!app) return null;

  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e: unknown) {
    if (authErrorCode(e) === 'auth/already-initialized') {
      try {
        return getAuth(app);
      } catch (e2) {
        console.warn('[Firebase] getAuth failed:', e2);
        return null;
      }
    }
    try {
      return getAuth(app);
    } catch (e2) {
      console.warn(
        '[Firebase] Auth init failed — anonymous sign-in / Firestore will be skipped',
        e,
      );
      return null;
    }
  }
}

export { isFirebaseConfigured };
