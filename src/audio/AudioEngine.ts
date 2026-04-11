import * as Tone from 'tone';
import { getPitchForProgress } from '../lib/music';

type Instrument =
  | Tone.AMSynth
  | Tone.Synth
  | Tone.FMSynth
  | Tone.MetalSynth
  | Tone.PolySynth
  | Tone.MembraneSynth
  | Tone.MonoSynth
  | Tone.PluckSynth;

const instrumentFactories: Record<string, () => Instrument> = {
  '1호선': () => new Tone.AMSynth({ oscillator: { type: 'sine' } }),
  '2호선': () => new Tone.Synth({ oscillator: { type: 'triangle' } }),
  '3호선': () => new Tone.FMSynth({ harmonicity: 1.5 }),
  '4호선': () => new Tone.MetalSynth({ modulationIndex: 18, resonance: 3500 }),
  '5호선': () => new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' } }),
  '6호선': () => new Tone.MembraneSynth({ pitchDecay: 0.02 }),
  '7호선': () => new Tone.MonoSynth({ oscillator: { type: 'square' } }),
  '8호선': () => new Tone.PluckSynth(),
  '9호선': () => new Tone.AMSynth({ oscillator: { type: 'triangle' } }),
  분당선: () => new Tone.Synth({ oscillator: { type: 'sine' } }),
  수인분당선: () => new Tone.Synth({ oscillator: { type: 'sine' } }),
  신분당선: () => new Tone.FMSynth({ harmonicity: 3 }),
};

const fallbackFactories = [
  () => new Tone.Synth({ oscillator: { type: 'sine' } }),
  () => new Tone.FMSynth({ harmonicity: 2 }),
  () => new Tone.MonoSynth({ oscillator: { type: 'triangle' } }),
  () => new Tone.PluckSynth(),
];

export class AudioEngine {
  private started = false;
  private muted = false;
  private instruments = new Map<string, Instrument>();
  private meter = new Tone.Gain(0.7).toDestination();
  private fallbackIndex = 0;

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    await Tone.start();
    this.started = true;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.meter.gain.rampTo(muted ? 0 : 0.7, 0.4);
  }

  dispose(): void {
    this.instruments.forEach((instrument) => instrument.dispose());
    this.meter.dispose();
  }

  play(lineName: string, progress: number, density: number, express: boolean): void {
    if (!this.started || this.muted) {
      return;
    }

    const synth = this.getInstrument(lineName);
    const velocity = Math.min(1, 0.18 + density * 0.55 + (express ? 0.18 : 0));
    const duration = express ? '16n' : '8n';
    const note = getPitchForProgress(progress);

    if (synth instanceof Tone.PolySynth) {
      try {
        const harmony = Tone.Frequency(note).transpose(7).toNote();
        synth.triggerAttackRelease([note, harmony], duration, undefined, velocity);
      } catch {
        synth.triggerAttackRelease([note], duration, undefined, velocity);
      }
      return;
    }
    synth.triggerAttackRelease(note, duration, undefined, velocity);
  }

  private getInstrument(lineName: string): Instrument {
    const existing = this.instruments.get(lineName);
    if (existing) {
      return existing;
    }

    const create =
      instrumentFactories[lineName] ??
      fallbackFactories[this.fallbackIndex++ % fallbackFactories.length];
    const instrument = create();
    instrument.connect(this.meter);
    this.instruments.set(lineName, instrument);
    return instrument;
  }
}
