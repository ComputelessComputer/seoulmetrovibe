import { LINE_COLOR_OVERRIDES, LINES_URL, OTHER_LINE_COLORS, STATIONS_URL } from '../constants';
import { getPolylineLength } from '../lib/geo';
import stationCoords from './stationCoords.json';
import type { GeoPoint, Line, MetroData, Station } from '../types';

interface RawEnvelope<T> {
  DATA?: T[];
}

interface RawStation {
  line?: string;
  line_num?: string;
  lineName?: string;
  station_nm?: string;
  name?: string;
  station?: string;
  station_cd?: string;
  code?: string;
  lat?: number | string;
  lng?: number | string;
  lon?: number | string;
  xpoint_wgs?: number | string;
  ypoint_wgs?: number | string;
  fr_code?: number | string;
  station_seq?: number | string;
}

interface RawLineNode {
  station?: RawSegmentPoint[];
  via?: RawSegmentPoint[];
  points?: RawSegmentPoint[];
}

interface RawLineEntry {
  line?: string;
  line_num?: string;
  name?: string;
  lineName?: string;
  node?: RawLineNode[];
  station?: RawSegmentPoint[];
  via?: RawSegmentPoint[];
  points?: RawSegmentPoint[];
}

type RawSegmentPoint =
  | {
      lat?: number | string;
      lng?: number | string;
      lon?: number | string;
      xpoint_wgs?: number | string;
      ypoint_wgs?: number | string;
      name?: string;
    }
  | [number | string, number | string];

const lineColorCache = new Map<string, string>();
const stationCoordMap = new Map<string, GeoPoint>();

