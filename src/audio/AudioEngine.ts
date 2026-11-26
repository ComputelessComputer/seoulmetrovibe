import * as Tone from 'tone';

type Playable = {
  triggerAttackRelease: (...args: any[]) => unknown;
  connect: (node: Tone.InputNode) => unknown;
  dispose: () => unknown;
};

interface Voice {
  create: () => Playable;
  /** Lowest MIDI note this voice may play. */
  low: number;
  /** Range above `low`, in semitones. */
  span: number;
  /** Minimum gap between notes from the same line, in 16th-note steps. */
  gapSteps: number;
  duration: Tone.Unit.Time;
  volume: number;
  chord?: boolean;
  fixedNote?: boolean;
}

const BPM = 84;
const STEP_SECONDS = 60 / BPM / 4;
const STEPS_PER_CHORD = 32; // two bars per chord
const MAX_NOTES_PER_STEP = 5;

// Fmaj9 -> Em7 -> Am9 -> Cmaj9, as pitch classes (C = 0).
const PROGRESSION: number[][] = [
  [5, 9, 0, 4, 7],
  [4, 7, 11, 2],
  [9, 0, 4, 7, 11],
  [0, 4, 7, 11, 2],
];
const BASS_ROOTS = [5, 4, 9, 0];

const VOICES = {
  bass: {
    create: () =>
      new Tone.MonoSynth({
        oscillator: { type: 'triangle' },
        filter: { type: 'lowpass', Q: 0.7, rolloff: -24 },
        envelope: { attack: 0.01, decay: 0.5, sustain: 0.25, release: 0.6 },
        filterEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.5, baseFrequency: 120, octaves: 2 },
      }),
    low: 36,
    span: 14,
    gapSteps: 4,
    duration: '8n',
    volume: -6,
  },
  epiano: {
    create: () =>
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3,
        modulationIndex: 2,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.004, decay: 1.4, sustain: 0, release: 1.2 },
        modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.4 },
      }),
    low: 57,
    span: 17,
    gapSteps: 2,
    duration: '4n',
    volume: -12,
  },
  marimba: {
    create: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.3 },
      }),
    low: 60,
    span: 19,
    gapSteps: 2,
    duration: '16n',
    volume: -9,
  },
  bell: {
    create: () =>
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.5,
        modulationIndex: 3.5,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.002, decay: 2, sustain: 0, release: 1.8 },
        modulationEnvelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.5 },
      }),
    low: 72,
    span: 15,
    gapSteps: 4,
    duration: '8n',
    volume: -17,
  },
  pad: {
    create: () =>
      new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 1.5,
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.6, decay: 0.5, sustain: 0.6, release: 2.5 },
        modulation: { type: 'sine' },
      }),
    low: 53,
    span: 14,
    gapSteps: 16,
    duration: '2n',
    volume: -18,
    chord: true,
  },
  pulse: {
    create: () =>
      new Tone.MembraneSynth({
        octaves: 3,
        pitchDecay: 0.04,
        envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
      }),
    low: 29,
    span: 0,
    gapSteps: 4,
    duration: '16n',
    volume: -12,
    fixedNote: true,
  },
  cello: {
    create: () =>
      new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        filter: { type: 'lowpass', Q: 1, rolloff: -24 },
        envelope: { attack: 0.08, decay: 0.6, sustain: 0.35, release: 0.9 },
        filterEnvelope: { attack: 0.08, decay: 0.5, sustain: 0.3, release: 0.8, baseFrequency: 260, octaves: 1.5 },
      }),
    low: 48,
    span: 15,
    gapSteps: 4,
    duration: '4n',
    volume: -14,
  },
  kalimba: {
    create: () => new Tone.PluckSynth({ attackNoise: 0.6, dampening: 3800, resonance: 0.9 }),
    low: 69,
    span: 17,
    gapSteps: 2,
    duration: '16n',
    volume: -6,
  },
  vibes: {
    create: () =>
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 4,
        modulationIndex: 1.2,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.003, decay: 1.6, sustain: 0, release: 1.4 },
        modulationEnvelope: { attack: 0.003, decay: 0.3, sustain: 0, release: 0.3 },
      }),
    low: 64,
    span: 17,
    gapSteps: 3,
    duration: '8n',
    volume: -15,
  },
} satisfies Record<string, Voice>;

type VoiceName = keyof typeof VOICES;

const LINE_VOICES: Record<string, VoiceName> = {
  '1호선': 'bass',
  '2호선': 'epiano',
  '3호선': 'marimba',
  '4호선': 'bell',
  '5호선': 'pad',
  '6호선': 'pulse',
  '7호선': 'cello',
  '8호선': 'kalimba',
  '9호선': 'vibes',
  신분당선: 'bell',
  공항철도: 'kalimba',
  수인분당선: 'marimba',
  분당선: 'marimba',
};
const FALLBACK_VOICES: VoiceName[] = ['kalimba', 'marimba', 'vibes', 'epiano', 'bell'];

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

