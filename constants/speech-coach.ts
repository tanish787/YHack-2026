export type CorrectionFocusId = "fillers" | "pacing" | "hedging" | "repetition";

export type PracticeContextId =
  | "presentation"
  | "interview"
  | "meeting"
  | "conversation";

export type CorrectionFocus = {
  id: CorrectionFocusId;
  title: string;
  subtitle: string;
};

export type PracticeContext = {
  id: PracticeContextId;
  title: string;
  subtitle: string;
};

export const CORRECTION_FOCUS_OPTIONS: CorrectionFocus[] = [
  {
    id: "fillers",
    title: "Filler words",
    subtitle: "Um, like, you know — casual habits",
  },
  {
    id: "pacing",
    title: "Speaking pace",
    subtitle: "Too fast or rushed delivery",
  },
  {
    id: "hedging",
    title: "Hedging & vague",
    subtitle: "“Kind of”, “maybe”, weak phrasing",
  },
  {
    id: "repetition",
    title: "Repetition",
    subtitle: "Saying the same idea twice",
  },
];

export const PRACTICE_CONTEXT_OPTIONS: PracticeContext[] = [
  {
    id: "presentation",
    title: "Presentation",
    subtitle: "Talks, demos, and speaking to a group",
  },
  {
    id: "interview",
    title: "Mock interview",
    subtitle: "Behavioral answers and clear storytelling",
  },
  {
    id: "meeting",
    title: "Work meeting",
    subtitle: "Updates, stakeholder Q&A, and concise points",
  },
  {
    id: "conversation",
    title: "Everyday conversation",
    subtitle: "Natural flow and clear communication",
  },
];
