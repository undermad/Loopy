import { useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { ticketKey } from '@shared/tickets';
import { useTranslation } from '@renderer/lib/i18n';
import { useCurrentProject } from '@renderer/lib/project';
import {
  labelsOf,
  matchesSearch,
  stateActions,
  ticketActions,
  ticketsInState,
  useTicketsSnapshot,
} from '@renderer/lib/tickets';
import { Button, ScrollArea } from '@renderer/ui';
import { PromptDialog } from '../../Shell/PromptDialog';
import { BoardColumn } from './BoardColumn';
import {
  arrayMove,
  dropTicket,
  findColumn,
  ordersFrom,
  overTicket,
  type ColumnKey,
  type DragData,
  type Orders,
} from './dnd';
import { TicketCard } from './TicketCard';
import styles from './BoardView.module.scss';

type Active = { kind: 'ticket'; id: string; fromKey: ColumnKey } | { kind: 'state'; id: string };

export function dataOf(item: { data: { current?: unknown } } | null | undefined): DragData | null {
  const current = item?.data.current;
  return typeof current === 'object' && current !== null && 'type' in current ? (current as DragData) : null;
}

export function BoardView({ search }: { search: string }) {
  const { t } = useTranslation('editors');
  const snapshot = useTicketsSnapshot();
  const project = useCurrentProject();
  const [adding, setAdding] = useState(false);
  const [active, setActive] = useState<Active | null>(null);
  const [orders, setOrders] = useState<Orders | null>(null);
  const [stateOrder, setStateOrder] = useState<string[] | null>(null);
  const settling = useRef(0);
  const projectName = project?.name ?? '';
  const keyFor = (ticket: { number: number }) => ticketKey(projectName, ticket.number);
  const baseOrders = useMemo(
    () =>
      ordersFrom(snapshot, (id) => {
        const ticket = snapshot.tickets.find((candidate) => candidate.id === id);
        return ticket ? matchesSearch(ticket, ticketKey(projectName, ticket.number), search) : false;
      }),
    [snapshot, search, projectName],
  );
  const liveOrders = orders ?? baseOrders;
  const states = stateOrder
    ? stateOrder.flatMap((id) => snapshot.states.filter((state) => state.id === id))
    : snapshot.states;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function reset() {
    setActive(null);
    setOrders(null);
    setStateOrder(null);
  }

  function onDragStart({ active: item }: DragStartEvent) {
    const data = dataOf(item);
    if (data?.type === 'ticket') {
      setActive({ kind: 'ticket', id: data.id, fromKey: findColumn(baseOrders, data.id) ?? 'backlog' });
      setOrders(baseOrders);
    } else if (data?.type === 'state') {
      setActive({ kind: 'state', id: data.id });
      setStateOrder(snapshot.states.map((state) => state.id));
    }
  }

  function onDragOver({ active: item, over }: DragOverEvent) {
    const data = dataOf(item);
    if (data?.type === 'ticket' && orders) setOrders(overTicket(orders, data.id, dataOf(over)));
  }

  function settle(work: Promise<unknown>, clear: () => void) {
    const token = (settling.current += 1);
    void work.finally(() => {
      if (token === settling.current) clear();
    });
  }

  function onDragEnd({ over }: DragEndEvent) {
    const target = dataOf(over);
    setActive(null);
    if (active?.kind === 'ticket' && orders) {
      const drop = dropTicket(orders, active.id, target, active.fromKey);
      if (!drop) {
        setOrders(null);
        return;
      }
      setOrders(drop.orders);
      settle(ticketActions.moveTo(active.id, drop.stateId, drop.index), () => {
        setOrders(null);
      });
    } else if (
      active?.kind === 'state' &&
      stateOrder &&
      target?.type === 'state' &&
      target.id !== active.id
    ) {
      const next = arrayMove(stateOrder, stateOrder.indexOf(active.id), stateOrder.indexOf(target.id));
      setStateOrder(next);
      settle(stateActions.reorder(active.id, next.indexOf(active.id)), () => {
        setStateOrder(null);
      });
    } else {
      setOrders(null);
      setStateOrder(null);
    }
  }

  const activeTicket =
    active?.kind === 'ticket' ? snapshot.tickets.find((ticket) => ticket.id === active.id) : undefined;
  const activeState =
    active?.kind === 'state' ? snapshot.states.find((state) => state.id === active.id) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
    >
      <ScrollArea
        orientation="horizontal"
        className={styles['scroll']}
        viewportClassName={styles['viewport']}
      >
        <div className={styles['columns']}>
          <SortableContext items={states.map((state) => state.id)} strategy={horizontalListSortingStrategy}>
            {states.map((state, index) => (
              <BoardColumn
                key={state.id}
                state={state}
                snapshot={snapshot}
                keyFor={keyFor}
                index={index}
                total={states.length}
                dragKind={active?.kind ?? null}
                orderedIds={liveOrders[state.id] ?? []}
                tickets={ticketsInState(snapshot, state.id)}
              />
            ))}
          </SortableContext>
          <div className={styles['add']}>
            <Button
              icon={<Plus aria-hidden="true" />}
              onClick={() => {
                setAdding(true);
              }}
            >
              {t('tickets.addState')}
            </Button>
          </div>
        </div>
      </ScrollArea>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeTicket ? (
          <TicketCard
            ticket={activeTicket}
            ticketKey={keyFor(activeTicket)}
            labels={labelsOf(snapshot, activeTicket.id)}
            selected={false}
            onSelect={() => undefined}
            overlay
          />
        ) : null}
        {activeState ? <div className={styles['stateGhost']}>{activeState.name}</div> : null}
      </DragOverlay>
      {adding ? (
        <PromptDialog
          open
          onOpenChange={(open) => {
            if (!open) setAdding(false);
          }}
          title={t('tickets.newState')}
          label={t('tickets.stateName')}
          submitLabel={t('tickets.addState')}
          onSubmit={(name) => stateActions.create({ name }).then(() => undefined)}
        />
      ) : null}
    </DndContext>
  );
}
