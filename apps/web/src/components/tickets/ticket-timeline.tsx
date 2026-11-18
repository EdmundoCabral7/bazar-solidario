import { EVENT_TYPES, SUPPORT_LEVELS, TICKET_STATUS } from '@/lib/labels';
import type { TicketEvent } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

function describe(e: TicketEvent) {
  if (e.type === 'STATUS_CHANGED')
    return `${TICKET_STATUS[e.fromValue ?? ''] ?? e.fromValue ?? ''} → ${TICKET_STATUS[e.toValue ?? ''] ?? e.toValue}`;
  if (e.type === 'ESCALATED')
    return `${SUPPORT_LEVELS[e.fromValue ?? ''] ?? e.fromValue} → ${SUPPORT_LEVELS[e.toValue ?? ''] ?? e.toValue}`;
  return null;
}

export function TicketTimeline({ events }: { events: TicketEvent[] }) {
  return (
    <ol className="space-y-3 border-l-2 border-border pl-4">
      {events.map((e, i) => (
        <li key={e.id ?? i} className="relative">
          <span
            aria-hidden
            className="absolute -left-[22px] top-1.5 size-2.5 rounded-full bg-primary"
          />
          <p className="text-sm">
            <strong>{EVENT_TYPES[e.type]}</strong>
            {describe(e) && <span className="text-muted-foreground"> · {describe(e)}</span>}
            <span className="text-muted-foreground"> · {formatDateTime(e.createdAt)}</span>
            {e.author && <span className="text-muted-foreground"> · {e.author.name}</span>}
          </p>
          {e.message && <p className="mt-0.5 whitespace-pre-line text-sm">{e.message}</p>}
        </li>
      ))}
    </ol>
  );
}
