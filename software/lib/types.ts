export type TraceState = 'unclaimed' | 'growing' | 'alive';

export type VisualSeed = {
  hue: number;
  warmth: number;
  softness: number;
};

export type Trace = {
  id: string;
  capturedAt: string;
  source: 'mock' | 'ble' | 'websocket' | 'showcase';
  hardwareEventId?: string;
  pebbleId?: string;
  pebbleLabel?: string;
  pebbleSlot?: number;
  light?: number;
  lightRaw?: number;
  motion?: number;
  profileId?: string;
  pressure?: {
    durationMs?: number;
    peak?: number;
  };
  state: TraceState;
  originalText?: string;
  title?: string;
  echo?: string;
  generatedBy?: 'agent' | 'fallback';
  visualSeed?: VisualSeed;
  feelingTags?: Array<'warm' | 'relaxed' | 'fun' | 'understood' | 'offended' | 'ignored' | 'wronged' | 'irritated' | 'unclear'>;
  relationTags?: Array<'friend' | 'family' | 'alone' | 'small_win'>;
  laterNotes?: Array<{
    id: string;
    text: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type CaptureEvent = {
  eventId: string;
  capturedAt: string;
  source: 'mock' | 'ble';
  durationMs?: number;
  pressurePeak?: number;
};

export type GrowMemoryResult = {
  title: string;
  echo: string;
  visualSeed: VisualSeed;
  generatedBy: 'agent' | 'fallback';
};
