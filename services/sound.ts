// Chat notification sound service.
// Built-in tones are synthesized with the Web Audio API (no asset files needed).
// Custom sounds are user-uploaded audio stored as base64 data URLs in AppSettings.

export interface BuiltinSound {
  id: string;
  name: string;
  // sequence of [frequency(Hz), startOffset(s), duration(s)]
  notes: [number, number, number][];
  type?: OscillatorType;
}

export const BUILTIN_SOUNDS: BuiltinSound[] = [
  { id: 'ding',   name: 'دینگ',    notes: [[880, 0, 0.18], [1320, 0.08, 0.22]], type: 'sine' },
  { id: 'pop',    name: 'پاپ',     notes: [[520, 0, 0.10]], type: 'triangle' },
  { id: 'chime',  name: 'زنگ',     notes: [[660, 0, 0.15], [990, 0.12, 0.18], [1320, 0.24, 0.22]], type: 'sine' },
  { id: 'soft',   name: 'ملایم',   notes: [[440, 0, 0.25]], type: 'sine' },
  { id: 'bubble', name: 'حباب',    notes: [[300, 0, 0.08], [600, 0.06, 0.12]], type: 'sine' },
];

let audioCtx: AudioContext | null = null;
const getCtx = (): AudioContext | null => {
  try {
    if (!audioCtx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
};

const playBuiltin = (sound: BuiltinSound, volume: number) => {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  sound.notes.forEach(([freq, offset, dur]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = sound.type || 'sine';
    osc.frequency.value = freq;
    // smooth attack/decay envelope to avoid clicks
    const start = now + offset;
    const vol = Math.max(0, Math.min(1, volume));
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  });
};

const playDataUrl = (dataUrl: string, volume: number) => {
  try {
    const audio = new Audio(dataUrl);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.play().catch(() => {});
  } catch {
    /* ignore */
  }
};

export interface SoundConfig {
  enabled: boolean;
  selectedId: string;
  volume?: number;
  customSounds?: { id: string; name: string; dataUrl: string }[];
}

// Play a specific sound by id (ignores enabled flag — used for previews)
export const previewSound = (
  selectedId: string,
  volume = 0.6,
  customSounds: { id: string; name: string; dataUrl: string }[] = []
) => {
  const builtin = BUILTIN_SOUNDS.find(s => s.id === selectedId);
  if (builtin) return playBuiltin(builtin, volume);
  const custom = customSounds.find(s => s.id === selectedId);
  if (custom) return playDataUrl(custom.dataUrl, volume);
  // fallback
  playBuiltin(BUILTIN_SOUNDS[0], volume);
};

// Play the configured notification sound (respects enabled flag)
export const playNotificationSound = (config?: SoundConfig) => {
  if (!config) {
    // default ding if no config yet
    playBuiltin(BUILTIN_SOUNDS[0], 0.6);
    return;
  }
  if (config.enabled === false) return;
  previewSound(config.selectedId || 'ding', config.volume ?? 0.6, config.customSounds || []);
};
