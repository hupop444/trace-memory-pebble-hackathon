import type { Trace } from './types';

const TRACES_KEY = 'trace.memories.v1';

function tracesKey(profileId?: string) {
  return profileId ? `${TRACES_KEY}:${profileId}` : TRACES_KEY;
}

export function loadTraces(profileId?: string): Trace[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = window.localStorage.getItem(tracesKey(profileId));
    return value ? (JSON.parse(value) as Trace[]) : [];
  } catch {
    return [];
  }
}

export function saveTraces(traces: Trace[], profileId?: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(tracesKey(profileId), JSON.stringify(traces));
}
