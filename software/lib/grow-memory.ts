import type { GrowMemoryResult } from './types';

const fallbackLines = [
  '原来值得留下的，常常就是这样安静的小事。',
  '这一刻没有消失，它只是换了一种方式陪着你。',
  '普通的一天，也会悄悄藏住让人安心的片刻。',
];

export function localFallback(originalText: string): GrowMemoryResult {
  const clean = originalText.trim().replace(/[。！？!?]+$/, '');
  const title = clean.length > 12 ? `${clean.slice(0, 12)}…` : clean;
  const hash = Array.from(clean).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return {
    title: title || '一枚被留下的时刻',
    echo: fallbackLines[hash % fallbackLines.length],
    visualSeed: {
      hue: 18 + (hash % 32),
      warmth: 0.68 + (hash % 20) / 100,
      softness: 0.78 + (hash % 14) / 100,
    },
    generatedBy: 'fallback',
  };
}

export async function growMemory(originalText: string, capturedAt: string): Promise<GrowMemoryResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch('/api/memories/grow', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ originalText, capturedAt }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Agent unavailable');
    return (await response.json()) as GrowMemoryResult;
  } catch {
    return localFallback(originalText);
  } finally {
    window.clearTimeout(timeout);
  }
}
