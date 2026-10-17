import { useRef } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
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

  const board = firstTodoState(snapshot);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const ids = tickets.map((ticket) => ticket.id);

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const to = ids.indexOf(String(over.id));
    if (to >= 0) void ticketActions.moveTo(String(active.id), null, to);
  }
  const virtual = tickets.length > VIRTUAL_THRESHOLD;
  const rows = virtual
    ? virtualizer.getVirtualItems().map((item) => ({ index: item.index, start: item.start }))
    : tickets.map((_, index) => ({ index, start: null }));

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
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
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
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
            </SortableContext>
          </div>
        )}
      </div>
    </DndContext>
  );
}
