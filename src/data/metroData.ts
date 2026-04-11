import { LINE_COLOR_OVERRIDES, LINES_URL, OTHER_LINE_COLORS, STATIONS_URL } from '../constants';
import { getClosestProgress, getPolylineLength } from '../lib/geo';
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

interface RawLineSegment {
  line?: string;
  line_num?: string;
  name?: string;
  lineName?: string;
  station?: Array<{ lat?: number | string; lng?: number | string; lon?: number | string; name?: string }>;
  via?: Array<{ lat?: number | string; lng?: number | string; lon?: number | string }>;
  points?: Array<{ lat?: number | string; lng?: number | string; lon?: number | string }>;
}

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

function parsePoint(raw: { lat?: unknown; lng?: unknown; lon?: unknown; xpoint_wgs?: unknown; ypoint_wgs?: unknown }): GeoPoint | null {
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

export async function fetchMetroData(): Promise<MetroData> {
  const [stationResponse, lineResponse] = await Promise.all([
    fetch(STATIONS_URL),
    fetch(LINES_URL),
  ]);

  const stationJson = (await stationResponse.json()) as RawEnvelope<RawStation> | RawStation[];
  const lineJson = (await lineResponse.json()) as RawEnvelope<RawLineSegment> | RawLineSegment[];

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

  const rawSegmentsByLine = new Map<string, RawLineSegment[]>();
  for (const segment of rawLines) {
    const lineName = normalizeLineName(
      segment.line ?? segment.line_num ?? segment.name ?? segment.lineName ?? '기타노선',
    );
    const bucket = rawSegmentsByLine.get(lineName) ?? [];
    bucket.push(segment);
    rawSegmentsByLine.set(lineName, bucket);
  }

  const lines: Line[] = Array.from(stationsByLine.entries())
    .map(([lineId, lineStations]) => {
      const segments = rawSegmentsByLine.get(lineId) ?? [];
      const pathPoints = dedupePoints(
        segments.flatMap((segment) => {
          const stationPoints = (segment.station ?? [])
            .map((item) => resolveStationPoint(item, item.name))
            .filter((point): point is GeoPoint => point !== null);
          const viaPoints = (segment.via ?? segment.points ?? []).map((item) => parsePoint(item)).filter((point): point is GeoPoint => point !== null);
          return [...stationPoints, ...viaPoints];
        }),
      );

      const polyline = pathPoints.length >= 2 ? pathPoints : buildFallbackPolyline(lineStations);
      const normalizedStations = lineStations
        .slice()
        .sort((a, b) => getClosestProgress(polyline, a) - getClosestProgress(polyline, b));

      return {
        id: lineId,
        name: lineId,
        color: getLineColor(lineId),
        points: polyline,
        stations: normalizedStations,
        length: getPolylineLength(polyline),
      } satisfies Line;
    })
    .filter((line) => line.points.length >= 2);

  return { lines, stations };
}
