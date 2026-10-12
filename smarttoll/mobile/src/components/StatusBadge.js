import { Badge } from './ui';

/** A trip's progress: planned (saved) → in progress (GPS tracking) → completed (arrived). */
export default function StatusBadge({ status, style }) {
  if (status === 'completed') return <Badge tone="ok" style={style}>Completed</Badge>;
  if (status === 'in_progress') return <Badge tone="warn" style={style}>In progress</Badge>;
  return <Badge style={style}>Planned</Badge>;
}
