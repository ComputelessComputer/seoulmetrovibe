import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import { MapView } from './components/MapView';
import { SidePanel } from './components/SidePanel';
import { fetchMetroData } from './data/metroData';
import { fetchLivePositions } from './data/liveApi';
import { advanceTrains, createDemoTrains, hydrateLiveTrains, renderTrains } from './simulation/trainEngine';
import type { DataMode, Line, ThemeMode, Train, TrainRenderState } from './types';

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
  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const [dataMode, setDataMode] = useState<DataMode>('demo');
  const [error, setError] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<AudioEngine | null>(null);
  const frameRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number>(0);
  const handledPulseRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    audioRef.current = new AudioEngine();
    audioRef.current.setMuted(isMuted);
    return () => {
      audioRef.current?.dispose();
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  // init once only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    audioRef.current?.setMuted(isMuted);
  }, [isMuted]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyThemePreference = (event: MediaQueryList | MediaQueryListEvent) => {
      setThemeMode(event.matches ? 'dark' : 'light');
    };

    applyThemePreference(mediaQuery);
    mediaQuery.addEventListener('change', applyThemePreference);
    return () => {
      mediaQuery.removeEventListener('change', applyThemePreference);
    };
  }, []);

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
  useEffect(() => {
    if (renderStates.length === 0) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const now = Date.now();
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

      try {
        audio.play(line.name, train.progress, train.express);
      } catch (error) {
        console.error(`Audio playback crashed for ${train.id}.`, error);
      }
    });
  }, [audioEnabled, lines.length, linesById, renderStates, selectedLineId]);

  const legendLines = useMemo(() => lines.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko')), [lines]);

  function handleLineToggle(lineId: string) {
    setSelectedLineId((current) => (current === lineId ? null : lineId));
  }

  function handleLineClear() {
    setSelectedLineId(null);
  }

  function handleMuteToggle() {
    setIsMuted((current) => !current);
  }

  return (
    <div className="app-shell">
      <MapView
        lines={lines}
        onClearSelection={handleLineClear}
        onLineSelect={handleLineToggle}
        selectedLineId={selectedLineId}
        theme={themeMode}
        trains={renderStates}
      />

      <SidePanel
        getBadgeLabel={getLineBadgeLabel}
        lines={legendLines}
        onLineSelect={handleLineToggle}
        onToggleMute={handleMuteToggle}
        muted={isMuted}
        selectedLineId={selectedLineId}
        totalTrainCount={renderStates.length}
      />

      {error ? <div className="sr-only">{error}</div> : null}
      {dataMode === 'live' ? <div className="sr-only">Live mode</div> : null}
    </div>
  );
}

export default App;
