import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState
} from "react";

import { useAuth } from "@/context/auth-context";
import { saveUserProgress, subscribeUserProgress } from "@/services/firebase";

export interface DailyEntry {
  date: string;
  practiceMinutes: number;
  analysisCount: number;
  averageFillers: number;
}

export interface FillerWordEntry {
  date: string;
  count: number;
}

export interface ProgressData {
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string | null;
  totalPracticeDays: number;
  fillerWordHistory: FillerWordEntry[];
  dailyEntries: DailyEntry[];
  achievements: string[];
  rewardPoints: number;
  claimedWordRewardDates: string[];
}

interface ProgressContextType {
  progress: ProgressData;
  ready: boolean;
  recordPractice: (minutes: number) => void;
  recordAnalysis: (fillerCount: number) => void;
  getFillerWordTrend: () => {
    current: number;
    previous: number;
    percentChange: number;
  };
  getStreakData: () => { current: number; longest: number; totalDays: number };
  addAchievement: (achievement: string) => void;
  hasClaimedWordReward: (date: string) => boolean;
  claimWordReward: (date: string, matchedWords: number) => number;
  checkAndUnlockAchievements: () => void;
}

const ProgressContext = createContext<ProgressContextType | undefined>(
  undefined,
);

const INITIAL_STATE: ProgressData = {
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

function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

function getYesterdayDateString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

function updateStreak(
  today: string,
  lastDate: string | null,
  currentStreak: number,
  longestStreak: number,
  totalDays: number,
): {
  newCurrentStreak: number;
  newLongestStreak: number;
  newTotalDays: number;
} {
  let newCurrentStreak = currentStreak;
  let newLongestStreak = longestStreak;
  let newTotalDays = totalDays;

  if (!lastDate) {
    // First time logging
    newCurrentStreak = 1;
    newLongestStreak = 1;
    newTotalDays = 1;
  } else if (lastDate === getYesterdayDateString()) {
    // Consecutive day
    newCurrentStreak = currentStreak + 1;
    newLongestStreak = Math.max(newCurrentStreak, longestStreak);
    newTotalDays = totalDays + 1;
  } else if (lastDate !== today) {
    // Streak broken, start new
    newCurrentStreak = 1;
    newTotalDays = totalDays + 1;
  }
  // If lastDate === today, no change needed

  return { newCurrentStreak, newLongestStreak, newTotalDays };
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { user, isAccountUser, loading } = useAuth();
  const [progress, setProgress] = useState<ProgressData>(INITIAL_STATE);
  const [ready, setReady] = useState(false);

  const persistProgress = useCallback(
    (nextProgress: ProgressData) => {
      if (!isAccountUser || !user) return;
      void saveUserProgress(user.uid, nextProgress).catch((error) => {
        console.warn("Failed to persist progress:", error);
      });
    },
    [isAccountUser, user],
  );

  useEffect(() => {
    if (loading) return;

    if (!isAccountUser || !user) {
      setProgress(INITIAL_STATE);
      setReady(true);
      return;
    }

    setReady(false);
    const unsubscribe = subscribeUserProgress(
      user.uid,
      (next) => {
        setProgress(next);
        setReady(true);
      },
      (error) => {
        console.warn("Progress sync failed:", error);
        setProgress(INITIAL_STATE);
        setReady(true);
      },
    );

    return unsubscribe;
  }, [isAccountUser, loading, user]);

  const recordPractice = (minutes: number) => {
    if (!isAccountUser || !user) return;

    const today = getTodayDateString();

    setProgress((prev) => {
      const { newCurrentStreak, newLongestStreak, newTotalDays } = updateStreak(
        today,
        prev.lastPracticeDate,
        prev.currentStreak,
        prev.longestStreak,
        prev.totalPracticeDays,
      );

      let dailyEntries = [...prev.dailyEntries];
      const todayEntryIndex = dailyEntries.findIndex((e) => e.date === today);

      if (todayEntryIndex >= 0) {
        const existingEntry = dailyEntries[todayEntryIndex];
        dailyEntries = [
          ...dailyEntries.slice(0, todayEntryIndex),
          {
            ...existingEntry,
            practiceMinutes: existingEntry.practiceMinutes + minutes,
          },
          ...dailyEntries.slice(todayEntryIndex + 1),
        ];
      } else {
        dailyEntries.push({
          date: today,
          practiceMinutes: minutes,
          analysisCount: 0,
          averageFillers: 0,
        });
      }

      const next = {
        ...prev,
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        lastPracticeDate: today,
        totalPracticeDays: newTotalDays,
        dailyEntries,
      };

      persistProgress(next);
      return next;
    });
  };

  const recordAnalysis = (fillerCount: number) => {
    if (!isAccountUser || !user) return;

    const today = getTodayDateString();

    setProgress((prev) => {
      // Update filler word history
      let fillerHistory = [...prev.fillerWordHistory];
      const fillerIndex = fillerHistory.findIndex((e) => e.date === today);

      if (fillerIndex >= 0) {
        fillerHistory[fillerIndex] = {
          ...fillerHistory[fillerIndex],
          count: fillerCount,
        };
      } else {
        fillerHistory.push({ date: today, count: fillerCount });
      }

      // Update daily entries
      let dailyEntries = [...prev.dailyEntries];
      const todayEntryIndex = dailyEntries.findIndex((e) => e.date === today);

      if (todayEntryIndex >= 0) {
        const existingEntry = dailyEntries[todayEntryIndex];
        const newAnalysisCount = existingEntry.analysisCount + 1;
        const newAverageFillers =
          existingEntry.analysisCount === 0
            ? fillerCount
            : (existingEntry.averageFillers * existingEntry.analysisCount +
                fillerCount) /
              newAnalysisCount;

        const updatedEntry: DailyEntry = {
          ...existingEntry,
          analysisCount: newAnalysisCount,
          averageFillers: newAverageFillers,
        };

        dailyEntries = [
          ...dailyEntries.slice(0, todayEntryIndex),
          updatedEntry,
          ...dailyEntries.slice(todayEntryIndex + 1),
        ];
      } else {
        dailyEntries.push({
          date: today,
          practiceMinutes: 0,
          analysisCount: 1,
          averageFillers: fillerCount,
        });
      }

      const next = {
        ...prev,
        fillerWordHistory: fillerHistory,
        dailyEntries,
      };

      persistProgress(next);
      return next;
    });
  };

  const getFillerWordTrend = () => {
    const history = progress.fillerWordHistory;
    if (history.length === 0) {
      return { current: 0, previous: 0, percentChange: 0 };
    }

    const current = history[history.length - 1]?.count || 0;
    const previous = history[history.length - 2]?.count || current;

    const percentChange =
      previous === 0 ? 0 : ((current - previous) / previous) * 100;

    return { current, previous, percentChange };
  };

  const getStreakData = () => {
    return {
      current: progress.currentStreak,
      longest: progress.longestStreak,
      totalDays: progress.totalPracticeDays,
    };
  };

  const addAchievement = (achievement: string) => {
    if (!isAccountUser || !user) return;

    setProgress((prev) => {
      if (prev.achievements.includes(achievement)) {
        return prev;
      }
      const next = {
        ...prev,
        achievements: [...prev.achievements, achievement],
      };
      persistProgress(next);
      return next;
    });
  };

  const hasClaimedWordReward = (date: string) => {
    return progress.claimedWordRewardDates.includes(date);
  };

  const claimWordReward = (date: string, matchedWords: number) => {
    if (!isAccountUser || !user) return 0;
    if (matchedWords <= 0) return 0;
    if (hasClaimedWordReward(date)) return 0;

    const points = matchedWords >= 3 ? 50 : matchedWords * 10;

    setProgress((prev) => {
      const next = {
        ...prev,
        rewardPoints: prev.rewardPoints + points,
        claimedWordRewardDates: [...prev.claimedWordRewardDates, date],
        achievements: prev.achievements.includes("wordsmith_daily")
          ? prev.achievements
          : [...prev.achievements, "wordsmith_daily"],
      };
      persistProgress(next);
      return next;
    });

    return points;
  };

  const checkAndUnlockAchievements = () => {
    const totalAnalyses = progress.dailyEntries.reduce(
      (sum, entry) => sum + entry.analysisCount,
      0,
    );
    const fillerTrend = getFillerWordTrend();

    // first_step: Complete your first analysis
    if (totalAnalyses >= 1 && !progress.achievements.includes("first_step")) {
      addAchievement("first_step");
    }

    // week_warrior: Maintain a 7-day streak
    if (
      progress.currentStreak >= 7 &&
      !progress.achievements.includes("week_warrior")
    ) {
      addAchievement("week_warrior");
    }

    // month_master: Maintain a 30-day streak
    if (
      progress.currentStreak >= 30 &&
      !progress.achievements.includes("month_master")
    ) {
      addAchievement("month_master");
    }

    // filler_fighter: Reduce filler words by 50%
    if (
      progress.fillerWordHistory.length >= 2 &&
      fillerTrend.percentChange < -50 &&
      !progress.achievements.includes("filler_fighter")
    ) {
      addAchievement("filler_fighter");
    }

    // consistency_king: Practice every day for 2 weeks
    if (
      progress.currentStreak >= 14 &&
      !progress.achievements.includes("consistency_king")
    ) {
      addAchievement("consistency_king");
    }

    // perfect_practice: Complete 10 analyses
    if (
      totalAnalyses >= 10 &&
      !progress.achievements.includes("perfect_practice")
    ) {
      addAchievement("perfect_practice");
    }

    // speed_demon: Complete 5 analyses in one day
    const todayEntries = progress.dailyEntries.find(
      (e) => e.date === getTodayDateString(),
    );
    if (
      todayEntries &&
      todayEntries.analysisCount >= 5 &&
      !progress.achievements.includes("speed_demon")
    ) {
      addAchievement("speed_demon");
    }

    // milestone_50: Complete 50 analyses
    if (
      totalAnalyses >= 50 &&
      !progress.achievements.includes("milestone_50")
    ) {
      addAchievement("milestone_50");
    }
  };

  return (
    <ProgressContext.Provider
      value={{
        progress,
        ready,
        recordPractice,
        recordAnalysis,
        getFillerWordTrend,
        getStreakData,
        addAchievement,
        hasClaimedWordReward,
        claimWordReward,
        checkAndUnlockAchievements,
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error("useProgress must be used within a ProgressProvider");
  }
  return context;
}
