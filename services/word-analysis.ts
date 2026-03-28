import { STOPWORDS } from '@/constants/stopwords';

export type WordFrequency = {
  word: string;
  count: number;
};

export type TopWordsOptions = {
  limit?: number;
  minLength?: number;
};

/**
 * Tokenize text, drop stop words, return sorted frequency list.
 */
export function getTopContentWords(text: string, options: TopWordsOptions = {}): WordFrequency[] {
  const limit = options.limit ?? 25;
  const minLength = options.minLength ?? 2;

  const normalized = text.toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ');
  const tokens = normalized.split(/\s+/).filter((t) => t.length >= minLength);

  const counts = new Map<string, number>();
  for (const raw of tokens) {
    const word = raw.replace(/^'+|'+$/g, '');
    if (word.length < minLength) continue;
    if (STOPWORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);
}
