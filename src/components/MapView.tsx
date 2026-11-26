import { useEffect, useRef, useState } from 'react';
import { SEOUL_CENTER, SEOUL_ZOOM } from '../constants';
import type { Line, ThemeMode, TrainRenderState } from '../types';

interface MapViewProps {
  lines: Line[];
  onClearSelection: () => void;
  onLineSelect: (lineId: string, append?: boolean) => void;
  selectedLineIds: string[];
  theme: ThemeMode;
  trains: TrainRenderState[];
}

type OffsetPoint = { x: number; y: number };
type GeoPoint = { lat: number; lng: number };

const STATION_DOTS_MIN_ZOOM = 13;
const LINE_CLICK_THRESHOLD_PX = 10;

function loadNaverMaps(clientId: string): Promise<any> {
  if (window.naver?.maps?.Map) return Promise.resolve(window.naver.maps);

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-naver-maps-api]');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.naver?.maps?.Map) resolve(window.naver.maps);
        else reject(new Error('Naver Maps loaded without its map API.'));
      }, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Naver Maps could not be loaded.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.dataset.naverMapsApi = 'true';
    script.async = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.onload = () => {
      if (window.naver?.maps?.Map) resolve(window.naver.maps);
      else reject(new Error('Naver Maps loaded without its map API.'));
    };
    script.onerror = () => reject(new Error('Naver Maps could not be loaded. Check the Client ID and registered web service URL.'));
    document.head.appendChild(script);
  });
}

function getPointToSegmentDistanceSquared(point: OffsetPoint, start: OffsetPoint, end: OffsetPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    const pointDx = point.x - start.x;
    const pointDy = point.y - start.y;
    return pointDx * pointDx + pointDy * pointDy;
  }
  const projection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const t = Math.max(0, Math.min(1, projection));
  const closestX = start.x + t * dx;
  const closestY = start.y + t * dy;
  const distanceX = point.x - closestX;
  const distanceY = point.y - closestY;
  return distanceX * distanceX + distanceY * distanceY;
}

declare global {
  interface Window {
    __NAVER_MAPS_CLIENT_ID__?: string;
    naver?: { maps?: any };
  }
}

