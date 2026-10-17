import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { MoreHorizontal } from 'lucide-react';
import type { Sprint, Ticket } from '@shared/tickets';
import { useFormat, useTranslation } from '@renderer/lib/i18n';
import { estimateOf, sprintActions } from '@renderer/lib/tickets';
import { Button, ConfirmDialog, DropdownMenu, IconButton, Tag, cx } from '@renderer/ui';
import { BacklogRow } from './BacklogRow';
import { QuickAdd } from './QuickAdd';
import { CompleteSprintDialog, SprintDialog } from './SprintDialogs';
import { columnId, columnKey, type ColumnDropData } from './dnd';
import styles from './SprintSection.module.scss';

export interface SprintSectionProps {
  sprint: Sprint | null;
  tickets: Ticket[];
  orderedIds: string[];
  keyFor: (ticket: Ticket) => string;
  canStart: boolean;
}

export function SprintSection({ sprint, tickets, orderedIds, keyFor, canStart }: SprintSectionProps) {
  const { t } = useTranslation('editors');
  const { t: tc } = useTranslation('common');
  const format = useFormat();
  const [dialog, setDialog] = useState<'edit' | 'complete' | 'delete' | null>(null);
  const id = sprint?.id ?? null;
  const dropData: ColumnDropData = { type: 'column', key: columnKey(id) };
  const { setNodeRef, isOver } = useDroppable({ id: columnId(id), data: dropData });
  const byId = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  const ordered = orderedIds.flatMap((ticketId) => {
    const ticket = byId.get(ticketId);
    return ticket ? [ticket] : [];
  });
  const name = sprint?.name ?? t('tickets.backlog');

  return (
    <section
      className={cx(styles['section'], sprint?.status === 'active' && styles['active'])}
      aria-label={name}
    >
      <header className={styles['header']}>
        <h3 className={styles['name']}>{name}</h3>
        {sprint ? <Tag size="sm">{t(`tickets.sprintStatus.${sprint.status}`)}</Tag> : null}
        {sprint?.goal ? <span className={styles['goal']}>{sprint.goal}</span> : null}
        <span className={styles['stats']}>
          {t('tickets.ticketsCount', { count: tickets.length })} ·{' '}
          {t('tickets.points', { count: estimateOf(tickets) })}
          {sprint?.startedAt ? ` · ${t('tickets.started', { when: format.relative(sprint.startedAt) })}` : ''}
        </span>
        {sprint?.status === 'planned' ? (
          <Button
            size="sm"
            variant="primary"
            disabled={!canStart}
            title={canStart ? undefined : t('tickets.anotherActive')}
            onClick={() => void sprintActions.start(sprint.id)}
          >
            {t('tickets.startSprint')}
          </Button>
        ) : null}
        {sprint?.status === 'active' ? (
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setDialog('complete');
            }}
          >
            {t('tickets.completeSprint')}
          </Button>
        ) : null}
        {sprint ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <IconButton label={`${sprint.name}: ${tc('actions.open')}`} size="sm" tooltip={false}>
                <MoreHorizontal aria-hidden="true" />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item
                onSelect={() => {
                  setDialog('edit');
                }}
              >
                {t('tickets.editSprint')}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => {
                  setDialog('delete');
                }}
              >
                {t('tickets.deleteSprint')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        ) : null}
      </header>
      <div ref={setNodeRef} className={cx(styles['body'], isOver && styles['over'])}>
        {ordered.length === 0 ? (
          <p className={styles['empty']}>{sprint ? t('tickets.emptySprint') : t('tickets.emptyBacklog')}</p>
        ) : null}
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          {ordered.map((ticket) => (
            <BacklogRow key={ticket.id} ticket={ticket} ticketKey={keyFor(ticket)} />
          ))}
        </SortableContext>
        <QuickAdd stateId={null} sprintId={id} className={styles['quickAdd']} />
      </div>
      {sprint && dialog === 'edit' ? (
        <SprintDialog
          sprint={sprint}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
        />
      ) : null}
      {sprint && dialog === 'complete' ? (
        <CompleteSprintDialog
          sprint={sprint}
          openCount={tickets.filter((ticket) => ticket.resolvedAt === null).length}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
        />
      ) : null}
      {sprint ? (
        <ConfirmDialog
          open={dialog === 'delete'}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          title={t('tickets.deleteSprint')}
          description={t('tickets.deleteSprintConfirm', { name: sprint.name })}
          confirmLabel={tc('actions.delete')}
          cancelLabel={tc('actions.cancel')}
          closeLabel={tc('actions.close')}
          destructive
          onConfirm={() => sprintActions.remove(sprint.id).then(() => undefined)}
        />
      ) : null}
    </section>
  );
}
