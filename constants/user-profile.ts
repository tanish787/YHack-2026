export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced' | 'native';

export interface ProficiencyLevelOption {
  id: ProficiencyLevel;
  label: string;
  description: string;
}

export const PROFICIENCY_LEVELS: ProficiencyLevelOption[] = [
  {
    id: 'beginner',
    label: 'Beginner',
    description: 'Just starting to learn English',
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    description: 'Can communicate in everyday situations',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'Fluent with nuanced understanding',
  },
  {
    id: 'native',
    label: 'Native/Near-Native',
    description: 'Native speaker or fluent equivalent',
  },
];

export type ImprovementGoalId = 'fillers' | 'formality' | 'descriptiveness' | 'repetition';

export interface ImprovementGoal {
  id: ImprovementGoalId;
  title: string;
  subtitle: string;
  description: string;
}

export const IMPROVEMENT_GOALS: ImprovementGoal[] = [
  {
    id: 'fillers',
    title: 'Eliminate Filler Words',
    subtitle: 'Reduce um, like, uh, etc.',
    description: 'Remove filler words like "um", "uh", "like"',
  },
  {
    id: 'formality',
    title: 'Improve Formality',
    subtitle: 'More professional tone',
    description: 'Communicate appropriately in formal settings',
  },
  {
    id: 'descriptiveness',
    title: 'Improve Descriptiveness',
    subtitle: 'Be more specific',
    description: 'Use specific language, avoid vague expressions',
  },
  {
    id: 'repetition',
    title: 'Avoid Repetition',
    subtitle: 'Say it once',
    description: 'Eliminate redundant phrases and repetition',
  },
];
