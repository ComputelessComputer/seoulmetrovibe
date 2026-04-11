import { LINE_INFO } from '../constants';
import type { Line } from '../types';

const DEFAULT_DESCRIPTION =
  "Every train, a note. Seoul's subway never stops. Each train is a note in an endless generative score. Click a line to listen.";

interface SidePanelProps {
  getBadgeLabel: (lineName: string) => string;
  lines: Line[];
  onLineSelect: (lineId: string) => void;
  selectedLineId: string | null;
  totalTrainCount: number;
}

export function SidePanel({
  getBadgeLabel,
  lines,
  onLineSelect,
  selectedLineId,
  totalTrainCount,
}: SidePanelProps) {
  const selectedLine = selectedLineId ? lines.find((line) => line.id === selectedLineId) ?? null : null;
  const lineInfo = selectedLine ? LINE_INFO[selectedLine.name] : null;

  return (
    <div className="side-panel" aria-label="Line legend and line filters">
      <div className="side-panel-metric">{`${totalTrainCount} TRAINS IN MOTION`}</div>
      <div className="side-panel-grid">
        {lines.map((line) => (
          <button
            key={line.id}
            type="button"
            className={`legend-item ${selectedLineId === line.id ? 'is-selected' : ''} ${
              selectedLineId !== null && selectedLineId !== line.id ? 'is-dimmed' : ''
            }`}
            title={line.name}
            aria-label={`Solo ${line.name}`}
            aria-pressed={selectedLineId === line.id}
            onClick={() => onLineSelect(line.id)}
          >
            <span className="legend-badge" style={{ backgroundColor: line.color }} aria-hidden="true">
              {getBadgeLabel(line.name)}
            </span>
          </button>
        ))}
      </div>
      <div className="side-panel-separator" aria-hidden="true" />
      <div className="side-panel-context" aria-live="polite">
        <div className={`side-panel-copy ${selectedLine ? 'is-hidden' : 'is-visible'}`}>
          <p className="side-panel-description">{DEFAULT_DESCRIPTION}</p>
        </div>
        <div className={`side-panel-copy ${selectedLine ? 'is-visible' : 'is-hidden'}`}>
          {lineInfo ? (
            <>
              <div className="side-panel-instrument">{lineInfo.instrument}</div>
              <p className="side-panel-description">{lineInfo.description}</p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
