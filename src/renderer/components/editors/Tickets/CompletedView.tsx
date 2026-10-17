import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { ticketKey, type Sprint, type Ticket } from '@shared/tickets';
import { useFormat, useTranslation } from '@renderer/lib/i18n';
import { useCurrentProject } from '@renderer/lib/project';
import {
  completedSprints,
  completedTickets,
  estimateOf,
  matchesSearch,
  ticketsInSprint,
  useTicketsSnapshot,
} from '@renderer/lib/tickets';
import { EmptyState, ScrollArea, cx } from '@renderer/ui';
import { BacklogRow } from './BacklogRow';
import styles from './CompletedView.module.scss';

function Group({
  id,
  title,
  meta,
  tickets,
  keyFor,
  open,
  onToggle,
}: {
  id: string;
  title: string;
  meta: string;
  tickets: Ticket[];
  keyFor: (ticket: Ticket) => string;
  open: boolean;
  onToggle: () => void;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <section className={styles['group']} aria-label={title}>
      <button
        type="button"
        className={styles['header']}
        aria-expanded={open}
        aria-controls={`completed-${id}`}
        onClick={onToggle}
      >
        <Chevron aria-hidden="true" />
        <span className={styles['name']}>{title}</span>
        <span className={styles['meta']}>{meta}</span>
      </button>
      {open ? (
        <div id={`completed-${id}`} className={styles['body']}>
          {tickets.map((ticket) => (
            <BacklogRow key={ticket.id} ticket={ticket} ticketKey={keyFor(ticket)} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function CompletedView({ search }: { search: string }) {
  const { t } = useTranslation('editors');
  const format = useFormat();
  const snapshot = useTicketsSnapshot();
  const project = useCurrentProject();
  const keyFor = (ticket: { number: number }) => ticketKey(project?.name ?? '', ticket.number);
  const visible = (ticket: Ticket) => matchesSearch(ticket, keyFor(ticket), search);
  const sprints = completedSprints(snapshot);
  const loose = completedTickets(snapshot).filter(visible);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const sprintMeta = (sprint: Sprint, tickets: Ticket[]) =>
    [
      t('tickets.ticketsCount', { count: tickets.length }),
      t('tickets.points', { count: estimateOf(tickets) }),
      sprint.completedAt ? t('tickets.completedOn', { when: format.dateTime(sprint.completedAt) }) : null,
    ]
      .filter(Boolean)
      .join(' · ');

  if (sprints.length === 0 && loose.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 />}
        title={t('tickets.completedEmpty')}
        description={t('tickets.completedEmptyHint')}
      />
    );
  }

  return (
    <ScrollArea className={styles['scroll']}>
      <div className={cx(styles['list'])}>
        {sprints.map((sprint, index) => {
          const tickets = ticketsInSprint(snapshot, sprint.id).filter(visible);
          return (
            <Group
              key={sprint.id}
              id={sprint.id}
              title={sprint.name}
              meta={sprintMeta(sprint, tickets)}
              tickets={tickets}
              keyFor={keyFor}
              open={index === 0 ? !collapsed.has(sprint.id) : collapsed.has(sprint.id)}
              onToggle={() => {
                toggle(sprint.id);
              }}
            />
          );
        })}
        {loose.length > 0 ? (
          <Group
            id="loose"
            title={t('tickets.completedWithoutSprint')}
            meta={t('tickets.ticketsCount', { count: loose.length })}
            tickets={loose}
            keyFor={keyFor}
            open={!collapsed.has('loose')}
            onToggle={() => {
              toggle('loose');
            }}
          />
        ) : null}
      </div>
    </ScrollArea>
  );
}