function voiceFor(lineName: string): VoiceName {
  return LINE_VOICES[lineName] ?? FALLBACK_VOICES[hash(lineName) % FALLBACK_VOICES.length];
}

function chordNotes(pitchClasses: number[], low: number, span: number): number[] {
  const notes: number[] = [];
  for (let midi = low; midi <= low + span; midi += 1) {
    if (pitchClasses.includes(((midi % 12) + 12) % 12)) notes.push(midi);
  }
  return notes;
}

export class AudioEngine {
  private started = false;
  private muted = false;
  private instruments = new Map<string, Playable>();
  private lastStepByLine = new Map<string, number>();
  private notesPerStep = new Map<number, number>();
  private bus = new Tone.Gain(1);
  private delay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.22, wet: 0.16 });
  private reverb = new Tone.Reverb({ decay: 4.5, preDelay: 0.02, wet: 0.32 });
  private compressor = new Tone.Compressor({ threshold: -20, ratio: 3, attack: 0.02, release: 0.25 });
  private limiter = new Tone.Limiter(-3);
  private meter = new Tone.Gain(0.8).toDestination();

  constructor() {
    this.bus.chain(this.delay, this.reverb, this.compressor, this.limiter, this.meter);
  }

  async start(): Promise<boolean> {
    if (this.started) {
      return true;
    }
    try {
      await Tone.start();
      this.started = true;
      return true;
    } catch (error) {
      console.error('Failed to start Tone.js audio context.', error);
      return false;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.meter.gain.rampTo(muted ? 0 : 0.8, 0.4);
  }

  dispose(): void {
    this.instruments.forEach((instrument) => instrument.dispose());
    [this.bus, this.delay, this.reverb, this.compressor, this.limiter, this.meter].forEach((node) => node.dispose());
  }

  play(lineName: string, progress: number, express: boolean): void {
    if (!this.started || this.muted) {
      return;
    }

    const voiceName = voiceFor(lineName);
    const voice: Voice = VOICES[voiceName];

    // Snap every note to a shared 16th-note grid so the whole network grooves together.
    const step = Math.ceil((Tone.now() + 0.05) / STEP_SECONDS);
    const lastStep = this.lastStepByLine.get(lineName) ?? -Infinity;
    if (step - lastStep < voice.gapSteps) return;
    const slotCount = this.notesPerStep.get(step) ?? 0;
    if (slotCount >= MAX_NOTES_PER_STEP) return;

    this.lastStepByLine.set(lineName, step);
    this.notesPerStep.set(step, slotCount + 1);
    if (this.notesPerStep.size > 64) {
      this.notesPerStep.forEach((_, key) => {
        if (key < step - 8) this.notesPerStep.delete(key);
      });
    }

    const chordIndex = Math.floor(step / STEPS_PER_CHORD) % PROGRESSION.length;
    const time = step * STEP_SECONDS;
    const velocity = Math.min(1, 0.45 + (express ? 0.15 : 0) + Math.random() * 0.12);
    const synth = this.getInstrument(lineName, voice);
    const clamped = Math.max(0, Math.min(1, progress));

    let notes: number[];
    if (voice.fixedNote) {
      notes = [step % 8 === 0 ? voice.low : voice.low + 7];
    } else if (voiceName === 'bass') {
      const root = BASS_ROOTS[chordIndex];
      const roots = chordNotes([root, (root + 7) % 12], voice.low, voice.span);
      notes = [roots[Math.min(roots.length - 1, Math.floor(clamped * roots.length))]];
    } else {
      const candidates = chordNotes(PROGRESSION[chordIndex], voice.low, voice.span);
      const index = Math.min(candidates.length - 1, Math.floor(clamped * candidates.length));
      notes = voice.chord
        ? [candidates[index], candidates[(index + 2) % candidates.length], candidates[(index + 4) % candidates.length]]
        : [candidates[index]];
    }

    try {
      const frequencies = notes.map((midi) => Tone.Frequency(midi, 'midi').toNote());
      synth.triggerAttackRelease(voice.chord ? frequencies : frequencies[0], voice.duration, time, velocity);
    } catch (error) {
      console.error(`Failed to play note for ${lineName}.`, error);
    }
  }

  private getInstrument(name: string, voice: Voice): Playable {
    const existing = this.instruments.get(name);
    if (existing) {
      return existing;
    }
    const instrument = voice.create();
    const volume = new Tone.Volume(voice.volume);
    instrument.connect(volume);
    volume.connect(this.bus);
    this.instruments.set(name, instrument);
    return instrument;
  }
}
