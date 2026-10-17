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
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { ticketKey, type Ticket } from '@shared/tickets';
import { useTranslation } from '@renderer/lib/i18n';
import { useCurrentProject } from '@renderer/lib/project';
import {
  labelsOf,
  matchesSearch,
  openSprints,
  sprintActions,
  ticketActions,
  ticketsInSprint,
  useTicketsSnapshot,
} from '@renderer/lib/tickets';
import { Button, ScrollArea } from '@renderer/ui';
import { PromptDialog } from '../../Shell/PromptDialog';
import {
  BACKLOG_KEY,
  dataOf,
  dropTicket,
  findColumn,
  ordersFromLists,
  overTicket,
  stateIdOf,
  type ColumnKey,
  type Orders,
} from './dnd';
import { SprintSection } from './SprintSection';
import { TicketCard } from './TicketCard';
import styles from './BacklogView.module.scss';

export function BacklogView({ search }: { search: string }) {
  const { t } = useTranslation('editors');
  const snapshot = useTicketsSnapshot();
  const project = useCurrentProject();
  const projectName = project?.name ?? '';
  const keyFor = (ticket: { number: number }) => ticketKey(projectName, ticket.number);
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState<{ id: string; fromKey: ColumnKey } | null>(null);
  const [orders, setOrders] = useState<Orders | null>(null);
  const settling = useRef(0);
  const sprints = openSprints(snapshot);
  const lists = useMemo(() => {
    const visible = (ticket: Ticket) => matchesSearch(ticket, ticketKey(projectName, ticket.number), search);
    const result: Record<ColumnKey, Ticket[]> = {};
    for (const sprint of openSprints(snapshot)) {
      result[sprint.id] = ticketsInSprint(snapshot, sprint.id).filter(visible);
    }
    result[BACKLOG_KEY] = ticketsInSprint(snapshot, null).filter(visible);
    return result;
  }, [snapshot, search, projectName]);
  const liveOrders = orders ?? ordersFromLists(lists);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragStart({ active: item }: DragStartEvent) {
    const data = dataOf(item);
    if (data?.type !== 'ticket') return;
    const base = ordersFromLists(lists);
    setOrders(base);
    setActive({ id: data.id, fromKey: findColumn(base, data.id) ?? BACKLOG_KEY });
  }

  function onDragOver({ active: item, over }: DragOverEvent) {
    const data = dataOf(item);
    if (data?.type === 'ticket' && orders) setOrders(overTicket(orders, data.id, dataOf(over)));
  }

  function onDragEnd({ over }: DragEndEvent) {
    const target = dataOf(over);
    const current = active;
    setActive(null);
    const drop = current && orders ? dropTicket(orders, current.id, target, current.fromKey) : null;
    if (!current || !drop) {
      setOrders(null);
      return;
    }
    setOrders(drop.orders);
    const key = findColumn(drop.orders, current.id) ?? BACKLOG_KEY;
    const token = (settling.current += 1);
    void ticketActions.place(current.id, stateIdOf(key), drop.index, lists[key] ?? []).finally(() => {
      if (token === settling.current) setOrders(null);
    });
  }

  const activeTicket = active ? snapshot.tickets.find((ticket) => ticket.id === active.id) : undefined;
  const anyActive = sprints.some((sprint) => sprint.status === 'active');

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActive(null);
        setOrders(null);
      }}
    >
      <ScrollArea className={styles['scroll']}>
        <div className={styles['backlog']}>
          <div className={styles['toolbar']}>
            {sprints.length === 0 ? <p className={styles['hint']}>{t('tickets.noSprintsHint')}</p> : null}
            <Button
              size="sm"
              icon={<Plus aria-hidden="true" />}
              className={styles['create']}
              onClick={() => {
                setCreating(true);
              }}
            >
              {t('tickets.createSprint')}
            </Button>
          </div>
          {sprints.map((sprint) => (
            <SprintSection
              key={sprint.id}
              sprint={sprint}
              tickets={lists[sprint.id] ?? []}
              orderedIds={liveOrders[sprint.id] ?? []}
              keyFor={keyFor}
              canStart={!anyActive}
            />
          ))}
          <SprintSection
            sprint={null}
            tickets={lists[BACKLOG_KEY] ?? []}
            orderedIds={liveOrders[BACKLOG_KEY] ?? []}
            keyFor={keyFor}
            canStart={false}
          />
        </div>
      </ScrollArea>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeTicket ? (
          <TicketCard
            ticket={activeTicket}
            ticketKey={keyFor(activeTicket)}
            labels={labelsOf(snapshot, activeTicket.id)}
            selected={false}
            variant="row"
            onSelect={() => undefined}
            overlay
          />
        ) : null}
      </DragOverlay>
      {creating ? (
        <PromptDialog
          open
          onOpenChange={(open) => {
            if (!open) setCreating(false);
          }}
          title={t('tickets.createSprint')}
          label={t('tickets.sprintName')}
          initialValue={t('tickets.defaultSprintName', { number: snapshot.sprints.length + 1 })}
          submitLabel={t('tickets.createSprint')}
          onSubmit={(name) => sprintActions.create({ name }).then(() => undefined)}
        />
      ) : null}
    </DndContext>
  );
}
