import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { SEOUL_CENTER, SEOUL_ZOOM } from '../constants';
import type { GeoPoint, Line, ThemeMode, TrainRenderState } from '../types';

interface MapViewProps {
  center?: GeoPoint | null;
  lines: Line[];
  onClearSelection: () => void;
  onLineSelect: (lineId: string) => void;
  selectedLineId: string | null;
  theme: ThemeMode;
  trains: TrainRenderState[];
}

const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors &copy; CARTO';
const TILE_URLS: Record<ThemeMode, string> = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/positron/{z}/{x}/{y}{r}.png',
};

export function MapView({
  center,
  lines,
  onClearSelection,
  onLineSelect,
  selectedLineId,
  theme,
  trains,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const lineLayerRef = useRef<L.LayerGroup | null>(null);
  const trainLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

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
    trainLayerRef.current = L.layerGroup().addTo(map);
    map.on('click', onClearSelection);
    mapRef.current = map;

    return () => {
      map.off('click', onClearSelection);
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
    };
  }, [onClearSelection, theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.off('click', onClearSelection);
    map.on('click', onClearSelection);

    return () => {
      map.off('click', onClearSelection);
    };
  }, [onClearSelection]);

  useEffect(() => {
    const tileLayer = tileLayerRef.current;
    if (!tileLayer) {
      return;
    }
    tileLayer.setUrl(TILE_URLS[theme]);
  }, [theme]);

  useEffect(() => {
    if (!center || !mapRef.current) {
      return;
    }
    mapRef.current.setView([center.lat, center.lng], 13, {
      animate: true,
    });
  }, [center]);

  useEffect(() => {
    const lineLayer = lineLayerRef.current;
    if (!lineLayer) {
      return;
    }
    lineLayer.clearLayers();

    lines.forEach((line) => {
      const isSelected = selectedLineId === line.id;
      const isDimmed = selectedLineId !== null && !isSelected;
      const branches = line.branches.length > 0 ? line.branches : [line.points];
      branches.forEach((branch) => {
        const polyline = L.polyline(
          branch.map((point) => [point.lat, point.lng] as [number, number]),
          {
            color: line.color,
            weight: isSelected ? 4 : 2.5,
            opacity: isDimmed ? 0.15 : 0.9,
            interactive: true,
            className: `metro-line ${isSelected ? 'is-selected' : ''} ${isDimmed ? 'is-dimmed' : ''}`,
          },
        );

        polyline.on('click', (event) => {
          L.DomEvent.stopPropagation(event);
          onLineSelect(line.id);
        });

        polyline.addTo(lineLayer);
      });
    });
  }, [lines, onLineSelect, selectedLineId]);

  useEffect(() => {
    const trainLayer = trainLayerRef.current;
    if (!trainLayer) {
      return;
    }
    trainLayer.clearLayers();

    const now = Date.now();
    trains.forEach((train) => {
      const pulsing = train.pulseUntil > now;
      const isDimmed = selectedLineId !== null && train.lineId !== selectedLineId;
      L.circleMarker([train.point.lat, train.point.lng], {
        radius: pulsing ? 6.5 : 5,
        color: lines.find((line) => line.id === train.lineId)?.color ?? '#333333',
        fillColor: lines.find((line) => line.id === train.lineId)?.color ?? '#333333',
        fillOpacity: isDimmed ? 0.35 : 1,
        weight: pulsing ? 2 : 1,
        opacity: isDimmed ? 0.35 : 1,
        className: pulsing ? 'train-marker is-pulsing' : 'train-marker',
        interactive: false,
      }).addTo(trainLayer);
    });
  }, [lines, selectedLineId, trains]);

  return <div ref={containerRef} className="map-root" />;
}
