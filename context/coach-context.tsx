import type { CorrectionFocusId, PracticeContextId } from "@/constants/speech-coach";
import React, { createContext, useContext, useState } from "react";

interface CoachContextType {
  selectedFocus: CorrectionFocusId;
  setSelectedFocus: (focus: CorrectionFocusId) => void;
  selectedPracticeContext: PracticeContextId;
  setSelectedPracticeContext: (context: PracticeContextId) => void;
}

const CoachContext = createContext<CoachContextType | undefined>(undefined);

export function CoachProvider({ children }: { children: React.ReactNode }) {
  const [selectedFocus, setSelectedFocus] =
    useState<CorrectionFocusId>("fillers");
  const [selectedPracticeContext, setSelectedPracticeContext] =
    useState<PracticeContextId>("presentation");

  return (
    <CoachContext.Provider
      value={{
        selectedFocus,
        setSelectedFocus,
        selectedPracticeContext,
        setSelectedPracticeContext,
      }}
    >
      {children}
    </CoachContext.Provider>
  );
}

export function useCoachContext() {
  const context = useContext(CoachContext);
  if (!context) {
    throw new Error("useCoachContext must be used within CoachProvider");
  }
  return context;
}
