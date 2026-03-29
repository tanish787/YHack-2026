export {
  clearUserSessionHistory,
  getFriendPublicProfileByEmail,
  getFriendPublicProfileByUid,
  resolveFriendPublicProfile,
  respondToFriendRequest,
  saveUserAccountProfile,
  saveUserProgress,
  saveUserSessionHistory,
  sendFriendRequestByEmail,
  subscribeUserFriends,
  subscribeUserProgress,
  subscribeUserSessionHistory,
  type FriendPublicProfile
} from "./account-data";
export { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from "./client";
export {
  ensureAnonymousFirebaseUser,
  saveSpeechAnalysisHistory,
  subscribeSpeechAnalysisHistory,
  type SaveSpeechAnalysisInput,
  type SpeechAnalyticsHistoryRecord
} from "./speech-analytics-history";

