import { useEffect, useRef, useState } from 'react';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { attachClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { AlertTriangle, ArrowDown, ArrowUp, Bug, CheckSquare, FlaskConical, Minus } from 'lucide-react';
import type { Label, Ticket, TicketPriority, TicketType } from '@shared/tickets';
import { useTranslation } from '@renderer/lib/i18n';
import { Tag, cx } from '@renderer/ui';
import type { CardDropData, TicketDragData } from './dnd';
import styles from './TicketCard.module.scss';

export const TYPE_ICONS: Record<TicketType, typeof Bug> = {
  task: CheckSquare,
  spike: FlaskConical,
  bug: Bug,
};
export const PRIORITY_ICONS: Record<TicketPriority, typeof Bug> = {
  low: ArrowDown,
  medium: Minus,
  high: ArrowUp,
  urgent: AlertTriangle,
};

export interface TicketCardProps {
  ticket: Ticket;
  ticketKey: string;
  labels: Label[];
  selected: boolean;
  onSelect: () => void;
  variant?: 'card' | 'row';
}

export function TicketCard({
  ticket,
  ticketKey,
  labels,
  selected,
  onSelect,
  variant = 'card',
}: TicketCardProps) {
  const { t } = useTranslation('editors');
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const TypeIcon = TYPE_ICONS[ticket.type];
  const PriorityIcon = PRIORITY_ICONS[ticket.priority];

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const drag: TicketDragData = { type: 'ticket', id: ticket.id, stateId: ticket.stateId };
    const drop: CardDropData = { type: 'card', id: ticket.id, stateId: ticket.stateId };
    return combine(
      draggable({
        element,
        getInitialData: () => ({ ...drag }),
        onDragStart: () => {
          setDragging(true);
        },
        onDrop: () => {
          setDragging(false);
        },
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => source.data['type'] === 'ticket' && source.data['id'] !== ticket.id,
        getData: ({ input, element: target }) =>
          attachClosestEdge({ ...drop }, { input, element: target, allowedEdges: ['top', 'bottom'] }),
      }),
    );
  }, [ticket.id, ticket.stateId]);

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${ticketKey} ${ticket.title}`}
      className={cx(
        styles['card'],
        styles[variant],
        selected && styles['selected'],
        dragging && styles['dragging'],
      )}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className={styles['head']}>
        <TypeIcon aria-label={t(`tickets.types.${ticket.type}`)} className={styles['type']} />
        <span className={styles['key']}>{ticketKey}</span>
        <PriorityIcon
          aria-label={t(`tickets.priorities.${ticket.priority}`)}
          className={cx(
            styles['priority'],
            ticket.priority === 'high' && styles['priorityHigh'],
            ticket.priority === 'urgent' && styles['priorityUrgent'],
          )}
        />
      </div>
      <p className={styles['title']}>{ticket.title}</p>
      {labels.length > 0 ? (
        <div className={styles['labels']}>
          {labels.map((label) => (
            <Tag key={label.id} color={label.color} size="sm">
              {label.name}
            </Tag>
          ))}
        </div>
      ) : null}
    </div>
  );
}
