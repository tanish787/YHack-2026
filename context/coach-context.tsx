import type { CorrectionFocusId } from '@/constants/speech-coach';
import React, { createContext, useContext, useState } from 'react';

interface CoachContextType {
  selectedFocus: CorrectionFocusId;
  setSelectedFocus: (focus: CorrectionFocusId) => void;
}

const CoachContext = createContext<CoachContextType | undefined>(undefined);

export function CoachProvider({ children }: { children: React.ReactNode }) {
  const [selectedFocus, setSelectedFocus] = useState<CorrectionFocusId>('fillers');

  return (
    <CoachContext.Provider value={{ selectedFocus, setSelectedFocus }}>
      {children}
    </CoachContext.Provider>
  );
}

export function useCoachContext() {
  const context = useContext(CoachContext);
  if (!context) {
    throw new Error('useCoachContext must be used within CoachProvider');
  }
  return context;
}
