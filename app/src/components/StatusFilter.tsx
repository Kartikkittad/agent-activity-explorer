import type { EventStatus } from '../api/types';
import { STATUSES } from '../lib/filters';

interface Props {
  value: EventStatus | null;
  onChange: (status: EventStatus | null) => void;
}

const OPTIONS: { value: EventStatus | null; label: string }[] = [
  { value: null, label: 'All' },
  ...STATUSES.map((status) => ({ value: status, label: status[0].toUpperCase() + status.slice(1) })),
];

export function StatusFilter({ value, onChange }: Props) {
  return (
    <fieldset className="segmented">
      <legend className="visually-hidden">Status</legend>
      {OPTIONS.map((option) => (
        <label key={option.label} className={`segment${option.value ? ` segment-${option.value}` : ''}`}>
          <input
            type="radio"
            name="status"
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
