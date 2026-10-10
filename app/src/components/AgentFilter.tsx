import { useEffect, useId, useRef, useState } from 'react';
import { useAgents } from '../api/queries';

interface Props {
  selected: string[];
  onChange: (agents: string[]) => void;
}

export function AgentFilter({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  const agents = useAgents();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) rootRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, [open, agents.isSuccess]);

  const toggle = (agent: string) => {
    onChange(selected.includes(agent) ? selected.filter((a) => a !== agent) : [...selected, agent]);
  };

  // Agents in the URL that the API doesn't list still need to be visible so they can be removed.
  const options = [...new Set([...(agents.data ?? []), ...selected])].sort();

  const label =
    selected.length === 0 ? 'All agents' : selected.length === 1 ? selected[0] : `${selected.length} agents`;

  return (
    <div
      className="agent-filter"
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
      onBlur={(event) => {
        // Close when focus tabs out. A null relatedTarget is a click on something
        // unfocusable (e.g. a label's text); outside clicks are handled by pointerdown.
        const next = event.relatedTarget as Node | null;
        if (open && next && !rootRef.current?.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={`select-button${selected.length ? ' is-active' : ''}`}
        aria-expanded={open}
        aria-controls={popoverId}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="select-button-prefix">Agent</span>
        <span className="select-button-value">{label}</span>
        <svg viewBox="0 0 20 20" aria-hidden="true" className="chevron">
          <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      {open && (
        <div className="popover" id={popoverId} role="group" aria-label="Filter by agent">
          {agents.isPending && (
            <p className="popover-note" role="status">
              Loading agents…
            </p>
          )}
          {agents.isError && (
            <div className="popover-note" role="alert">
              Couldn't load the agent list.{' '}
              <button type="button" className="link-button" onClick={() => agents.refetch()}>
                Try again
              </button>
            </div>
          )}
          {options.length > 0 && (
            <ul className="checkbox-list">
              {options.map((agent) => (
                <li key={agent}>
                  <label>
                    <input type="checkbox" checked={selected.includes(agent)} onChange={() => toggle(agent)} />
                    <span>{agent}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {selected.length > 0 && (
            <div className="popover-footer">
              <button type="button" className="link-button" onClick={() => onChange([])}>
                Clear agents
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
