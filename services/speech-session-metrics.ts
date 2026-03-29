import type { TranscriptSegment } from '@/context/transcript-context';

const WORD_RE = /[a-zA-Z0-9']+/g;

export function countWordsInTranscript(text: string): number {
  const m = text.trim().match(WORD_RE);
  return m?.length ?? 0;
}

const MIN_SPAN_MS = 15_000;
const MIN_WORDS_FOR_WPM = 8;

/**
 * WPM from segment timestamps (first segment → last). Returns null when the
 * span is too short or there are too few words to be meaningful.
 */
export function estimateWordsPerMinute(
  transcriptText: string,
  segments: TranscriptSegment[],
): { totalWords: number; wordsPerMinute: number | null } {
  const totalWords = countWordsInTranscript(transcriptText);
  if (segments.length === 0) {
    return { totalWords, wordsPerMinute: null };
  }
  const times = segments.map((s) => s.createdAt);
  const spanMs = Math.max(...times) - Math.min(...times);
  if (spanMs < MIN_SPAN_MS || totalWords < MIN_WORDS_FOR_WPM) {
    return { totalWords, wordsPerMinute: null };
  }
  const minutes = spanMs / 60_000;
  const raw = totalWords / minutes;
  const wpm = Math.round(Math.min(350, Math.max(40, raw)));
  return { totalWords, wordsPerMinute: wpm };
}
