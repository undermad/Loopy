import { useEffect, useState } from 'react';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { Plus } from 'lucide-react';
import { ticketKey, type TicketsSnapshot } from '@shared/tickets';
import { useTranslation } from '@renderer/lib/i18n';
import { useCurrentProject } from '@renderer/lib/project';
import {
  matchesSearch,
  stateActions,
  ticketActions,
  ticketsInState,
  useTicketsSnapshot,
} from '@renderer/lib/tickets';
import { Button, ScrollArea, cx } from '@renderer/ui';
import { PromptDialog } from '../../Shell/PromptDialog';
import { BoardColumn } from './BoardColumn';
import {
  asDropData,
  columnTargetIndex,
  isStateDrag,
  isTicketDrag,
  targetIndex,
  type DragPreview,
  type Edge,
} from './dnd';
import styles from './BoardView.module.scss';

interface Location {
  current: { dropTargets: { data: Record<string | symbol, unknown> }[] };
}
interface Source {
  data: Record<string | symbol, unknown>;
}

function edgeOf(data: Record<string | symbol, unknown>): Edge | null {
  const closest = extractClosestEdge(data);
  return closest === 'top' || closest === 'bottom' || closest === 'left' || closest === 'right'
    ? closest
    : null;
}

export function previewFor(
  snapshot: TicketsSnapshot,
  source: Source,
  location: Location,
): DragPreview | null {
  const target = location.current.dropTargets[0];
  if (!target) return null;
  if (isTicketDrag(source.data)) {
    const drop = asDropData(target.data);
    if (!drop) return null;
    return {
      kind: 'ticket',
      stateId: drop.stateId,
      index: targetIndex(snapshot, source.data, drop, edgeOf(target.data)),
    };
  }
  if (
    isStateDrag(source.data) &&
    typeof target.data['stateId'] === 'string' &&
    target.data['type'] === 'column'
  ) {
    return {
      kind: 'state',
      index: columnTargetIndex(snapshot, source.data.id, target.data['stateId'], edgeOf(target.data)),
    };
  }
  return null;
}

export function BoardView({ search }: { search: string }) {
  const { t } = useTranslation('editors');
  const snapshot = useTicketsSnapshot();
  const project = useCurrentProject();
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const keyFor = (ticket: { number: number }) => ticketKey(project?.name ?? '', ticket.number);

  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) => isTicketDrag(source.data) || isStateDrag(source.data),
        onDrag: ({ source, location }) => {
          setPreview(previewFor(snapshot, source, location));
        },
        onDrop: ({ source, location }) => {
          setPreview(null);
          const next = previewFor(snapshot, source, location);
          if (!next) return;
          if (next.kind === 'ticket' && isTicketDrag(source.data)) {
            void ticketActions.moveTo(source.data.id, next.stateId, next.index);
          } else if (next.kind === 'state' && isStateDrag(source.data)) {
            void stateActions.reorder(source.data.id, next.index);
          }
        },
      }),
    [snapshot],
  );

  const columnIndicator = preview?.kind === 'state' ? preview.index : null;

  return (
    <ScrollArea orientation="horizontal" className={styles['scroll']} viewportClassName={styles['viewport']}>
      <div className={styles['columns']}>
        {snapshot.states.map((state, index) => (
          <div key={state.id} className={styles['slot']}>
            <span
              className={cx(styles['gap'], columnIndicator === index && styles['gapActive'])}
              aria-hidden="true"
            />
            <BoardColumn
              state={state}
              snapshot={snapshot}
              keyFor={keyFor}
              index={index}
              total={snapshot.states.length}
              placeholderIndex={
                preview?.kind === 'ticket' && preview.stateId === state.id ? preview.index : null
              }
              tickets={ticketsInState(snapshot, state.id).filter((ticket) =>
                matchesSearch(ticket, keyFor(ticket), search),
              )}
            />
          </div>
        ))}
        <span
          className={cx(styles['gap'], columnIndicator === snapshot.states.length && styles['gapActive'])}
          aria-hidden="true"
        />
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
    </ScrollArea>
  );
}
