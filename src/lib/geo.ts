import type { GeoPoint } from '../types';

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function distance(a: GeoPoint, b: GeoPoint): number {
  const dx = a.lng - b.lng;
  const dy = a.lat - b.lat;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getPolylineLength(points: GeoPoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index]);
  }
  return total;
}

export function getPointAtProgress(points: GeoPoint[], progress: number): GeoPoint {
  if (points.length === 0) {
    return { lat: 0, lng: 0 };
  }
  if (points.length === 1) {
    return points[0];
  }

  const target = getPolylineLength(points) * clamp(progress);
  let elapsed = 0;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = distance(start, end);
    if (elapsed + segmentLength >= target) {
      const t = segmentLength === 0 ? 0 : (target - elapsed) / segmentLength;
      return {
        lat: lerp(start.lat, end.lat, t),
        lng: lerp(start.lng, end.lng, t),
      };
    }
    elapsed += segmentLength;
  }

  return points[points.length - 1];
}

export function getClosestProgress(points: GeoPoint[], point: GeoPoint): number {
  if (points.length < 2) {
    return 0;
  }

  const totalLength = getPolylineLength(points);
  let bestProgress = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  let elapsed = 0;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const dx = end.lng - start.lng;
    const dy = end.lat - start.lat;
    const lengthSquared = dx * dx + dy * dy;
    const t =
      lengthSquared === 0
        ? 0
        : clamp(((point.lng - start.lng) * dx + (point.lat - start.lat) * dy) / lengthSquared);
    const projected = {
      lat: start.lat + dy * t,
      lng: start.lng + dx * t,
    };
    const projectedDistance = distance(projected, point);
    if (projectedDistance < bestDistance) {
      bestDistance = projectedDistance;
      bestProgress = totalLength === 0 ? 0 : (elapsed + Math.sqrt(lengthSquared) * t) / totalLength;
    }
    elapsed += Math.sqrt(lengthSquared);
  }

  return clamp(bestProgress);
}
