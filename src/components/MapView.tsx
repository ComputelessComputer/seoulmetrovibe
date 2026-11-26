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

function metersPerPixel(latitude: number, zoom: number): number {
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
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
  const stationLayerRef = useRef<Array<{ overlay: any; point: GeoPoint }>>([]);
  const trainLayerRef = useRef<any[]>([]);
  const hasFitRef = useRef(false);
  const latestPropsRef = useRef({ lines, onClearSelection, onLineSelect });
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  latestPropsRef.current = { lines, onClearSelection, onLineSelect };

  useEffect(() => {
    if (!containerRef.current) return;
    const clientId = window.__NAVER_MAPS_CLIENT_ID__ ?? '';
    if (!clientId) {
      setMapError('Naver Maps is not configured. Add VITE_NAVER_MAPS_CLIENT_ID and redeploy.');
      return;
    }

    let cancelled = false;
    let clickListener: any;
    let zoomListener: any;

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

        const updateStationVisibility = () => {
          const currentMap = mapRef.current;
          if (!currentMap) return;
          const showStations = currentMap.getZoom() >= STATION_DOTS_MIN_ZOOM;
          stationLayerRef.current.forEach(({ overlay, point }) => {
            overlay.setOptions({ radius: metersPerPixel(point.lat, currentMap.getZoom()) * 1.5 });
            overlay.setMap(showStations ? currentMap : null);
          });
        };

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

        zoomListener = maps.Event.addListener(map, 'zoom_changed', updateStationVisibility);
        setMapReady(true);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : 'Naver Maps could not be loaded.');
        }
      });

    return () => {
      cancelled = true;
      const maps = mapsRef.current;
      const map = mapRef.current;
      if (maps && clickListener) maps.Event.removeListener(clickListener);
      if (maps && zoomListener) maps.Event.removeListener(zoomListener);
      [...lineLayerRef.current, ...stationLayerRef.current.map((item) => item.overlay), ...trainLayerRef.current]
        .forEach((overlay) => overlay.setMap(null));
      lineLayerRef.current = [];
      stationLayerRef.current = [];
      trainLayerRef.current = [];
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
    stationLayerRef.current.forEach(({ overlay }) => overlay.setMap(null));
    lineLayerRef.current = [];
    stationLayerRef.current = [];

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

      line.stations.forEach((station) => {
        const point = { lat: station.lat, lng: station.lng };
        const overlay = new maps.Circle({
          map: map.getZoom() >= STATION_DOTS_MIN_ZOOM ? map : null,
          center: new maps.LatLng(point.lat, point.lng),
          radius: metersPerPixel(point.lat, map.getZoom()) * 1.5,
          fillColor: line.color,
          fillOpacity: selectedLineIds.length > 0 && !isSelected ? 0.15 : 0.5,
          strokeOpacity: 0,
          clickable: false,
          zIndex: 2,
        });
        stationLayerRef.current.push({ overlay, point });
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

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!mapReady || !map || !maps) return;

    trainLayerRef.current.forEach((overlay) => overlay.setMap(null));
    trainLayerRef.current = [];

    const now = Date.now();
    trains.forEach((train) => {
      const pulsing = train.pulseUntil > now;
      const isDimmed = selectedLineIds.length > 0 && !selectedLineIds.includes(train.lineId);
      const color = lines.find((line) => line.id === train.lineId)?.color ?? '#333333';
      const size = pulsing ? 8 : 6;
      const marker = new maps.Marker({
        map,
        position: new maps.LatLng(train.point.lat, train.point.lng),
        clickable: false,
        zIndex: 20,
        icon: {
          content: `<span class="train-marker${pulsing ? ' is-pulsing' : ''}${isDimmed ? ' is-dimmed' : ''}" style="--train-color: ${color}"></span>`,
          size: new maps.Size(size, size),
          anchor: new maps.Point(size / 2, size / 2),
        },
      });
      trainLayerRef.current.push(marker);
    });
  }, [lines, mapReady, selectedLineIds, trains]);

  return (
    <div ref={containerRef} className="map-root" data-theme={theme}>
      {mapError && <div className="map-error" role="alert">{mapError}</div>}
    </div>
  );
}
