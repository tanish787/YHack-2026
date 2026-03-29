import { FILLER_WORDS } from '@/constants/fillers';

export type FillerBucket =
  | 'topic_transition'
  | 'after_question'
  | 'sentence_start'
  | 'mid_speech';

const BUCKET_LABELS: Record<FillerBucket, string> = {
  topic_transition: 'After a pause / new paragraph',
  after_question: 'Right after a question',
  sentence_start: 'Start of a sentence',
  mid_speech: 'Middle of a sentence',
};

export function normalizeWordToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^[^a-z0-9']+/, '')
    .replace(/[^a-z0-9']+$/, '');
}

export function isFillerToken(word: string): boolean {
  const w = normalizeWordToken(word);
  if (w.length < 2 && !['ah', 'eh', 'er', 'hm', 'uh', 'um', 'ok'].includes(w)) {
    return false;
  }
  return FILLER_WORDS.has(w);
}

const FILLER_PHRASES: [string, string][] = [
  ['you', 'know'],
  ['sort', 'of'],
  ['kind', 'of'],
];

/** If words[wi] starts a two-word filler phrase, returns 2; else 0. */
function phraseLenAt(words: string[], wi: number): 0 | 2 {
  if (wi + 1 >= words.length) return 0;
  const a = normalizeWordToken(words[wi]);
  const b = normalizeWordToken(words[wi + 1]);
  for (const [p1, p2] of FILLER_PHRASES) {
    if (a === p1 && b === p2) return 2;
  }
  return 0;
}

function isFillerAt(words: string[], wi: number): boolean {
  return phraseLenAt(words, wi) === 2 || isFillerToken(words[wi]);
}

/** Advance past one filler (including 2-word phrases). */
function fillerStep(words: string[], wi: number): number {
  const pl = phraseLenAt(words, wi);
  if (pl === 2) return 2;
  return 1;
}

/** Split transcript into paragraphs (topic / breath boundaries). */
function splitParagraphs(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  return t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

/**
 * Rough sentence split for spoken text; keeps fragments that lack punctuation as one unit.
 */
function splitSentences(paragraph: string): string[] {
  const p = paragraph.trim();
  if (!p) return [];
  const parts = p.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [p];
}

function tokenize(sentence: string): string[] {
  const out: string[] = [];
  const re = /[a-zA-Z0-9']+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentence)) !== null) {
    out.push(m[0]);
  }
  return out;
}

export type FillerHeatmapResult = {
  byBucket: Record<FillerBucket, number>;
  totalFillers: number;
  insight: string;
};

/**
 * Classify each filler by position: paragraph lead-in, after a question,
 * other sentence starts, or mid-sentence.
 */
export function analyzeFillerHeatmap(text: string): FillerHeatmapResult {
  const byBucket: Record<FillerBucket, number> = {
    topic_transition: 0,
    after_question: 0,
    sentence_start: 0,
    mid_speech: 0,
  };

  const paragraphs = splitParagraphs(text);
  if (paragraphs.length === 0) {
    return {
      byBucket,
      totalFillers: 0,
      insight:
        'Add speech text to see where fillers tend to show up—often at sentence starts or after questions.',
    };
  }

  for (const para of paragraphs) {
    const sentences = splitSentences(para);
    for (let s = 0; s < sentences.length; s++) {
      const words = tokenize(sentences[s]);
      const prev = s > 0 ? sentences[s - 1].trim() : '';
      const prevEndsQuestion = prev.endsWith('?');
      const isFirstInParagraph = s === 0;

      for (let wi = 0; wi < words.length; ) {
        if (!isFillerAt(words, wi)) {
          wi += 1;
          continue;
        }

        let bucket: FillerBucket;
        if (isFirstInParagraph && wi < 4) {
          bucket = 'topic_transition';
        } else if (prevEndsQuestion && wi < 4) {
          bucket = 'after_question';
        } else if (wi < 2) {
          bucket = 'sentence_start';
        } else {
          bucket = 'mid_speech';
        }
        byBucket[bucket]++;
        wi += fillerStep(words, wi);
      }
    }
  }

  const totalFillers = Object.values(byBucket).reduce((a, b) => a + b, 0);
  let insight =
    'No fillers matched our common list in this sample. Great—or try pasting more natural speech.';

  if (totalFillers > 0) {
    const ranked = (Object.keys(byBucket) as FillerBucket[])
      .map((k) => ({ k, n: byBucket[k] }))
      .sort((a, b) => b.n - a.n);
    const top = ranked[0];
    const pct = Math.round((top.n / totalFillers) * 100);

    if (top.k === 'topic_transition') {
      insight = `${pct}% of fillers here are right after a break or new paragraph. Try a silent breath before you start the next thought instead of filling the gap.`;
    } else if (top.k === 'after_question') {
      insight = `${pct}% show up just after a question—common when you’re buying time to think. Pause silently, then answer in one clear sentence.`;
    } else if (top.k === 'sentence_start') {
      insight = `${pct}% cluster at the start of sentences. Open with your main point; skip “um / so / well” as a warm-up.`;
    } else {
      insight = `${pct}% appear mid-sentence—often from uncertainty. Finish the thought, then revise specifics rather than hedging in the middle.`;
    }
  }

  return { byBucket, totalFillers, insight };
}

export type VocabularyStats = {
  /** Unique / total content words (0 if no words). */
  typeTokenRatio: number;
  uniqueWords: number;
  totalWords: number;
};

/**
 * Type-token ratio on word tokens (letters/digits/apostrophe). Case-insensitive.
 */
export function computeTypeTokenRatio(text: string): VocabularyStats {
  const re = /[a-zA-Z0-9']+/g;
  const seen = new Set<string>();
  let total = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const w = normalizeWordToken(m[0]);
    if (w.length === 0) continue;
    total++;
    seen.add(w);
  }
  const uniqueWords = seen.size;
  const typeTokenRatio = total > 0 ? uniqueWords / total : 0;
  return { typeTokenRatio, uniqueWords, totalWords: total };
}

/**
 * Longest run of consecutive word tokens with no filler (same token rules as heatmap).
 */
export function longestCleanStreakWords(text: string): number {
  const re = /[a-zA-Z0-9']+/g;
  const words: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    words.push(m[0]);
  }
  let best = 0;
  let cur = 0;
  for (let i = 0; i < words.length; ) {
    if (isFillerAt(words, i)) {
      best = Math.max(best, cur);
      cur = 0;
      i += fillerStep(words, i);
    } else {
      cur++;
      i += 1;
    }
  }
  return Math.max(best, cur);
}

/** Fillers per 100 words (2-word phrases count as 2 filler words). */
export function fillerRatePercent(text: string): number {
  const re = /[a-zA-Z0-9']+/g;
  const words: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    words.push(m[0]);
  }
  const total = words.length;
  if (total === 0) return 0;
  let fillers = 0;
  for (let i = 0; i < words.length; ) {
    if (!isFillerAt(words, i)) {
      i += 1;
      continue;
    }
    const step = fillerStep(words, i);
    fillers += step;
    i += step;
  }
  return (fillers / total) * 100;
}

/**
 * Pace proxy: lower coefficient of variation of sentence lengths → higher score.
 * Single-sentence samples return a neutral mid score.
 */
export function paceConsistencyScore(text: string): number {
  const paragraphs = splitParagraphs(text);
  const lengths: number[] = [];
  for (const para of paragraphs) {
    for (const sent of splitSentences(para)) {
      const n = tokenize(sent).length;
      if (n > 0) lengths.push(n);
    }
  }
  if (lengths.length < 2) return 55;

  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  if (mean <= 0) return 55;
  const variance =
    lengths.reduce((acc, x) => acc + (x - mean) ** 2, 0) / lengths.length;
  const sd = Math.sqrt(variance);
  const cv = sd / mean;
  const score = 100 / (1 + cv * 2);
  return Math.round(Math.min(100, Math.max(0, score)));
}

export type SessionSpeechMetrics = {
  fillerHeatmap: FillerHeatmapResult;
  vocabulary: VocabularyStats;
  fillerRatePercent: number;
  paceConsistencyScore: number;
  longestCleanStreak: number;
};

export function computeSessionSpeechMetrics(text: string): SessionSpeechMetrics {
  const trimmed = text.trim();
  return {
    fillerHeatmap: analyzeFillerHeatmap(trimmed),
    vocabulary: computeTypeTokenRatio(trimmed),
    fillerRatePercent: fillerRatePercent(trimmed),
    paceConsistencyScore: paceConsistencyScore(trimmed),
    longestCleanStreak: longestCleanStreakWords(trimmed),
  };
}

export function getFillerBucketLabel(bucket: FillerBucket): string {
  return BUCKET_LABELS[bucket];
}
