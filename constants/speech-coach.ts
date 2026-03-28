export type CorrectionFocusId = 'fillers' | 'pacing' | 'hedging' | 'repetition';

export type CorrectionFocus = {
  id: CorrectionFocusId;
  title: string;
  subtitle: string;
};

export const CORRECTION_FOCUS_OPTIONS: CorrectionFocus[] = [
  {
    id: 'fillers',
    title: 'Filler words',
    subtitle: 'Um, like, you know — casual habits',
  },
  {
    id: 'pacing',
    title: 'Speaking pace',
    subtitle: 'Too fast or rushed delivery',
  },
  {
    id: 'hedging',
    title: 'Hedging & vague',
    subtitle: '“Kind of”, “maybe”, weak phrasing',
  },
  {
    id: 'repetition',
    title: 'Repetition',
    subtitle: 'Saying the same idea twice',
  },
];