for (const [name, [lat, lng]] of Object.entries(stationCoords as unknown as Record<string, [number, number]>)) {
  const normalizedName = normalizeStationName(name);
  stationCoordMap.set(name.trim(), { lat, lng });
  stationCoordMap.set(normalizedName, { lat, lng });
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parsePoint(
  raw:
    | {
        lat?: unknown;
        lng?: unknown;
        lon?: unknown;
        xpoint_wgs?: unknown;
        ypoint_wgs?: unknown;
      }
    | [unknown, unknown],
): GeoPoint | null {
  if (Array.isArray(raw)) {
    const lat = parseNumber(raw[0]);
    const lng = parseNumber(raw[1]);
    if (lat === null || lng === null) {
      return null;
    }
    return { lat, lng };
  }

  const lat = parseNumber(raw.lat ?? raw.ypoint_wgs);
  const lng = parseNumber(raw.lng ?? raw.lon ?? raw.xpoint_wgs);
  if (lat === null || lng === null) {
    return null;
  }
  return { lat, lng };
}

function dedupePoints(points: GeoPoint[]): GeoPoint[] {
  const unique: GeoPoint[] = [];
  for (const point of points) {
    const last = unique[unique.length - 1];
    if (!last || last.lat !== point.lat || last.lng !== point.lng) {
      unique.push(point);
    }
  }
  return unique;
}

function normalizeStationName(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

function normalizeLineName(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

function lookupStationPoint(name: string | undefined): GeoPoint | null {
  if (!name) {
    return null;
  }
  return stationCoordMap.get(name.trim()) ?? stationCoordMap.get(normalizeStationName(name)) ?? null;
}

function resolveStationPoint(
  raw: { lat?: unknown; lng?: unknown; lon?: unknown; xpoint_wgs?: unknown; ypoint_wgs?: unknown },
  stationName?: string,
): GeoPoint | null {
  return parsePoint(raw) ?? lookupStationPoint(stationName);
}

function getLineColor(lineName: string): string {
  const normalized = normalizeLineName(lineName);
  const override = LINE_COLOR_OVERRIDES[normalized];
  if (override) {
    return override;
  }
  if (!lineColorCache.has(normalized)) {
    lineColorCache.set(
      normalized,
      OTHER_LINE_COLORS[lineColorCache.size % OTHER_LINE_COLORS.length],
    );
  }
  return lineColorCache.get(normalized)!;
}

function buildFallbackPolyline(stations: Station[]): GeoPoint[] {
  return dedupePoints(
    stations
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((station) => ({ lat: station.lat, lng: station.lng })),
  );
}

function getOrderedStations(lineStations: Station[]): Station[] {
  return lineStations.slice().sort((a, b) => a.sequence - b.sequence);
}

function getEntryNodes(entry: RawLineEntry): RawLineNode[] {
  if (entry.node && entry.node.length > 0) {
    return entry.node;
  }

  return [{ station: entry.station, via: entry.via, points: entry.points }];
}

function buildNodeViaPath(node: RawLineNode): GeoPoint[] {
  const viaPoints = (node.via ?? node.points ?? [])
    .map((item) => parsePoint(item))
    .filter((point): point is GeoPoint => point !== null);
  if (viaPoints.length > 0) {
    return dedupePoints(viaPoints);
  }

  return dedupePoints(
    (node.station ?? [])
      .map((item) =>
        Array.isArray(item)
          ? parsePoint(item)
          : resolveStationPoint(item, item.name),
      )
      .filter((point): point is GeoPoint => point !== null),
  );
}

function dedupeStations(stations: Station[]): Station[] {
  const unique: Station[] = [];
  for (const station of stations) {
    const last = unique[unique.length - 1];
    if (!last) {
      unique.push(station);
      continue;
    }

    const sameName = normalizeStationName(last.name) === normalizeStationName(station.name);
    const samePoint = last.lat === station.lat && last.lng === station.lng;
    if (!sameName || !samePoint) {
      unique.push(station);
    }
  }
  return unique;
}

function buildBranchStations(
  lineId: string,
  nodes: RawLineNode[],
  fallbackStationsByName: Map<string, Station>,
): Station[] {
  const stations = dedupeStations(
    nodes.flatMap((node) =>
      (node.station ?? [])
        .map((item, index) => {
          const stationName = !Array.isArray(item) ? item.name : undefined;
          const point = Array.isArray(item)
            ? parsePoint(item)
            : resolveStationPoint(item, stationName);
          const fallback = stationName
            ? fallbackStationsByName.get(normalizeStationName(stationName))
            : undefined;

          if (!point && !fallback) {
            return null;
          }

          return {
            id: fallback?.id ?? `${lineId}-branch-station-${uniqueStationIdSeed(stationName, point, index)}`,
            name: stationName ?? fallback?.name ?? `Station ${index + 1}`,
            lineId,
            lineName: lineId,
            lat: point?.lat ?? fallback!.lat,
            lng: point?.lng ?? fallback!.lng,
            sequence: 0,
          } satisfies Station;
        })
        .filter((station): station is Station => station !== null),
    ),
  );

  return stations.map((station, index) => ({
    ...station,
    sequence: index,
  }));
}

function uniqueStationIdSeed(
  stationName: string | undefined,
  point: GeoPoint | null,
  index: number,
): string {
  if (stationName) {
    return normalizeStationName(stationName);
  }
  if (point) {
    return `${point.lat}-${point.lng}`;
  }
  return String(index);
}

function selectPrimaryBranch(
  branches: { points: GeoPoint[]; stations: Station[] }[],
  fallbackPoints: GeoPoint[],
  fallbackStations: Station[],
): { points: GeoPoint[]; stations: Station[] } {
  const bestBranch = branches.reduce<{ points: GeoPoint[]; stations: Station[] } | null>((best, branch) => {
    if (branch.points.length < 2) {
      return best;
    }
    if (!best) {
      return branch;
    }
    if (branch.stations.length !== best.stations.length) {
      return branch.stations.length > best.stations.length ? branch : best;
    }
    return getPolylineLength(branch.points) > getPolylineLength(best.points) ? branch : best;
  }, null);

  return bestBranch ?? { points: fallbackPoints, stations: fallbackStations };
}

export async function fetchMetroData(): Promise<MetroData> {
  const [stationResponse, lineResponse] = await Promise.all([
    fetch(STATIONS_URL),
    fetch(LINES_URL),
  ]);

  const stationJson = (await stationResponse.json()) as RawEnvelope<RawStation> | RawStation[];
  const lineJson = (await lineResponse.json()) as RawEnvelope<RawLineEntry> | RawLineEntry[];

  const rawStations = Array.isArray(stationJson) ? stationJson : stationJson.DATA ?? [];
  const rawLines = Array.isArray(lineJson) ? lineJson : lineJson.DATA ?? [];

  const stations = rawStations
    .map((entry, index) => {
      const lineName = normalizeLineName(
        entry.line ?? entry.line_num ?? entry.lineName ?? '기타노선',
      );
      const stationName = String(entry.station_nm ?? entry.name ?? entry.station ?? `Station ${index + 1}`);
      const point = resolveStationPoint(entry, stationName);
      if (!point) {
        return null;
      }
      return {
        id: String(entry.station_cd ?? entry.code ?? `${lineName}-${index}`),
        name: stationName,
        lineId: lineName,
        lineName,
        lat: point.lat,
        lng: point.lng,
        sequence: Number(entry.station_seq ?? entry.fr_code ?? index),
      } satisfies Station;
    })
    .filter((station): station is Station => station !== null);

  const stationsByLine = new Map<string, Station[]>();
  for (const station of stations) {
    const bucket = stationsByLine.get(station.lineId) ?? [];
    bucket.push(station);
    stationsByLine.set(station.lineId, bucket);
  }

  const rawEntriesByLine = new Map<string, RawLineEntry[]>();
  for (const segment of rawLines) {
    const lineName = normalizeLineName(
      segment.line ?? segment.line_num ?? segment.name ?? segment.lineName ?? '기타노선',
    );
    const bucket = rawEntriesByLine.get(lineName) ?? [];
    bucket.push(segment);
    rawEntriesByLine.set(lineName, bucket);
  }

  const lines: Line[] = Array.from(stationsByLine.entries())
    .map(([lineId, lineStations]) => {
      const orderedStations = getOrderedStations(lineStations);
      const fallbackPolyline = buildFallbackPolyline(orderedStations);
      const stationsByName = new Map(
        orderedStations.map((station) => [normalizeStationName(station.name), station]),
      );
      const branches = (rawEntriesByLine.get(lineId) ?? [])
        .map((entry) => {
          const nodes = getEntryNodes(entry);
          const points = dedupePoints(nodes.flatMap((node) => buildNodeViaPath(node)));
          const stationsFromNodes = buildBranchStations(lineId, nodes, stationsByName);
          const stationsForBranch = stationsFromNodes.length > 0 ? stationsFromNodes : orderedStations;
          return {
            points: points.length >= 2 ? points : buildFallbackPolyline(stationsForBranch),
            stations: stationsForBranch,
          };
        })
        .filter((branch) => branch.points.length >= 2);

      const primaryBranch = selectPrimaryBranch(branches, fallbackPolyline, orderedStations);

      return {
        id: lineId,
        name: lineId,
        color: getLineColor(lineId),
        points: primaryBranch.points,
        branches: branches.length > 0 ? branches.map((branch) => branch.points) : [primaryBranch.points],
        stations: primaryBranch.stations,
        length: getPolylineLength(primaryBranch.points),
      } satisfies Line;
    })
    .filter((line) => line.points.length >= 2);

  return { lines, stations };
}
