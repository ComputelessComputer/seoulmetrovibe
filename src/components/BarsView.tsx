import type { CSSProperties } from 'react';
import type { Line, TrainRenderState } from '../types';

interface BarsViewProps {
  lines: Line[];
  trains: TrainRenderState[];
}

export function BarsView({ lines, trains }: BarsViewProps) {
  return (
    <div className="bars-root">
      {lines.map((line) => {
        const lineTrains = trains.filter((train) => train.lineId === line.id);
        return (
          <div key={line.id} className="bar-line">
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
          </div>
        );
      })}
    </div>
  );
}
