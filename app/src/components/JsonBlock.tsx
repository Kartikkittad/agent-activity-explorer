import { useMemo, useState } from 'react';
import { prettyJson } from '../lib/format';

const COLLAPSE_OVER_LINES = 40;

export function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const text = useMemo(() => prettyJson(value), [value]);
  const lineCount = useMemo(() => text.split('\n').length, [text]);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const collapsible = lineCount > COLLAPSE_OVER_LINES;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (permissions, insecure context); nothing useful to show.
    }
  };

  return (
    <section className="json-block">
      <div className="json-header">
        <h3>{label}</h3>
        <button type="button" className="link-button" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className={collapsible && !expanded ? 'is-collapsed' : undefined} tabIndex={0} aria-label={`${label} JSON`}>
        <code>{text}</code>
      </pre>
      {collapsible && (
        <button type="button" className="link-button" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : `Show all ${lineCount} lines`}
        </button>
      )}
    </section>
  );
}
