export const NOTE_SCALE = ['C2', 'D2', 'F2', 'G2', 'A2', 'C3', 'D3', 'F3', 'G3', 'A3', 'C4', 'D4', 'F4', 'G4', 'A4', 'C5'];

export function getPitchForProgress(progress: number): string {
  const clamped = Math.max(0, Math.min(1, progress));
  const index = Math.min(
    NOTE_SCALE.length - 1,
    Math.floor(clamped * (NOTE_SCALE.length - 1)),
  );
  return NOTE_SCALE[index];
}
