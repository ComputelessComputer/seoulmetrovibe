import { useEffect, useRef } from 'react';
import L from 'leaflet';
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

const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors &copy; CARTO';
const TILE_URLS: Record<ThemeMode, string> = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
};
const STATION_DOTS_MIN_ZOOM = 13; // only show station dots when zoomed in enough
const LINE_CLICK_THRESHOLD_PX = 10;

function getPointToSegmentDistanceSquared(point: L.Point, start: L.Point, end: L.Point): number {
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

export function MapView({
  lines,
  onClearSelection,
  onLineSelect,
  selectedLineIds,
  theme,
  trains,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const lineLayerRef = useRef<L.LayerGroup | null>(null);
  const stationLayerRef = useRef<L.LayerGroup | null>(null);
  const trainLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const hasFitRef = useRef(false);

  function handleMapClick(event: L.LeafletMouseEvent) {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const thresholdSq = LINE_CLICK_THRESHOLD_PX * LINE_CLICK_THRESHOLD_PX;
    let closestLineId: string | null = null;
    let closestDistanceSq = Number.POSITIVE_INFINITY;

    lines.forEach((line) => {
      const branches = line.branches.length > 0 ? line.branches : [line.points];
      branches.forEach((branch) => {
        for (let index = 1; index < branch.length; index += 1) {
          const start = map.latLngToContainerPoint([branch[index - 1].lat, branch[index - 1].lng]);
          const end = map.latLngToContainerPoint([branch[index].lat, branch[index].lng]);
          const distanceSq = getPointToSegmentDistanceSquared(event.containerPoint, start, end);

          if (distanceSq < closestDistanceSq) {
            closestDistanceSq = distanceSq;
            closestLineId = line.id;
          }
        }
      });
    });

    if (closestLineId && closestDistanceSq <= thresholdSq) {
      const originalEvent = event.originalEvent as MouseEvent | undefined;
      onLineSelect(closestLineId, !!originalEvent && (originalEvent.metaKey || originalEvent.ctrlKey));
      return;
    }

    onClearSelection();
  }

  function syncStationLayerVisibility() {
    const map = mapRef.current;
    const stationLayer = stationLayerRef.current;
    if (!map || !stationLayer) {
      return;
    }

    const shouldShowStations = map.getZoom() >= STATION_DOTS_MIN_ZOOM;
    const hasStationLayer = map.hasLayer(stationLayer);

    if (shouldShowStations && !hasStationLayer) {
      stationLayer.addTo(map);
      return;
    }

    if (!shouldShowStations && hasStationLayer) {
      map.removeLayer(stationLayer);
    }
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([SEOUL_CENTER.lat, SEOUL_CENTER.lng], SEOUL_ZOOM);

    tileLayerRef.current = L.tileLayer(TILE_URLS[theme], {
      attribution: TILE_ATTRIBUTION,
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    lineLayerRef.current = L.layerGroup().addTo(map);
    stationLayerRef.current = L.layerGroup().addTo(map);
    trainLayerRef.current = L.layerGroup().addTo(map);
    map.on('zoomend', syncStationLayerVisibility);
    mapRef.current = map;
    syncStationLayerVisibility();

    return () => {
      map.off('zoomend', syncStationLayerVisibility);
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      stationLayerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // init once only — theme changes handled by separate effect

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.off('click');
    map.on('click', handleMapClick);

    return () => {
      map.off('click');
    };
  }, [lines, onClearSelection, onLineSelect]);

  useEffect(() => {
    const tileLayer = tileLayerRef.current;
    if (!tileLayer) {
      return;
    }
    tileLayer.setUrl(TILE_URLS[theme]);
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    const lineLayer = lineLayerRef.current;
    const stationLayer = stationLayerRef.current;
    if (!map || !lineLayer || !stationLayer) {
      return;
    }

    lineLayer.clearLayers();
    stationLayer.clearLayers();

    lines.forEach((line) => {
      const isSelected = selectedLineIds.includes(line.id);
      const isDimmed = selectedLineIds.length > 0 && !isSelected;
      const branches = line.branches.length > 0 ? line.branches : [line.points];
      branches.forEach((branch) => {
        const latLngs = branch.map((point) => [point.lat, point.lng] as [number, number]);
        const visibleLine = L.polyline(
          latLngs,
          {
            color: line.color,
            weight: isSelected ? 4 : 2.5,
            opacity: isDimmed ? 0.15 : 0.9,
            interactive: false,
            className: `metro-line ${isSelected ? 'is-selected' : ''} ${isDimmed ? 'is-dimmed' : ''}`,
          },
        );

        visibleLine.addTo(lineLayer);

        if (isSelected) {
          visibleLine.bringToFront();
        }
      });

      line.stations.forEach((station) => {
        L.circleMarker([station.lat, station.lng], {
          radius: 2,
          fillColor: line.color,
          fillOpacity: isDimmed ? 0.15 : 0.5,
          stroke: false,
          interactive: false,
        }).addTo(stationLayer);
      });
    });

    syncStationLayerVisibility();

    const stationPoints = lines.flatMap((line) =>
      line.stations.map((station) => [station.lat, station.lng] as [number, number]),
    );
    if (stationPoints.length > 0 && !hasFitRef.current) {
      hasFitRef.current = true;
      map.fitBounds(L.latLngBounds(stationPoints), {
        padding: [40, 40],
      });
    }
  }, [lines, selectedLineIds]);

  useEffect(() => {
    const trainLayer = trainLayerRef.current;
    if (!trainLayer) {
      return;
    }
    trainLayer.clearLayers();

    const now = Date.now();
    trains.forEach((train) => {
      const pulsing = train.pulseUntil > now;
      const isDimmed = selectedLineIds.length > 0 && !selectedLineIds.includes(train.lineId);
      L.circleMarker([train.point.lat, train.point.lng], {
        radius: pulsing ? 4 : 3,
        color: lines.find((line) => line.id === train.lineId)?.color ?? '#333333',
        fillColor: lines.find((line) => line.id === train.lineId)?.color ?? '#333333',
        fillOpacity: isDimmed ? 0.35 : 1,
        weight: pulsing ? 2 : 1,
        opacity: isDimmed ? 0.35 : 1,
        className: pulsing ? 'train-marker is-pulsing' : 'train-marker',
        interactive: false,
      }).addTo(trainLayer);
    });
  }, [lines, selectedLineIds, trains]);

  return <div ref={containerRef} className="map-root" />;
}
