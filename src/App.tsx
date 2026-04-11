import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import { BarsView } from './components/BarsView';
import { MapView } from './components/MapView';
import { fetchMetroData } from './data/metroData';
import { fetchLivePositions } from './data/liveApi';
import { advanceTrains, createDemoTrains, hydrateLiveTrains, renderTrains } from './simulation/trainEngine';
import type { DataMode, Line, ThemeMode, Train, TrainRenderState, ViewMode } from './types';

function getLineBadgeLabel(lineName: string): string {
  const numberMatch = lineName.match(/^(\d+)호선$/);
  if (numberMatch) {
    return numberMatch[1];
  }

  const badgeMap: Record<string, string> = {
    분당선: 'BD',
    수인분당선: 'BD',
    신분당선: 'SBD',
    공항철도: 'AE',
    경의중앙선: 'GJ',
    경춘선: 'GC',
    경강선: 'GK',
    우이신설선: 'UI',
  };

  return badgeMap[lineName] ?? lineName.replace(/\s+/g, '').slice(0, 3).toUpperCase();
}

function App() {
  const [lines, setLines] = useState<Line[]>([]);
  const [trains, setTrains] = useState<Train[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [dataMode, setDataMode] = useState<DataMode>('demo');
  const [error, setError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPending, setLocationPending] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioRef = useRef<AudioEngine | null>(null);
  const frameRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number>(0);
  const handledPulseRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    audioRef.current = new AudioEngine();
    return () => {
      audioRef.current?.dispose();
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    const enableAudio = () => {
      void (async () => {
        try {
          const started = await audioRef.current?.start();
          if (started) {
            setAudioEnabled(true);
            window.removeEventListener('pointerdown', enableAudio);
          }
        } catch (error) {
          console.error('Audio startup crashed during pointer interaction.', error);
        }
      })();
    };

    window.addEventListener('pointerdown', enableAudio);
    return () => {
      window.removeEventListener('pointerdown', enableAudio);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const metro = await fetchMetroData();
        if (cancelled) {
          return;
        }

        setLines(metro.lines);

        try {
          const livePositions = await fetchLivePositions();
          if (cancelled) {
            return;
          }
          const liveTrains = hydrateLiveTrains(metro.lines, livePositions);
          if (liveTrains.length > 0) {
            setDataMode('live');
            setTrains(liveTrains);
            return;
          }
        } catch {
          setDataMode('demo');
        }

        setTrains(createDemoTrains(metro.lines));
      } catch (loadError) {
        console.error('Failed to load metro data.', loadError);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load metro data');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (lines.length === 0 || trains.length === 0) {
      return;
    }

    const tick = (timestamp: number) => {
      if (previousTimeRef.current === 0) {
        previousTimeRef.current = timestamp;
      }
      const deltaMs = timestamp - previousTimeRef.current;
      previousTimeRef.current = timestamp;
      setTrains((current) => advanceTrains(current, deltaMs, dataMode, Date.now()));
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      previousTimeRef.current = 0;
    };
  }, [dataMode, lines.length, trains.length]);

  const renderStates = useMemo<TrainRenderState[]>(() => renderTrains(lines, trains), [lines, trains]);
  const linesById = useMemo(() => new Map(lines.map((line) => [line.id, line])), [lines]);
  const selectedLine = selectedLineId ? linesById.get(selectedLineId) ?? null : null;
  const selectedLineTrainCount = useMemo(
    () => (selectedLineId ? renderStates.filter((train) => train.lineId === selectedLineId).length : 0),
    [renderStates, selectedLineId],
  );

  useEffect(() => {
    if (renderStates.length === 0) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const now = Date.now();
    const lineCounts = new Map<string, number>();
    renderStates.forEach((train) => {
      lineCounts.set(train.lineId, (lineCounts.get(train.lineId) ?? 0) + 1);
    });

    const pulsingTrains = renderStates.filter((train) => {
      const lastHandledPulse = handledPulseRef.current.get(train.id) ?? 0;
      return train.pulseUntil > now && train.pulseUntil !== lastHandledPulse;
    });

    if (pulsingTrains.length === 0) {
      return;
    }

    pulsingTrains.forEach((train) => {
      handledPulseRef.current.set(train.id, train.pulseUntil);
      const line = linesById.get(train.lineId);
      if (!line || !audioEnabled || (selectedLineId !== null && train.lineId !== selectedLineId)) {
        return;
      }

      const density = (lineCounts.get(train.lineId) ?? 1) / Math.max(1, lines.length * 3);
      try {
        audio.play(line.name, train.progress, density, train.express);
      } catch (error) {
        console.error(`Audio playback crashed for ${train.id}.`, error);
      }
    });
  }, [audioEnabled, lines.length, linesById, renderStates, selectedLineId]);

  const legendLines = useMemo(() => lines.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko')), [lines]);

  function handleLocate() {
    if (!navigator.geolocation) {
      return;
    }
    setLocationPending(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMapCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationPending(false);
      },
      (geoError) => {
        console.error('Failed to get current location.', geoError);
        setLocationPending(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function handleLineToggle(lineId: string) {
    setSelectedLineId((current) => (current === lineId ? null : lineId));
  }

  function handleLineClear() {
    setSelectedLineId(null);
  }

  return (
    <div className="app-shell">
      {viewMode === 'map' ? (
        <MapView
          center={mapCenter}
          lines={lines}
          onClearSelection={handleLineClear}
          onLineSelect={handleLineToggle}
          selectedLineId={selectedLineId}
          theme={themeMode}
          trains={renderStates}
        />
      ) : (
        <BarsView
          lines={legendLines}
          onLineSelect={handleLineToggle}
          selectedLineId={selectedLineId}
          trains={renderStates}
        />
      )}

      <div className="top-left-legend">
        {legendLines.map((line) => (
          <button
            key={line.id}
            type="button"
            className={`legend-item ${selectedLineId === line.id ? 'is-selected' : ''} ${
              selectedLineId !== null && selectedLineId !== line.id ? 'is-dimmed' : ''
            }`}
            title={line.name}
            aria-label={`Listen to ${line.name}`}
            aria-pressed={selectedLineId === line.id}
            onClick={() => handleLineToggle(line.id)}
          >
            <span
              className="legend-badge"
              style={{ backgroundColor: line.color }}
              aria-hidden="true"
            >
              {getLineBadgeLabel(line.name)}
            </span>
          </button>
        ))}
      </div>

      <div className="top-center-status">
        <span className="live-dot" />
        <span>{renderStates.length} trains running</span>
      </div>

      <div className="bottom-center-controls">
        <div className="pill-toggle" role="tablist" aria-label="View selector">
          <button
            type="button"
            className={viewMode === 'map' ? 'is-active' : ''}
            onClick={() => setViewMode('map')}
          >
            MAP
          </button>
          <button
            type="button"
            className={viewMode === 'bars' ? 'is-active' : ''}
            onClick={() => setViewMode('bars')}
          >
            BARS
          </button>
        </div>
        <div className="pill-toggle" role="tablist" aria-label="Theme selector">
          <button
            type="button"
            className={themeMode === 'dark' ? 'is-active' : ''}
            onClick={() => setThemeMode('dark')}
          >
            DARK
          </button>
          <button
            type="button"
            className={themeMode === 'light' ? 'is-active' : ''}
            onClick={() => setThemeMode('light')}
          >
            LIGHT
          </button>
        </div>
        <button
          type="button"
          className={`location-button ${locationPending ? 'is-pending' : ''}`}
          onClick={handleLocate}
          aria-label="Use current location"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.5a1 1 0 0 1 1 1V5.1a6.9 6.9 0 0 1 5.9 5.9H20.5a1 1 0 1 1 0 2h-1.6a6.9 6.9 0 0 1-5.9 5.9v1.6a1 1 0 1 1-2 0v-1.6a6.9 6.9 0 0 1-5.9-5.9H3.5a1 1 0 1 1 0-2h1.6A6.9 6.9 0 0 1 11 5.1V3.5a1 1 0 0 1 1-1Zm0 4.6A4.9 4.9 0 1 0 12 17a4.9 4.9 0 0 0 0-9.8Zm0 2.4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" />
          </svg>
        </button>
      </div>

      {selectedLine ? (
        <div className="bottom-center-selection" aria-live="polite">
          {`You are hearing ${selectedLine.name}. ${selectedLineTrainCount} trains, one instrument.`}
        </div>
      ) : null}

      {error ? <div className="sr-only">{error}</div> : null}
      {dataMode === 'live' ? <div className="sr-only">Live mode</div> : null}
    </div>
  );
}

export default App;
