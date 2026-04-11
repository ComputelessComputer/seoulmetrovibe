import type { CSSProperties } from 'react';
import type { Line, TrainRenderState } from '../types';

interface BarsViewProps {
  getBadgeLabel: (lineName: string) => string;
  lines: Line[];
  onLineSelect: (lineId: string) => void;
  selectedLineLabel: string | null;
  selectedLineId: string | null;
  selectedLineTrainCount: number;
  totalTrainCount: number;
  trains: TrainRenderState[];
}

export function BarsView({
  getBadgeLabel,
  lines,
  onLineSelect,
  selectedLineLabel,
  selectedLineId,
  selectedLineTrainCount,
  totalTrainCount,
  trains,
}: BarsViewProps) {
  return (
    <div className="bars-root">
      <div className="bars-header" aria-live="polite">
        <span className="bars-header-metric">{`${totalTrainCount} TRAINS IN MOTION`}</span>
        {selectedLineLabel ? (
          <span className="bars-header-selection">{`${selectedLineLabel} · ${selectedLineTrainCount} TRAINS`}</span>
        ) : null}
      </div>
      <div className="bars-scroll">
        {lines.map((line) => {
          const lineTrains = trains.filter((train) => train.lineId === line.id);
          const isSelected = selectedLineId === line.id;
          const isDimmed = selectedLineId !== null && !isSelected;
          return (
            <button
              key={line.id}
              type="button"
              className={`bar-line ${isSelected ? 'is-selected' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
              onClick={() => onLineSelect(line.id)}
              aria-label={`Solo ${line.name}`}
              aria-pressed={isSelected}
            >
              <span
                className="legend-badge bar-line-badge"
                style={{ backgroundColor: line.color }}
                aria-hidden="true"
              >
                {getBadgeLabel(line.name)}
              </span>
              <div className="bar-track-wrap">
                <div
                  className="bar-track"
                  style={{ '--line-color': line.color } as CSSProperties}
                >
                  {line.stations.map((station, index) => (
                    <span
                      key={`${line.id}-${station.id}-${index}`}
                      className="bar-station"
                      style={{ left: `${(index / Math.max(1, line.stations.length - 1)) * 100}%` }}
                    />
                  ))}
                  {lineTrains.map((train) => (
                    <span
                      key={train.id}
                      className={`bar-train ${train.pulseUntil > Date.now() ? 'is-pulsing' : ''}`}
                      style={{ left: `${train.stationProgress * 100}%`, backgroundColor: line.color }}
                    />
                  ))}
                </div>
              </div>
              <div className="bar-count" style={{ color: line.color }}>
                {lineTrains.length}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
