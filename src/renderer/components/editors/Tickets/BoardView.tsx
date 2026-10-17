import { useEffect, useState } from 'react';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { Plus } from 'lucide-react';
import { ticketKey } from '@shared/tickets';
import { useTranslation } from '@renderer/lib/i18n';
import { useCurrentProject } from '@renderer/lib/project';
import {
  matchesSearch,
  stateActions,
  ticketActions,
  ticketsInState,
  useTicketsSnapshot,
} from '@renderer/lib/tickets';
import { Button, ScrollArea } from '@renderer/ui';
import { PromptDialog } from '../../Shell/PromptDialog';
import { BoardColumn } from './BoardColumn';
import { asDropData, isTicketDrag, targetIndex } from './dnd';
import styles from './BoardView.module.scss';

export function BoardView({ search }: { search: string }) {
  const { t } = useTranslation('editors');
  const snapshot = useTicketsSnapshot();
  const project = useCurrentProject();
  const [adding, setAdding] = useState(false);
  const keyFor = (ticket: { number: number }) => ticketKey(project?.name ?? '', ticket.number);

  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) => isTicketDrag(source.data),
        onDrop: ({ source, location }) => {
          const target = location.current.dropTargets[0];
          if (!target || !isTicketDrag(source.data)) return;
          const drop = asDropData(target.data);
          if (!drop) return;
          const closest = extractClosestEdge(target.data);
          const edge = closest === 'top' || closest === 'bottom' ? closest : null;
          void ticketActions.moveTo(
            source.data.id,
            drop.stateId,
            targetIndex(snapshot, source.data, drop, edge),
          );
        },
      }),
    [snapshot],
  );

  return (
    <ScrollArea orientation="horizontal" className={styles['scroll']} viewportClassName={styles['viewport']}>
      <div className={styles['columns']}>
        {snapshot.states.map((state, index) => (
          <BoardColumn
            key={state.id}
            state={state}
            snapshot={snapshot}
            keyFor={keyFor}
            index={index}
            total={snapshot.states.length}
            tickets={ticketsInState(snapshot, state.id).filter((ticket) =>
              matchesSearch(ticket, keyFor(ticket), search),
            )}
          />
        ))}
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
