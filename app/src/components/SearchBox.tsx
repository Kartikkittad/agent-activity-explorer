import { forwardRef, useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 300;

interface Props {
  value: string;
  onCommit: (value: string) => void;
}

/**
 * Local draft state so typing stays instant; the URL (and the request) only
 * updates once the user pauses. If the URL changes from elsewhere (back/forward,
 * "Clear filters"), the draft follows it.
 */
export const SearchBox = forwardRef<HTMLInputElement, Props>(function SearchBox({ value, onCommit }, ref) {
  const [draft, setDraft] = useState(value);
  const committed = useRef(value);

  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setDraft(value);
    }
  }, [value]);

  useEffect(() => {
    if (draft.trim() === committed.current.trim()) return;
    const timer = setTimeout(() => {
      committed.current = draft.trim();
      onCommit(draft);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, onCommit]);

  return (
    <div className="search">
      <label htmlFor="search-input" className="visually-hidden">
        Search events
      </label>
      <svg className="search-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M8.5 3a5.5 5.5 0 1 0 3.4 9.8l3.6 3.7 1.1-1.1-3.7-3.6A5.5 5.5 0 0 0 8.5 3Zm0 1.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
      </svg>
      <input
        ref={ref}
        id="search-input"
        type="search"
        placeholder="Search agent, tool or args"
        autoComplete="off"
        spellCheck={false}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            committed.current = draft.trim();
            onCommit(draft);
          } else if (event.key === 'Escape' && draft) {
            // Clear the field first; a second Escape can close the detail panel.
            event.preventDefault();
            setDraft('');
          }
        }}
      />
      <kbd className="search-hint" aria-hidden="true">
        /
      </kbd>
    </div>
  );
});
