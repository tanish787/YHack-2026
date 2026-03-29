import type { ImprovementGoalId, ProficiencyLevel } from '@/constants/user-profile';
import React, { createContext, useContext, useState } from 'react';

interface UserProfile {
  proficiencyLevel: ProficiencyLevel;
  improvementGoals: ImprovementGoalId[];
  age: number;
}

interface ProfileContextType {
  profile: UserProfile;
  setProficiencyLevel: (level: ProficiencyLevel) => void;
  setImprovementGoals: (goals: ImprovementGoalId[]) => void;
  toggleGoal: (goalId: ImprovementGoalId) => void;
  setAge: (age: number) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>({
    proficiencyLevel: 'intermediate',
    improvementGoals: ['fillers', 'descriptiveness'],
    age: 25,
  });

  const setProficiencyLevel = (level: ProficiencyLevel) => {
    setProfile((prev) => ({
      ...prev,
      proficiencyLevel: level,
    }));
  };

  const setImprovementGoals = (goals: ImprovementGoalId[]) => {
    setProfile((prev) => ({
      ...prev,
      improvementGoals: goals,
    }));
  };

  const toggleGoal = (goalId: ImprovementGoalId) => {
    setProfile((prev) => ({
      ...prev,
      improvementGoals: prev.improvementGoals.includes(goalId)
        ? prev.improvementGoals.filter((id) => id !== goalId)
        : [...prev.improvementGoals, goalId],
    }));
  };

  const setAge = (age: number) => {
    setProfile((prev) => ({
      ...prev,
      age: Math.max(1, Math.min(120, age)),
    }));
  };

  return (
    <ProfileContext.Provider
      value={{
        profile,
        setProficiencyLevel,
        setImprovementGoals,
        toggleGoal,
        setAge,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
}
