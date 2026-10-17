import { useState } from 'react';
import { Ticket as TicketIcon, Trash2 } from 'lucide-react';
import { ticketKey, type TicketPriority, type TicketType } from '@shared/tickets';
import type { EditorProps } from '@renderer/lib/editors';
import { useFormat, useTranslation } from '@renderer/lib/i18n';
import { useCurrentProject } from '@renderer/lib/project';
import { labelsOf, ticketActions, useSelectedTicket, useTicketsSnapshot } from '@renderer/lib/tickets';
import { Button, ConfirmDialog, EmptyState, Field, Input, Select, TextArea } from '@renderer/ui';
import { LabelPicker } from './LabelPicker';
import styles from './TicketEditor.module.scss';

const TYPES: TicketType[] = ['task', 'spike', 'bug'];
const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

function DraftField({
  value,
  onCommit,
  multiline,
}: {
  value: string;
  onCommit: (next: string) => void;
  multiline?: boolean;
}) {
  const { t } = useTranslation('editors');
  const [draft, setDraft] = useState(value);
  const commit = () => {
    const trimmed = multiline ? draft : draft.trim();
    if (trimmed !== value && (multiline || trimmed.length > 0)) onCommit(trimmed);
  };
  if (multiline) {
    return (
      <TextArea
        rows={8}
        value={draft}
        placeholder={t('ticket.descriptionPlaceholder')}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
      />
    );
  }
  return (
    <Input
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

export function TicketEditor(_props: EditorProps) {
  const { t } = useTranslation('editors');
  const { t: tc } = useTranslation('common');
  const format = useFormat();
  const project = useCurrentProject();
  const snapshot = useTicketsSnapshot();
  const ticket = useSelectedTicket();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!ticket)
    return <EmptyState icon={<TicketIcon />} title={t('ticket.none')} description={t('ticket.noneHint')} />;

  const key = ticketKey(project?.name ?? '', ticket.number);
  const stateOptions = [
    { value: 'backlog', label: t('tickets.backlog') },
    ...snapshot.states.map((state) => ({ value: state.id, label: state.name })),
  ];

  return (
    <div className={styles['editor']} key={ticket.id}>
      <header className={styles['header']}>
        <span className={styles['key']}>{key}</span>
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 aria-hidden="true" />}
          onClick={() => {
            setConfirmDelete(true);
          }}
        >
          {t('ticket.delete')}
        </Button>
      </header>
      <Field label={t('ticket.title')}>
        <DraftField
          value={ticket.title}
          onCommit={(title) => void ticketActions.update(ticket.id, { title })}
        />
      </Field>
      <div className={styles['grid']}>
        <Field label={t('ticket.state')}>
          <Select
            options={stateOptions}
            value={ticket.stateId ?? 'backlog'}
            onValueChange={(value) =>
              void ticketActions.update(ticket.id, { stateId: value === 'backlog' ? null : value })
            }
          />
        </Field>
        <Field label={t('ticket.type')}>
          <Select
            options={TYPES.map((type) => ({ value: type, label: t(`tickets.types.${type}`) }))}
            value={ticket.type}
            onValueChange={(type) => void ticketActions.update(ticket.id, { type: type as TicketType })}
          />
        </Field>
        <Field label={t('ticket.priority')}>
          <Select
            options={PRIORITIES.map((priority) => ({
              value: priority,
              label: t(`tickets.priorities.${priority}`),
            }))}
            value={ticket.priority}
            onValueChange={(priority) =>
              void ticketActions.update(ticket.id, { priority: priority as TicketPriority })
            }
          />
        </Field>
      </div>
      <Field label={t('ticket.labels')}>
        <LabelPicker ticketId={ticket.id} selected={labelsOf(snapshot, ticket.id)} />
      </Field>
      <Field label={t('ticket.description')}>
        <DraftField
          multiline
          value={ticket.description}
          onCommit={(description) => void ticketActions.update(ticket.id, { description })}
        />
      </Field>
      <footer className={styles['meta']}>
        <span>{t('ticket.created', { when: format.dateTime(ticket.createdAt) })}</span>
        <span>{t('ticket.updated', { when: format.relative(ticket.updatedAt) })}</span>
        {ticket.resolvedAt ? (
          <span>{t('ticket.resolved', { when: format.dateTime(ticket.resolvedAt) })}</span>
        ) : null}
      </footer>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('ticket.delete')}
        description={t('ticket.deleteConfirm', { key, title: ticket.title })}
        confirmLabel={tc('actions.delete')}
        cancelLabel={tc('actions.cancel')}
        closeLabel={tc('actions.close')}
        destructive
        onConfirm={() => ticketActions.remove(ticket.id).then(() => undefined)}
      />
    </div>
  );
}
