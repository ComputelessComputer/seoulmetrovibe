import { LIVE_API_BASE, LIVE_API_KEY } from '../constants';
import type { LivePosition } from '../types';

interface RawLiveRow {
  trainNo?: string;
  subwayNm?: string;
  subwayId?: string;
  statnNm?: string;
  directAt?: string;
  ordkey?: string;
}

interface RawLiveEnvelope {
  realtimePositionList?: RawLiveRow[];
}

function normalizeLineName(value: string | undefined): string {
  return value?.replace(/\s+/g, '').trim() ?? '기타노선';
}

export async function fetchLivePositions(): Promise<LivePosition[]> {
  if (!LIVE_API_KEY || LIVE_API_KEY === 'YOUR_API_KEY') {
    throw new Error('Missing live API key');
  }

  const url = LIVE_API_BASE.replace('YOUR_API_KEY', LIVE_API_KEY);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Live API failed: ${response.status}`);
  }

  const json = (await response.json()) as RawLiveEnvelope;
  return (json.realtimePositionList ?? []).map((row, index) => {
    const ordinal = Number.parseInt(row.ordkey ?? String(index), 10);
    const progress = Number.isFinite(ordinal) ? Math.max(0, Math.min(1, ordinal / 100)) : index / Math.max(1, (json.realtimePositionList ?? []).length);
    return {
      trainNo: row.trainNo ?? `live-${index}`,
      lineId: normalizeLineName(row.subwayNm ?? row.subwayId),
      progress,
      express: row.directAt === '1',
    };
  });
}
