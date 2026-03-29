import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  type Timestamp,
  where,
} from "firebase/firestore";

import type { ProgressData } from "@/context/progress-context";
import type { TranscriptArchiveSession } from "@/context/transcript-context";

import { getFirebaseDb, isFirebaseConfigured } from "./client";

type ProgressDoc = {
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string | null;
  totalPracticeDays: number;
  fillerWordHistory: Array<{ date: string; count: number }>;
  dailyEntries: Array<{
    date: string;
    practiceMinutes: number;
    analysisCount: number;
    averageFillers: number;
  }>;
  achievements: string[];
  rewardPoints: number;
  claimedWordRewardDates: string[];
  updatedAt?: unknown;
};

type AccountProfileDoc = {
  uid: string;
  email: string;
  username: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FriendPublicProfile = {
  uid: string;
  email: string;
  username: string;
  progress: ProgressData;
};

const EMPTY_PROGRESS: ProgressData = {
  currentStreak: 0,
  longestStreak: 0,
  lastPracticeDate: null,
  totalPracticeDays: 0,
  fillerWordHistory: [],
  dailyEntries: [],
  achievements: [],
  rewardPoints: 0,
  claimedWordRewardDates: [],
};

/** When Firestore has no account doc / email index yet — still show a friend card for demos. */
function buildMinimalFriendProfile(
  normalizedEmail: string,
  displayUid: string,
): FriendPublicProfile {
  const local = normalizedEmail.includes("@")
    ? normalizedEmail.split("@")[0]!
    : normalizedEmail;
  return {
    uid: displayUid,
    email: normalizedEmail,
    username: local || normalizedEmail,
    progress: { ...EMPTY_PROGRESS },
  };
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asDateString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function progressDocRef(uid: string) {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error("Firestore is not initialized");
  }
  return doc(db, "users", uid, "appData", "progress");
}

function sessionsDocRef(uid: string) {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error("Firestore is not initialized");
  }
  return doc(db, "users", uid, "appData", "sessionHistory");
}

function accountDocRef(uid: string) {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error("Firestore is not initialized");
  }
  return doc(db, "users", uid, "appData", "account");
}

function friendsDocRef(uid: string) {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error("Firestore is not initialized");
  }
  return doc(db, "users", uid, "appData", "friends");
}

function friendLinksCollection() {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error("Firestore is not initialized");
  }
  return collection(db, "friendLinks");
}

function friendLinkDocRef(pairId: string) {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error("Firestore is not initialized");
  }
  return doc(db, "friendLinks", pairId);
}

/** Sets `recipientUid` on accepted links so the requester can open the friend profile by uid. */
async function backfillRecipientUidOnAcceptedLinks(
  uid: string,
  normalizedEmail: string,
): Promise<void> {
  if (!normalizedEmail || !isFirebaseConfigured()) return;

  try {
    const q = query(
      friendLinksCollection(),
      where("recipientEmail", "==", normalizedEmail),
    );
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map((d) => {
        const data = d.data() as { status?: unknown; recipientUid?: unknown };
        if (data.status !== "accepted") {
          return Promise.resolve();
        }
        if (typeof data.recipientUid === "string" && data.recipientUid) {
          return Promise.resolve();
        }
        return setDoc(d.ref, { recipientUid: uid }, { merge: true });
      }),
    );
  } catch {
    // non-fatal — profile save should still succeed
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function makePairId(a: string, b: string): string {
  const [first, second] = [normalizeEmail(a), normalizeEmail(b)].sort();
  const safe = (value: string) => value.replace(/[^a-z0-9]/g, "_");
  return `${safe(first)}__${safe(second)}`;
}

export type FriendItem = {
  pairId: string;
  email: string;
  /** Other user’s Firebase uid when known (avoids email-only lookup). */
  uid?: string;
  updatedAtMs: number;
};

export type UserFriendsState = {
  friends: FriendItem[];
  incoming: FriendItem[];
  outgoing: FriendItem[];
};

function timestampToMs(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as Timestamp).toMillis === "function"
  ) {
    return (value as Timestamp).toMillis();
  }
  return Date.now();
}

