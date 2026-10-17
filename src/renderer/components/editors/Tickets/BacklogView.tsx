import { useEffect, useRef } from 'react';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowRight, Inbox } from 'lucide-react';
import { ticketKey } from '@shared/tickets';
import { useTranslation } from '@renderer/lib/i18n';
import { useCurrentProject } from '@renderer/lib/project';
import {
  firstTodoState,
  labelsOf,
  matchesSearch,
  selectTicket,
  ticketActions,
  ticketsInState,
  useSelectedTicketId,
  useTicketsSnapshot,
} from '@renderer/lib/tickets';
import { Button, EmptyState, cx } from '@renderer/ui';
import { asDropData, isTicketDrag, targetIndex } from './dnd';
import { QuickAdd } from './QuickAdd';
import { TicketCard } from './TicketCard';
import styles from './BacklogView.module.scss';

const VIRTUAL_THRESHOLD = 100;

export function BacklogView({ search }: { search: string }) {
  const { t } = useTranslation('editors');
  const snapshot = useTicketsSnapshot();
  const project = useCurrentProject();
  const selectedId = useSelectedTicketId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const keyFor = (ticket: { number: number }) => ticketKey(project?.name ?? '', ticket.number);
  const tickets = ticketsInState(snapshot, null).filter((ticket) =>
    matchesSearch(ticket, keyFor(ticket), search),
  );
  const virtualizer = useVirtualizer({
    count: tickets.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 10,
    initialRect: { width: 0, height: 600 },
  });

  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) => isTicketDrag(source.data),
        onDrop: ({ source, location }) => {
          const target = location.current.dropTargets[0];
          if (!target || !isTicketDrag(source.data)) return;
          const drop = asDropData(target.data);
          if (drop?.stateId !== null) return;
          const closest = extractClosestEdge(target.data);
          const edge = closest === 'top' || closest === 'bottom' ? closest : null;
          void ticketActions.moveTo(source.data.id, null, targetIndex(snapshot, source.data, drop, edge));
        },
      }),
    [snapshot],
  );

  const board = firstTodoState(snapshot);
  const virtual = tickets.length > VIRTUAL_THRESHOLD;
  const rows = virtual
    ? virtualizer.getVirtualItems().map((item) => ({ index: item.index, start: item.start }))
    : tickets.map((_, index) => ({ index, start: null }));

  return (
    <div className={styles['backlog']}>
      <div className={styles['toolbar']}>
        <QuickAdd stateId={null} className={styles['quickAdd']} />
      </div>
      {tickets.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title={t('tickets.emptyBacklog')}
          description={t('tickets.emptyBacklogHint')}
        />
      ) : (
        <div ref={scrollRef} className={styles['list']}>
          <div style={virtual ? { height: virtualizer.getTotalSize(), position: 'relative' } : undefined}>
            {rows.map((item) => {
              const ticket = tickets[item.index];
              if (!ticket) return null;
              return (
                <div
                  key={ticket.id}
                  className={cx(styles['row'], virtual && styles['virtualRow'])}
                  style={
                    item.start === null ? undefined : { transform: `translateY(${String(item.start)}px)` }
                  }
                  ref={virtual ? virtualizer.measureElement : undefined}
                  data-index={item.index}
                >
                  <TicketCard
                    ticket={ticket}
                    ticketKey={keyFor(ticket)}
                    labels={labelsOf(snapshot, ticket.id)}
                    selected={ticket.id === selectedId}
                    variant="row"
                    onSelect={() => {
                      selectTicket(ticket.id);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<ArrowRight aria-hidden="true" />}
                    disabled={board === null}
                    className={styles['move']}
                    onClick={() => {
                      if (board) void ticketActions.update(ticket.id, { stateId: board });
                    }}
                  >
                    {t('tickets.moveToBoard')}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
