import type { Persistence } from 'firebase/auth';

/**
 * firebase/auth typings target web; RN bundle includes this at runtime.
 */
declare module 'firebase/auth' {
  export function getReactNativePersistence(
    storage: {
      getItem(key: string): Promise<string | null>;
      setItem(key: string, value: string): Promise<void>;
      removeItem(key: string): Promise<void>;
    },
  ): Persistence;
}