function normalizeProgress(raw: unknown): ProgressData {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_PROGRESS };
  }

  const data = raw as Partial<ProgressDoc>;
  const fillerWordHistory = Array.isArray(data.fillerWordHistory)
    ? data.fillerWordHistory
        .filter(
          (entry): entry is { date: string; count: number } =>
            !!entry &&
            typeof entry.date === "string" &&
            typeof entry.count === "number",
        )
        .map((entry) => ({
          date: entry.date,
          count: entry.count,
        }))
    : [];

  const dailyEntries = Array.isArray(data.dailyEntries)
    ? data.dailyEntries
        .filter(
          (
            entry,
          ): entry is {
            date: string;
            practiceMinutes: number;
            analysisCount: number;
            averageFillers: number;
          } =>
            !!entry &&
            typeof entry.date === "string" &&
            typeof entry.practiceMinutes === "number" &&
            typeof entry.analysisCount === "number" &&
            typeof entry.averageFillers === "number",
        )
        .map((entry) => ({
          date: entry.date,
          practiceMinutes: entry.practiceMinutes,
          analysisCount: entry.analysisCount,
          averageFillers: entry.averageFillers,
        }))
    : [];

  return {
    currentStreak: asNumber(data.currentStreak),
    longestStreak: asNumber(data.longestStreak),
    lastPracticeDate: asDateString(data.lastPracticeDate),
    totalPracticeDays: asNumber(data.totalPracticeDays),
    fillerWordHistory,
    dailyEntries,
    achievements: Array.isArray(data.achievements)
      ? data.achievements.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    rewardPoints: asNumber(data.rewardPoints),
    claimedWordRewardDates: Array.isArray(data.claimedWordRewardDates)
      ? data.claimedWordRewardDates.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
  };
}

export function subscribeUserProgress(
  uid: string,
  onUpdate: (data: ProgressData) => void,
  onError?: (err: Error) => void,
): () => void {
  if (!isFirebaseConfigured()) {
    onUpdate({ ...EMPTY_PROGRESS });
    return () => {};
  }

  const ref = progressDocRef(uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onUpdate({ ...EMPTY_PROGRESS });
        return;
      }
      onUpdate(normalizeProgress(snap.data()));
    },
    (err) => {
      onError?.(err);
      onUpdate({ ...EMPTY_PROGRESS });
    },
  );
}

