import type { CorrectionFocusId } from '@/constants/speech-coach';
import type { TranscriptSegment } from '@/context/transcript-context';
import type { SpeechAnalysisResult } from '@/services/llm-service';
import {
  fillerRatePercent,
  repetitionBurdenPercent,
} from '@/services/speech-metrics';
import { estimateWordsPerMinute } from '@/services/speech-session-metrics';
import type { SaveSpeechAnalysisInput } from '@/services/firebase/speech-analytics-history';

/**
 * Builds the Firebase payload for one analysis (no raw transcript stored).
 */
export function buildSpeechHistoryPayload(
  transcriptText: string,
  segments: TranscriptSegment[],
  correctionFocusId: CorrectionFocusId,
  analysis: SpeechAnalysisResult,
): SaveSpeechAnalysisInput {
  const { totalWords, wordsPerMinute } = estimateWordsPerMinute(
    transcriptText,
    segments,
  );
  const fillerRate = fillerRatePercent(transcriptText);
  const repetitionRate = repetitionBurdenPercent(transcriptText);

  return {
    overallScore: analysis.overall_score,
    details: analysis.details,
    fillers: analysis.fillers,
    vagueLanguage: analysis.vagueLanguage,
    suggestions: analysis.suggestions,
    vaguenessScore: analysis.vagueness_score,
    correctionFocusId,
    fillerRatePercent: Math.round(fillerRate * 10) / 10,
    fillerItemCount: analysis.fillers.length,
    totalWordCount: totalWords,
    wordsPerMinute,
    repetitionRatePercent: Math.round(repetitionRate * 10) / 10,
  };
}