export function MapView({
  lines,
  onClearSelection,
  onLineSelect,
  selectedLineIds,
  theme,
  trains,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const mapsRef = useRef<any | null>(null);
  const lineLayerRef = useRef<any[]>([]);
  const linesRef = useRef(lines);
  const trainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const trainsRef = useRef(trains);
  const selectedLineIdsRef = useRef(selectedLineIds);
  const lineColorsRef = useRef(new Map<string, string>());
  const hasFitRef = useRef(false);
  const latestPropsRef = useRef({ lines, onClearSelection, onLineSelect });
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  latestPropsRef.current = { lines, onClearSelection, onLineSelect };
  trainsRef.current = trains;
  linesRef.current = lines;
  selectedLineIdsRef.current = selectedLineIds;

  useEffect(() => {
    lineColorsRef.current = new Map(lines.map((line) => [line.id, line.color]));
  }, [lines]);

  useEffect(() => {
    if (!containerRef.current) return;
    const clientId = window.__NAVER_MAPS_CLIENT_ID__ ?? '';
    if (!clientId) {
      setMapError('Naver Maps is not configured. Add VITE_NAVER_MAPS_CLIENT_ID and redeploy.');
      return;
    }

    let cancelled = false;
    let clickListener: any;
    let resizeObserver: ResizeObserver | undefined;

    loadNaverMaps(clientId)
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng(SEOUL_CENTER.lat, SEOUL_CENTER.lng),
          zoom: SEOUL_ZOOM,
          zoomControl: false,
          mapDataControl: false,
          scaleControl: false,
        });
        mapsRef.current = maps;
        mapRef.current = map;

        if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
          resizeObserver = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) map.setSize(new maps.Size(width, height));
          });
          resizeObserver.observe(containerRef.current);
        }

        clickListener = maps.Event.addListener(map, 'click', (event: any) => {
          const currentMaps = mapsRef.current;
          const currentMap = mapRef.current;
          if (!currentMaps || !currentMap) return;
          const coordinate = event.latlng ?? event.coord;
          if (!coordinate) return;

          const projection = currentMap.getProjection();
          const clickOffset = projection.fromCoordToOffset(coordinate) as OffsetPoint;
          let closestLineId: string | null = null;
          let closestDistanceSq = Number.POSITIVE_INFINITY;

          latestPropsRef.current.lines.forEach((line) => {
            const branches = line.branches.length > 0 ? line.branches : [line.points];
            branches.forEach((branch) => {
              for (let index = 1; index < branch.length; index += 1) {
                const startCoord = new currentMaps.LatLng(branch[index - 1].lat, branch[index - 1].lng);
                const endCoord = new currentMaps.LatLng(branch[index].lat, branch[index].lng);
                const start = projection.fromCoordToOffset(startCoord) as OffsetPoint;
                const end = projection.fromCoordToOffset(endCoord) as OffsetPoint;
                const distanceSq = getPointToSegmentDistanceSquared(clickOffset, start, end);
                if (distanceSq < closestDistanceSq) {
                  closestDistanceSq = distanceSq;
                  closestLineId = line.id;
                }
              }
            });
          });

          if (closestLineId && closestDistanceSq <= LINE_CLICK_THRESHOLD_PX * LINE_CLICK_THRESHOLD_PX) {
            const pointerEvent = event.pointerEvent as MouseEvent | undefined;
            latestPropsRef.current.onLineSelect(
              closestLineId,
              !!pointerEvent && (pointerEvent.metaKey || pointerEvent.ctrlKey),
            );
            return;
          }
          latestPropsRef.current.onClearSelection();
        });

        setMapReady(true);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : 'Naver Maps could not be loaded.');
        }
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      const maps = mapsRef.current;
      const map = mapRef.current;
      if (maps && clickListener) maps.Event.removeListener(clickListener);
      lineLayerRef.current.forEach((overlay) => overlay.setMap(null));
      lineLayerRef.current = [];
      if (map && typeof map.destroy === 'function') map.destroy();
      mapRef.current = null;
      mapsRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!mapReady || !map || !maps) return;

    lineLayerRef.current.forEach((overlay) => overlay.setMap(null));
    lineLayerRef.current = [];

    lines.forEach((line) => {
      const isSelected = selectedLineIds.includes(line.id);
      const isDimmed = selectedLineIds.length > 0 && !isSelected;
      const branches = line.branches.length > 0 ? line.branches : [line.points];
      branches.forEach((branch) => {
        const path = branch.map((point) => new maps.LatLng(point.lat, point.lng));
        const polyline = new maps.Polyline({
          map,
          path,
          strokeColor: line.color,
          strokeWeight: isSelected ? 4 : 2.5,
          strokeOpacity: isDimmed ? 0.15 : 0.9,
          clickable: false,
          zIndex: isSelected ? 10 : 1,
        });
        lineLayerRef.current.push(polyline);
      });

    });

    if (!hasFitRef.current) {
      const stationPoints = lines.flatMap((line) => line.stations);
      if (stationPoints.length > 0) {
        const bounds = new maps.LatLngBounds();
        stationPoints.forEach((point: GeoPoint) => bounds.extend(new maps.LatLng(point.lat, point.lng)));
        hasFitRef.current = true;
        map.fitBounds(bounds);
      }
    }
  }, [lines, mapReady, selectedLineIds]);

  // Trains move every frame, so draw them on one canvas instead of creating map markers.
  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    const canvas = trainCanvasRef.current;
    if (!mapReady || !map || !maps || !canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const projection = map.getProjection();
      const center = projection.fromCoordToOffset(map.getCenter()) as OffsetPoint;
      const originX = center.x - width / 2;
      const originY = center.y - height / 2;
      const selected = selectedLineIdsRef.current;
      const now = Date.now();

      if (map.getZoom() >= STATION_DOTS_MIN_ZOOM) {
        linesRef.current.forEach((line) => {
          const dimmed = selected.length > 0 && !selected.includes(line.id);
          context.globalAlpha = dimmed ? 0.15 : 0.5;
          context.fillStyle = line.color;
          line.stations.forEach((station) => {
            const offset = projection.fromCoordToOffset(new maps.LatLng(station.lat, station.lng)) as OffsetPoint;
            const x = offset.x - originX;
            const y = offset.y - originY;
            if (x < -4 || y < -4 || x > width + 4 || y > height + 4) return;
            context.beginPath();
            context.arc(x, y, 2.5, 0, Math.PI * 2);
            context.fill();
          });
        });
        context.globalAlpha = 1;
      }

      trainsRef.current.forEach((train) => {
        const offset = projection.fromCoordToOffset(new maps.LatLng(train.point.lat, train.point.lng)) as OffsetPoint;
        const x = offset.x - originX;
        const y = offset.y - originY;
        if (x < -12 || y < -12 || x > width + 12 || y > height + 12) return;

        const pulsing = train.pulseUntil > now;
        const dimmed = selected.length > 0 && !selected.includes(train.lineId);
        const color = lineColorsRef.current.get(train.lineId) ?? '#333333';
        const radius = pulsing ? 4 : 3;
        context.globalAlpha = dimmed ? 0.3 : 1;
        if (pulsing && !dimmed) {
          context.beginPath();
          context.arc(x, y, radius + 3, 0, Math.PI * 2);
          context.fillStyle = 'rgba(255, 255, 255, 0.45)';
          context.fill();
        }
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
        context.lineWidth = 1;
        context.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        context.stroke();
      });
      context.globalAlpha = 1;
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [mapReady]);

  return (
    <div className="map-root" data-theme={theme}>
      <div ref={containerRef} className="map-host" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <canvas ref={trainCanvasRef} className="train-canvas" aria-hidden="true" />
      {mapError && <div className="map-error" role="alert">{mapError}</div>}
    </div>
  );
}