export async function saveUserProgress(
  uid: string,
  progress: ProgressData,
): Promise<void> {
  if (!isFirebaseConfigured()) return;

  await setDoc(
    progressDocRef(uid),
    {
      ...progress,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export function subscribeUserSessionHistory(
  uid: string,
  onUpdate: (sessions: TranscriptArchiveSession[]) => void,
  onError?: (err: Error) => void,
): () => void {
  if (!isFirebaseConfigured()) {
    onUpdate([]);
    return () => {};
  }

  const ref = sessionsDocRef(uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onUpdate([]);
        return;
      }

      const raw = snap.data() as { sessions?: unknown };
      const sessionsRaw = Array.isArray(raw.sessions) ? raw.sessions : [];

      const sessions = sessionsRaw
        .filter(
          (item): item is TranscriptArchiveSession =>
            !!item &&
            typeof item === "object" &&
            typeof (item as TranscriptArchiveSession).id === "string" &&
            ((item as TranscriptArchiveSession).reason === "live" ||
              (item as TranscriptArchiveSession).reason === "background") &&
            typeof (item as TranscriptArchiveSession).transcript === "string" &&
            Array.isArray((item as TranscriptArchiveSession).segments),
        )
        .map((item) => ({
          ...item,
          archivedAt: timestampToMs(item.archivedAt),
          segments: item.segments.filter(
            (segment) =>
              !!segment &&
              typeof segment.id === "string" &&
              typeof segment.text === "string" &&
              (segment.source === "listening" ||
                segment.source === "background" ||
                segment.source === "analytics") &&
              typeof segment.createdAt === "number",
          ),
        }))
        .sort((a, b) => b.archivedAt - a.archivedAt)
        .slice(0, 50);

      onUpdate(sessions);
    },
    (err) => {
      onError?.(err);
      onUpdate([]);
    },
  );
}

export async function saveUserSessionHistory(
  uid: string,
  sessions: TranscriptArchiveSession[],
): Promise<void> {
  if (!isFirebaseConfigured()) return;

  await setDoc(
    sessionsDocRef(uid),
    {
      sessions: sessions.slice(0, 50),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function clearUserSessionHistory(uid: string): Promise<void> {
  if (!isFirebaseConfigured()) return;
  await deleteDoc(sessionsDocRef(uid));
}

export async function saveUserAccountProfile(
  uid: string,
  email: string,
  username: string,
): Promise<void> {
  if (!isFirebaseConfigured()) return;

  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = username.trim();

  if (!normalizedEmail) {
    throw new Error("Missing email for account profile.");
  }

  if (!normalizedUsername) {
    throw new Error("Username is required.");
  }

  const existingSnap = await getDoc(accountDocRef(uid));
  const existing = existingSnap.exists()
    ? (existingSnap.data() as Partial<AccountProfileDoc>)
    : null;
  const nowIso = new Date().toISOString();

  await setDoc(
    accountDocRef(uid),
    {
      uid,
      email: normalizedEmail,
      username: normalizedUsername,
      createdAt:
        existing && typeof existing.createdAt === "string"
          ? existing.createdAt
          : nowIso,
      updatedAt: nowIso,
    },
    { merge: true },
  );

  await backfillRecipientUidOnAcceptedLinks(uid, normalizedEmail);
}

export function subscribeUserFriends(
  uid: string,
  userEmail: string | null,
  onUpdate: (state: UserFriendsState) => void,
  onError?: (err: Error) => void,
): () => void {
  if (!isFirebaseConfigured()) {
    onUpdate({ friends: [], incoming: [], outgoing: [] });
    return () => {};
  }

  const normalizedUserEmail = userEmail ? normalizeEmail(userEmail) : "";
  if (!normalizedUserEmail) {
    onUpdate({ friends: [], incoming: [], outgoing: [] });
    return () => {};
  }

  const mergeAndEmit = (
    byId: Map<string, Record<string, unknown>>,
    emit: (state: UserFriendsState) => void,
  ) => {
    const friends: FriendItem[] = [];
    const incoming: FriendItem[] = [];
    const outgoing: FriendItem[] = [];

    byId.forEach((data, pairId) => {
      const requesterEmail =
        typeof data.requesterEmail === "string"
          ? normalizeEmail(data.requesterEmail)
          : "";
      const recipientEmail =
        typeof data.recipientEmail === "string"
          ? normalizeEmail(data.recipientEmail)
          : "";
      const status = typeof data.status === "string" ? data.status : "pending";
      const requestedByUid =
        typeof data.requestedByUid === "string" ? data.requestedByUid : "";
      const updatedAtMs = timestampToMs(data.updatedAt);

      const otherEmail =
        requesterEmail === normalizedUserEmail
          ? recipientEmail
          : requesterEmail;
      if (!otherEmail) return;

      const recipientUid =
        typeof data.recipientUid === "string" ? data.recipientUid : "";
      let friendUid: string | undefined;
      if (status === "accepted") {
        if (normalizedUserEmail === requesterEmail) {
          friendUid = recipientUid || undefined;
        } else {
          friendUid = requestedByUid || undefined;
        }
      }

      const item: FriendItem = {
        pairId,
        email: otherEmail,
        uid: friendUid,
        updatedAtMs,
      };

      if (status === "accepted") {
        friends.push(item);
      } else if (status === "pending") {
        if (requestedByUid === uid) {
          outgoing.push(item);
        } else {
          incoming.push(item);
        }
      }
    });

    const sortByTime = (a: FriendItem, b: FriendItem) =>
      b.updatedAtMs - a.updatedAtMs;
    emit({
      friends: friends.sort(sortByTime),
      incoming: incoming.sort(sortByTime),
      outgoing: outgoing.sort(sortByTime),
    });
  };

  const docsById = new Map<string, Record<string, unknown>>();

  const emitState = () => {
    mergeAndEmit(docsById, onUpdate);
  };

  const requesterQ = query(
    friendLinksCollection(),
    where("requesterEmail", "==", normalizedUserEmail),
  );
  const recipientQ = query(
    friendLinksCollection(),
    where("recipientEmail", "==", normalizedUserEmail),
  );

  const unsubRequester = onSnapshot(
    requesterQ,
    (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "removed") {
          docsById.delete(change.doc.id);
        } else {
          docsById.set(change.doc.id, change.doc.data());
        }
      });
      emitState();
    },
    (err) => {
      onError?.(err);
      onUpdate({ friends: [], incoming: [], outgoing: [] });
    },
  );

  const unsubRecipient = onSnapshot(
    recipientQ,
    (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "removed") {
          docsById.delete(change.doc.id);
        } else {
          docsById.set(change.doc.id, change.doc.data());
        }
      });
      emitState();
    },
    (err) => {
      onError?.(err);
      onUpdate({ friends: [], incoming: [], outgoing: [] });
    },
  );

  return () => {
    unsubRequester();
    unsubRecipient();
  };
}

