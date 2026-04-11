import * as Tone from 'tone';

type Instrument =
  | Tone.AMSynth
  | Tone.Synth
  | Tone.FMSynth
  | Tone.MetalSynth
  | Tone.PolySynth
  | Tone.MembraneSynth
  | Tone.MonoSynth
  | Tone.PluckSynth;

interface InstrumentConfig {
  create: () => Instrument;
  notes: string[];
  duration: Tone.Unit.Time;
  velocityBoost?: number;
  chord?: boolean;
}

const LOW_PENTATONIC = ['C2', 'D2', 'E2', 'G2', 'A2', 'C3'];
const MID_PENTATONIC = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'];
const HIGH_PENTATONIC = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6'];
const BLIP_PENTATONIC = ['C6', 'D6', 'E6', 'G6', 'A6', 'C7'];
const DRUM_POOL = ['C1', 'D1', 'E1', 'G1', 'A1'];

const defaultConfig = (): InstrumentConfig => ({
  create: () =>
    new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0.05, release: 0.06 },
    }),
  notes: MID_PENTATONIC,
  duration: '16n',
});

const instrumentConfigs: Record<string, InstrumentConfig> = {
  '1호선': {
    create: () =>
      new Tone.AMSynth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.002, decay: 0.12, sustain: 0.2, release: 0.08 },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.001, decay: 0.1, sustain: 0.15, release: 0.08 },
      }),
    notes: LOW_PENTATONIC,
    duration: '16n',
    velocityBoost: 0.08,
  },
  '2호선': {
    create: () =>
      new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.09, sustain: 0.08, release: 0.05 },
      }),
    notes: MID_PENTATONIC,
    duration: '16n',
  },
  '3호선': {
    create: () =>
      new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0.03, release: 0.04 },
      }),
    notes: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'],
    duration: '32n',
    velocityBoost: 0.04,
  },
  '4호선': {
    create: () => {
      const synth = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.08, release: 0.03 },
        harmonicity: 8,
        modulationIndex: 28,
        resonance: 3000,
        octaves: 1.5,
      });
      synth.frequency.value = 320;
      return synth;
    },
    notes: HIGH_PENTATONIC,
    duration: '32n',
    velocityBoost: 0.06,
  },
  '5호선': {
    create: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'square' },
        envelope: { attack: 0.01, decay: 0.14, sustain: 0.22, release: 0.18 },
      }),
    notes: MID_PENTATONIC,
    duration: '16n',
    chord: true,
  },
  '6호선': {
    create: () =>
      new Tone.MembraneSynth({
        octaves: 6,
        pitchDecay: 0.03,
        envelope: { attack: 0.001, decay: 0.18, sustain: 0.01, release: 0.08 },
      }),
    notes: DRUM_POOL,
    duration: '32n',
    velocityBoost: 0.1,
  },
  '7호선': {
    create: () =>
      new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        filter: { Q: 1.5, type: 'lowpass', rolloff: -24 },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0.12, release: 0.08 },
        filterEnvelope: {
          attack: 0.001,
          decay: 0.08,
          sustain: 0.05,
          release: 0.06,
          baseFrequency: 220,
          octaves: 2.5,
        },
      }),
    notes: ['C3', 'D3', 'E3', 'G3', 'A3', 'C4'],
    duration: '16n',
    velocityBoost: 0.06,
  },
  '8호선': {
    create: () =>
      new Tone.PluckSynth({
        attackNoise: 1.5,
        dampening: 2200,
        resonance: 0.82,
      }),
    notes: BLIP_PENTATONIC,
    duration: '32n',
  },
  '9호선': {
    create: () =>
      new Tone.FMSynth({
        harmonicity: 1.5,
        modulationIndex: 8,
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0.1, release: 0.06 },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.001, decay: 0.06, sustain: 0.08, release: 0.04 },
      }),
    notes: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5'],
    duration: '16n',
    velocityBoost: 0.05,
  },
  분당선: {
    create: () =>
      new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0.05, release: 0.05 },
      }),
    notes: MID_PENTATONIC,
    duration: '16n',
  },
  수인분당선: {
    create: () =>
      new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0.05, release: 0.05 },
      }),
    notes: MID_PENTATONIC,
    duration: '16n',
  },
  신분당선: {
    create: () =>
      new Tone.Synth({
        oscillator: { type: 'pulse', width: 0.5 },
        envelope: { attack: 0.001, decay: 0.07, sustain: 0.07, release: 0.05 },
      }),
    notes: HIGH_PENTATONIC,
    duration: '16n',
    velocityBoost: 0.03,
  },
  공항철도: {
    create: () =>
      new Tone.Synth({
        oscillator: { type: 'pulse', width: 0.5 },
        envelope: { attack: 0.001, decay: 0.07, sustain: 0.06, release: 0.05 },
      }),
    notes: HIGH_PENTATONIC,
    duration: '16n',
  },
};

export class AudioEngine {
  private started = false;
  private muted = false;
  private instruments = new Map<string, Instrument>();
  private crusher = new Tone.BitCrusher(4);
  private meter = new Tone.Gain(0.7).toDestination();

  constructor() {
    this.crusher.connect(this.meter);
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
    this.meter.gain.rampTo(muted ? 0 : 0.7, 0.4);
  }

  dispose(): void {
    this.instruments.forEach((instrument) => instrument.dispose());
    this.crusher.dispose();
    this.meter.dispose();
  }

  play(lineName: string, progress: number, density: number, express: boolean): void {
    if (!this.started || this.muted) {
      return;
    }

    const config = instrumentConfigs[lineName] ?? defaultConfig();
    const synth = this.getInstrument(lineName, config);
    const note = this.getNote(config.notes, progress);
    const duration = express && config.duration === '16n' ? '32n' : config.duration;
    const velocity = Math.min(1, 0.22 + density * 0.4 + (express ? 0.12 : 0) + (config.velocityBoost ?? 0));

    try {
      if (synth instanceof Tone.PolySynth && config.chord) {
        synth.triggerAttackRelease(this.getChord(config.notes, progress), duration, undefined, velocity);
        return;
      }

      synth.triggerAttackRelease(note, duration, undefined, velocity);
    } catch (error) {
      console.error(`Failed to play note for ${lineName}.`, error);
    }
  }

  private getInstrument(lineName: string, config: InstrumentConfig): Instrument {
    const existing = this.instruments.get(lineName);
    if (existing) {
      return existing;
    }

    const instrument = config.create();
    instrument.connect(this.crusher);
    this.instruments.set(lineName, instrument);
    return instrument;
  }

  private getNote(notes: string[], progress: number): string {
    const clamped = Math.max(0, Math.min(1, progress));
    const index = Math.min(notes.length - 1, Math.floor(clamped * notes.length));
    return notes[index];
  }

  private getChord(notes: string[], progress: number): string[] {
    const rootIndex = Math.min(notes.length - 1, Math.floor(Math.max(0, Math.min(1, progress)) * notes.length));
    return [notes[rootIndex], notes[(rootIndex + 2) % notes.length], notes[(rootIndex + 4) % notes.length]];
  }
}
