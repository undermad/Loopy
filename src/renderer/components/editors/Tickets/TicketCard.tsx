import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, ArrowDown, ArrowUp, Bug, CheckSquare, FlaskConical, Minus } from 'lucide-react';
import type { Label, Ticket, TicketPriority, TicketType } from '@shared/tickets';
import { useTranslation } from '@renderer/lib/i18n';
import { Tag, cx } from '@renderer/ui';
import type { TicketDragData } from './dnd';
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
  sortable?: boolean;
  overlay?: boolean;
}

export function TicketCard({
  ticket,
  ticketKey,
  labels,
  selected,
  onSelect,
  variant = 'card',
  sortable = true,
  overlay = false,
}: TicketCardProps) {
  const { t } = useTranslation('editors');
  const data: TicketDragData = { type: 'ticket', id: ticket.id, stateId: ticket.stateId };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
    data,
    disabled: { draggable: !sortable || overlay, droppable: !sortable || overlay },
  });
  const TypeIcon = TYPE_ICONS[ticket.type];
  const PriorityIcon = PRIORITY_ICONS[ticket.priority];

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : { transform: CSS.Transform.toString(transform), transition }}
      {...(overlay ? {} : { ...attributes, ...listeners })}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${ticketKey} ${ticket.title}`}
      className={cx(
        styles['card'],
        styles[variant],
        selected && styles['selected'],
        isDragging && styles['dragging'],
        overlay && styles['overlay'],
      )}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onSelect();
          return;
        }
        if (!overlay) listeners?.['onKeyDown']?.(event);
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
