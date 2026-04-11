import { GITHUB_REPO_URL, LINE_INFO } from '../constants';
import type { Line } from '../types';

const DEFAULT_DESCRIPTION =
  "Every train, a note. Seoul's subway never stops. Each train is a note in an endless generative score. Click a line to listen.";

function MuteIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 14h4l5 4V6L8 10H4z" />
        <path d="M17 9l4 6" />
        <path d="M21 9l-4 6" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 14h4l5 4V6L8 10H4z" />
      <path d="M17 9a5 5 0 0 1 0 6" />
      <path d="M19.5 6.5a8.5 8.5 0 0 1 0 11" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-3.162 19.489c.5.093.682-.216.682-.48 0-.236-.009-.864-.014-1.696-2.776.603-3.362-1.338-3.362-1.338-.454-1.153-1.109-1.46-1.109-1.46-.907-.62.069-.607.069-.607 1.003.071 1.53 1.03 1.53 1.03.891 1.528 2.336 1.086 2.905.831.091-.646.349-1.086.635-1.336-2.217-.252-4.549-1.109-4.549-4.939 0-1.091.39-1.984 1.029-2.683-.103-.252-.446-1.268.098-2.644 0 0 .84-.269 2.75 1.025A9.56 9.56 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.908-1.294 2.747-1.025 2.747-1.025.546 1.376.202 2.392.1 2.644.64.699 1.028 1.592 1.028 2.683 0 3.839-2.336 4.684-4.56 4.931.359.309.679.92.679 1.854 0 1.339-.012 2.42-.012 2.75 0 .266.18.577.688.479A10.002 10.002 0 0 0 12 2z" />
    </svg>
  );
}

interface SidePanelProps {
  getBadgeLabel: (lineName: string) => string;
  lines: Line[];
  onLineSelect: (lineId: string) => void;
  onToggleMute: () => void;
  muted: boolean;
  selectedLineId: string | null;
  totalTrainCount: number;
}

export function SidePanel({
  getBadgeLabel,
  lines,
  onLineSelect,
  onToggleMute,
  muted,
  selectedLineId,
  totalTrainCount,
}: SidePanelProps) {
  const selectedLine = selectedLineId ? lines.find((line) => line.id === selectedLineId) ?? null : null;
  const lineInfo = selectedLine ? LINE_INFO[selectedLine.name] : null;
  const selectedLineLabel = selectedLine ? getBadgeLabel(selectedLine.name) : null;

  return (
    <div className="side-panel" aria-label="Line legend and line filters">
      <div className="side-panel-metric">{`${totalTrainCount} TRAINS IN MOTION`}</div>
      <div className="side-panel-grid">
        {lines.map((line) => {
          const lineLabel = getBadgeLabel(line.name);
          return (
            <button
              key={line.id}
              type="button"
              className={`legend-item ${selectedLineId === line.id ? 'is-selected' : ''} ${
                selectedLineId !== null && selectedLineId !== line.id ? 'is-dimmed' : ''
              }`}
              title={lineLabel}
              aria-label={`${lineLabel}만 듣기`}
              aria-pressed={selectedLineId === line.id}
              onClick={() => onLineSelect(line.id)}
            >
              <span className="legend-badge" style={{ backgroundColor: line.color }} aria-hidden="true">
                {lineLabel}
              </span>
            </button>
          );
        })}
      </div>
      <div className="side-panel-separator" aria-hidden="true" />
      <div className="side-panel-actions">
        <button
          type="button"
          className="side-panel-icon-button"
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          title={muted ? 'Unmute audio' : 'Mute audio'}
        >
          <MuteIcon muted={muted} />
        </button>
        <a
          className="side-panel-icon-button"
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Open GitHub repository"
          title="Open GitHub repository"
        >
          <GitHubIcon />
        </a>
      </div>
      <div className="side-panel-context" aria-live="polite">
        <div className={`side-panel-copy ${selectedLine ? 'is-hidden' : 'is-visible'}`}>
          <p className="side-panel-description">{DEFAULT_DESCRIPTION}</p>
        </div>
        <div className={`side-panel-copy ${selectedLine ? 'is-visible' : 'is-hidden'}`}>
          {lineInfo ? (
            <>
              <div className="side-panel-line-name">{selectedLineLabel}</div>
              <div className="side-panel-instrument">{lineInfo.instrument}</div>
              <p className="side-panel-description">{lineInfo.description}</p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
