import { TARGET_TRAIN_COUNT } from '../constants';
import { clamp, getPointAtProgress } from '../lib/geo';
import type { DataMode, Line, LivePosition, Train, TrainRenderState } from '../types';

function currentKoreanHour(): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Seoul',
    }).format(new Date()),
  );
}

function getRushMultiplier(hour: number): number {
  if ((hour >= 7 && hour < 9) || (hour >= 18 && hour < 20)) {
    return 1.15;
  }
  if (hour >= 23 || hour < 5) {
    return 0.35;
  }
  if (hour >= 10 && hour < 16) {
    return 0.75;
  }
  return 0.92;
}

function hash(seed: string): number {
  let value = 0;
  for (let index = 0; index < seed.length; index += 1) {
    value = (value * 31 + seed.charCodeAt(index)) % 2147483647;
  }
  return value / 2147483647;
}

export function createDemoTrains(lines: Line[]): Train[] {
  const lineWeights = lines.map((line) => Math.max(1, line.stations.length));
  const totalWeight = lineWeights.reduce((sum, value) => sum + value, 0);
  const multiplier = getRushMultiplier(currentKoreanHour());
  const totalTrains = Math.round(TARGET_TRAIN_COUNT * multiplier);

  return lines.flatMap((line, lineIndex) => {
    const weight = lineWeights[lineIndex] / totalWeight;
    const count = Math.max(2, Math.round(totalTrains * weight));
    return Array.from({ length: count }, (_, trainIndex) => {
      const seed = `${line.id}-${trainIndex}`;
      return {
        id: seed,
        lineId: line.id,
        progress: hash(`${seed}:progress`),
        speed: 0.00003 + hash(`${seed}:speed`) * 0.00008,
        direction: hash(`${seed}:direction`) > 0.5 ? 1 : -1,
        express: hash(`${seed}:express`) > 0.84,
        active: true,
        pulseUntil: 0,
      } satisfies Train;
    });
  });
}

export function hydrateLiveTrains(lines: Line[], livePositions: LivePosition[]): Train[] {
  const lineIds = new Set(lines.map((line) => line.id));
  return livePositions
    .filter((position) => lineIds.has(position.lineId))
    .map((position, index) => ({
      id: position.trainNo,
      lineId: position.lineId,
      progress: position.progress,
      speed: 0.00006 + (index % 5) * 0.00001,
      direction: index % 2 === 0 ? 1 : -1,
      express: position.express,
      active: true,
      pulseUntil: 0,
    }));
}

export function advanceTrains(
  trains: Train[],
  deltaMs: number,
  mode: DataMode,
): Train[] {
  return trains.map((train) => {
    const distance = (deltaMs / 16.67) * train.speed * (mode === 'demo' ? 1 : 0.75);
    let progress = train.progress + distance * train.direction;
    let direction = train.direction;

    if (progress >= 1) {
      progress = 1 - (progress - 1);
      direction = -1;
    } else if (progress <= 0) {
      progress = Math.abs(progress);
      direction = 1;
    }

    return {
      ...train,
      progress: clamp(progress),
      direction,
    };
  });
}

export function renderTrains(lines: Line[], trains: Train[]): TrainRenderState[] {
  const lineMap = new Map(lines.map((line) => [line.id, line]));
  return trains
    .map((train) => {
      const line = lineMap.get(train.lineId);
      if (!line) {
        return null;
      }
      return {
        ...train,
        point: getPointAtProgress(line.points, train.progress),
        stationProgress: train.progress,
      } satisfies TrainRenderState;
    })
    .filter((train): train is TrainRenderState => train !== null);
}
