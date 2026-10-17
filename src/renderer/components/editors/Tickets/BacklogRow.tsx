import { MoreHorizontal } from 'lucide-react';
import type { Ticket } from '@shared/tickets';
import { useFormat, useTranslation } from '@renderer/lib/i18n';
import {
  labelsOf,
  openSprints,
  selectTicket,
  ticketActions,
  useSelectedTicketId,
  useTicketsSnapshot,
} from '@renderer/lib/tickets';
import { DropdownMenu, IconButton, Tag, cx } from '@renderer/ui';
import { TicketCard } from './TicketCard';
import styles from './BacklogRow.module.scss';

export function BacklogRow({ ticket, ticketKey }: { ticket: Ticket; ticketKey: string }) {
  const { t } = useTranslation('editors');
  const { t: tc } = useTranslation('common');
  const format = useFormat();
  const snapshot = useTicketsSnapshot();
  const selectedId = useSelectedTicketId();
  const state = snapshot.states.find((candidate) => candidate.id === ticket.stateId);
  const sprints = openSprints(snapshot).filter((sprint) => sprint.id !== ticket.sprintId);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = ticket.dueAt !== null && ticket.resolvedAt === null && ticket.dueAt < today;

  return (
    <div className={styles['row']}>
      <TicketCard
        ticket={ticket}
        ticketKey={ticketKey}
        labels={labelsOf(snapshot, ticket.id)}
        selected={ticket.id === selectedId}
        variant="row"
        onSelect={() => {
          selectTicket(ticket.id);
        }}
      />
      {state ? (
        <Tag size="sm" color={state.color}>
          {state.name}
        </Tag>
      ) : null}
      {ticket.estimate !== null ? (
        <span className={styles['points']}>{t('tickets.points', { count: ticket.estimate })}</span>
      ) : null}
      {ticket.dueAt ? (
        <span className={cx(styles['due'], overdue && styles['overdue'])}>
          {t('ticket.due', { when: format.date(ticket.dueAt) })}
        </span>
      ) : null}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <IconButton label={`${ticketKey}: ${tc('actions.open')}`} size="sm" tooltip={false}>
            <MoreHorizontal aria-hidden="true" />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          {sprints.map((sprint) => (
            <DropdownMenu.Item
              key={sprint.id}
              onSelect={() => void ticketActions.update(ticket.id, { sprintId: sprint.id })}
            >
              {t('tickets.addToSprintNamed', { name: sprint.name })}
            </DropdownMenu.Item>
          ))}
          {ticket.sprintId ? (
            <DropdownMenu.Item onSelect={() => void ticketActions.update(ticket.id, { sprintId: null })}>
              {t('tickets.removeFromSprint')}
            </DropdownMenu.Item>
          ) : null}
          {sprints.length === 0 && !ticket.sprintId ? (
            <DropdownMenu.Item disabled>{t('tickets.noSprintsHint')}</DropdownMenu.Item>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
}