export async function sendFriendRequestByEmail(
  uid: string,
  userEmail: string,
  friendEmail: string,
): Promise<void> {
  if (!isFirebaseConfigured()) return;

  const requesterEmail = normalizeEmail(userEmail);
  const recipientEmail = normalizeEmail(friendEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    throw new Error("Please enter a valid email address.");
  }
  if (requesterEmail === recipientEmail) {
    throw new Error("You cannot add yourself as a friend.");
  }

  const pairId = makePairId(requesterEmail, recipientEmail);
  const ref = friendLinkDocRef(pairId);
  const existingSnap = await getDoc(ref);

  if (existingSnap.exists()) {
    const existing = existingSnap.data() as {
      status?: unknown;
      requestedByUid?: unknown;
      requesterEmail?: unknown;
      recipientEmail?: unknown;
    };
    const status =
      typeof existing.status === "string" ? existing.status : "pending";
    const requestedByUid =
      typeof existing.requestedByUid === "string"
        ? existing.requestedByUid
        : "";

    if (status === "accepted") {
      throw new Error("You are already friends.");
    }

    if (status === "pending" && requestedByUid === uid) {
      throw new Error("Friend request already sent.");
    }

    if (status === "pending" && requestedByUid !== uid) {
      await setDoc(
        ref,
        {
          status: "accepted",
          respondedByUid: uid,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      return;
    }
  }

  await setDoc(
    ref,
    {
      pairId,
      requesterEmail,
      recipientEmail,
      requestedByUid: uid,
      status: "pending",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function respondToFriendRequest(
  uid: string,
  userEmail: string,
  pairId: string,
  accept: boolean,
): Promise<void> {
  if (!isFirebaseConfigured()) return;

  const normalizedUserEmail = normalizeEmail(userEmail);
  const ref = friendLinkDocRef(pairId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Friend request was not found.");
  }

  const data = snap.data() as {
    recipientEmail?: unknown;
    status?: unknown;
    requestedByUid?: unknown;
  };

  const recipientEmail =
    typeof data.recipientEmail === "string"
      ? normalizeEmail(data.recipientEmail)
      : "";
  const status = typeof data.status === "string" ? data.status : "pending";
  const requestedByUid =
    typeof data.requestedByUid === "string" ? data.requestedByUid : "";

  if (recipientEmail !== normalizedUserEmail) {
    throw new Error("Only the recipient can respond to this request.");
  }

  if (status !== "pending") {
    throw new Error("This request is no longer pending.");
  }

  if (requestedByUid === uid) {
    throw new Error("You cannot respond to your own outgoing request.");
  }

  await setDoc(
    ref,
    {
      status: accept ? "accepted" : "rejected",
      respondedByUid: uid,
      ...(accept ? { recipientUid: uid } : {}),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function getFriendPublicProfileByUid(
  uid: string,
  fallbackEmail?: string,
): Promise<FriendPublicProfile | null> {
  if (!isFirebaseConfigured()) {
    return null;
  }

  const trimmed = uid.trim();
  if (!trimmed) {
    return null;
  }

  const accountSnap = await getDoc(accountDocRef(trimmed));
  if (!accountSnap.exists()) {
    const progressSnap = await getDoc(progressDocRef(trimmed));
    if (progressSnap.exists()) {
      const fe = fallbackEmail ? normalizeEmail(fallbackEmail) : "";
      return {
        uid: trimmed,
        email: fe,
        username: fe.includes("@")
          ? fe.split("@")[0]!
          : trimmed.slice(0, 8),
        progress: normalizeProgress(progressSnap.data()),
      };
    }
    if (fallbackEmail) {
      return buildMinimalFriendProfile(
        normalizeEmail(fallbackEmail),
        trimmed,
      );
    }
    return null;
  }

  const accountData = accountSnap.data() as Partial<AccountProfileDoc>;
  const normalizedEmail =
    typeof accountData.email === "string" && accountData.email
      ? normalizeEmail(accountData.email)
      : fallbackEmail
        ? normalizeEmail(fallbackEmail)
        : "";

  const progressSnap = await getDoc(progressDocRef(trimmed));
  const progress = progressSnap.exists()
    ? normalizeProgress(progressSnap.data())
    : { ...EMPTY_PROGRESS };

  const username =
    typeof accountData.username === "string" && accountData.username.trim()
      ? accountData.username.trim()
      : normalizedEmail || trimmed;

  return {
    uid: trimmed,
    email: normalizedEmail,
    username,
    progress,
  };
}

/**
 * Loads friend profile from Firestore, or returns a minimal placeholder so the UI
 * never dead-ends when account/email index data is missing (e.g. anonymous users).
 */
export async function resolveFriendPublicProfile(params: {
  email: string;
  uid?: string;
}): Promise<FriendPublicProfile> {
  const normalizedEmail = normalizeEmail(params.email);
  if (!normalizedEmail) {
    throw new Error("Missing friend email.");
  }

  const uid = params.uid?.trim();

  if (!isFirebaseConfigured() || !getFirebaseDb()) {
    return buildMinimalFriendProfile(normalizedEmail, uid || normalizedEmail);
  }

  try {
    if (uid) {
      const byUid = await getFriendPublicProfileByUid(uid, normalizedEmail);
      if (byUid) {
        return byUid;
      }
    }

    const byEmail = await getFriendPublicProfileByEmail(normalizedEmail);
    if (byEmail) {
      return byEmail;
    }
  } catch {
    // Network / Firestore errors — still show placeholder below
  }

  return buildMinimalFriendProfile(normalizedEmail, uid || normalizedEmail);
}

export async function getFriendPublicProfileByEmail(
  email: string,
): Promise<FriendPublicProfile | null> {
  if (!isFirebaseConfigured()) {
    return null;
  }

  const db = getFirebaseDb();
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  // users/{uid}/appData/account — only account docs store `email`.
  const accountQ = query(
    collectionGroup(db, "appData"),
    where("email", "==", normalizedEmail),
    limit(1),
  );
  const accountSnap = await getDocs(accountQ);
  if (accountSnap.empty) {
    return null;
  }

  const accountDoc = accountSnap.docs[0];
  const accountData = accountDoc.data() as Partial<AccountProfileDoc>;
  const ownerUid =
    typeof accountData.uid === "string" && accountData.uid
      ? accountData.uid
      : (accountDoc.ref.parent.parent?.id ?? "");

  if (!ownerUid) {
    return null;
  }

  const progressSnap = await getDoc(progressDocRef(ownerUid));
  const progress = progressSnap.exists()
    ? normalizeProgress(progressSnap.data())
    : { ...EMPTY_PROGRESS };

  const username =
    typeof accountData.username === "string" && accountData.username.trim()
      ? accountData.username.trim()
      : normalizedEmail;

  return {
    uid: ownerUid,
    email: normalizedEmail,
    username,
    progress,
  };
}
