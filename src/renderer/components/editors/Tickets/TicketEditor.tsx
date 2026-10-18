import { useRef, useState } from 'react';
import { BookmarkPlus, Ticket as TicketIcon, Trash2 } from 'lucide-react';
import { ticketKey, type TicketLink, type TicketPriority, type TicketType } from '@shared/tickets';
import { assetDropZoneProps, useAssetDropZone } from '@renderer/lib/assets';
import type { EditorProps } from '@renderer/lib/editors';
import { useFormat, useTranslation } from '@renderer/lib/i18n';
import { useCurrentProject } from '@renderer/lib/project';
import {
  commentsOf,
  labelsOf,
  openSprints,
  templateActions,
  ticketActions,
  useSelectedTicket,
  useTicketsSnapshot,
} from '@renderer/lib/tickets';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  NumberInput,
  RichText,
  ScrollArea,
  Select,
  toRichText,
  cx,
} from '@renderer/ui';
import { PromptDialog } from '../../Shell/PromptDialog';
import { Comments } from './Comments';
import { LabelPicker } from './LabelPicker';
import { LinkedAssets } from './LinkedAssets';
import { PRIORITY_ICONS, TYPE_ICONS } from './TicketCard';
import { useRichTextLabels } from './useRichTextLabels';
import styles from './TicketEditor.module.scss';

const TYPES: TicketType[] = ['task', 'spike', 'bug'];
const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

function TitleField({ value, onCommit }: { value: string; onCommit: (next: string) => void }) {
  const { t } = useTranslation('editors');
  const [draft, setDraft] = useState(value);
  return (
    <Input
      className={styles['title']}
      aria-label={t('ticket.title')}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={() => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== value) onCommit(trimmed);
        else setDraft(value);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

function EstimateField({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (next: number | null) => void;
}) {
  return <NumberInput value={value} min={0} step={0.5} digits={2} nullable onValueChange={onCommit} />;
}

export function TicketEditor(_props: EditorProps) {
  const { t } = useTranslation('editors');
  const { t: tc } = useTranslation('common');
  const format = useFormat();
  const labels = useRichTextLabels();
  const project = useCurrentProject();
  const snapshot = useTicketsSnapshot();
  const ticket = useSelectedTicket();
  const [dialog, setDialog] = useState<'delete' | 'template' | null>(null);
  const [linking, setLinking] = useState(false);
  const zone = useRef<HTMLDivElement>(null);

  useAssetDropZone(zone, (detail) => {
    setLinking(detail.phase === 'move');
    if (detail.phase !== 'drop' || !ticket) return;
    const added: TicketLink[] = [
      ...detail.ids.map((id) => ({ kind: 'asset' as const, id })),
      ...detail.links,
    ];
    if (added.length > 0) void ticketActions.update(ticket.id, { links: [...ticket.links, ...added] });
  });

  if (!ticket)
    return (
      <div ref={zone} className={styles['zone']}>
        <EmptyState icon={<TicketIcon />} title={t('ticket.none')} description={t('ticket.noneHint')} />
      </div>
    );

  const key = ticketKey(project?.name ?? '', ticket.number);
  const TypeIcon = TYPE_ICONS[ticket.type];
  const PriorityIcon = PRIORITY_ICONS[ticket.priority];
  const ticketLabels = labelsOf(snapshot, ticket.id);
  const sprints = openSprints(snapshot);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = ticket.dueAt !== null && ticket.resolvedAt === null && ticket.dueAt < today;
  const update = (patch: Parameters<typeof ticketActions.update>[1]) =>
    void ticketActions.update(ticket.id, patch);

  return (
    <div ref={zone} {...assetDropZoneProps} className={cx(styles['zone'], linking && styles['linking'])}>
      <ScrollArea className={styles['scroll']}>
        <div className={styles['editor']} key={ticket.id}>
          <header className={styles['header']}>
            <TypeIcon aria-label={t(`tickets.types.${ticket.type}`)} className={styles['typeIcon']} />
            <span className={styles['key']}>{key}</span>
            <span className={styles['spacer']} />
            <Button
              variant="ghost"
              size="sm"
              icon={<BookmarkPlus aria-hidden="true" />}
              onClick={() => {
                setDialog('template');
              }}
            >
              {t('ticket.saveTemplate')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 aria-hidden="true" />}
              onClick={() => {
                setDialog('delete');
              }}
            >
              {t('ticket.delete')}
            </Button>
          </header>
          <TitleField
            value={ticket.title}
            onCommit={(title) => {
              update({ title });
            }}
          />
          <section className={styles['block']} aria-label={t('ticket.description')}>
            <h3 className={styles['blockTitle']}>{t('ticket.description')}</h3>
            <RichText
              value={toRichText(ticket.description)}
              labels={labels}
              placeholder={t('ticket.descriptionPlaceholder')}
              onBlur={(html) => {
                if (html !== toRichText(ticket.description)) update({ description: html });
              }}
            />
          </section>
          <section className={styles['details']} aria-label={t('ticket.details')}>
            <Field label={t('ticket.state')}>
              <Select
                size="sm"
                options={[
                  { value: 'backlog', label: t('tickets.backlog') },
                  ...snapshot.states.map((state) => ({ value: state.id, label: state.name })),
                ]}
                value={ticket.stateId ?? 'backlog'}
                onValueChange={(value) => {
                  update({ stateId: value === 'backlog' ? null : value });
                }}
              />
            </Field>
            <Field label={t('ticket.sprint')}>
              <Select
                size="sm"
                options={[
                  { value: 'none', label: t('ticket.noSprint') },
                  ...sprints.map((sprint) => ({ value: sprint.id, label: sprint.name })),
                ]}
                value={ticket.sprintId ?? 'none'}
                onValueChange={(value) => {
                  update({ sprintId: value === 'none' ? null : value });
                }}
              />
            </Field>
            <Field label={t('ticket.type')}>
              <Select
                size="sm"
                options={TYPES.map((type) => ({ value: type, label: t(`tickets.types.${type}`) }))}
                value={ticket.type}
                onValueChange={(type) => {
                  update({ type: type as TicketType });
                }}
              />
            </Field>
            <Field label={t('ticket.priority')}>
              <Select
                size="sm"
                options={PRIORITIES.map((priority) => ({
                  value: priority,
                  label: t(`tickets.priorities.${priority}`),
                }))}
                value={ticket.priority}
                onValueChange={(priority) => {
                  update({ priority: priority as TicketPriority });
                }}
              />
            </Field>
            <Field label={t('ticket.estimate')}>
              <EstimateField
                value={ticket.estimate}
                onCommit={(estimate) => {
                  update({ estimate });
                }}
              />
            </Field>
            <Field label={t('ticket.dueDate')} hint={overdue ? t('ticket.overdue') : undefined}>
              <Input
                type="date"
                value={ticket.dueAt ?? ''}
                onChange={(event) => {
                  update({ dueAt: event.target.value || null });
                }}
              />
            </Field>
          </section>
          <Field label={t('ticket.labels')}>
            <LabelPicker ticketId={ticket.id} selected={ticketLabels} />
          </Field>
          <section
            className={cx(styles['block'], linking && styles['linkTarget'])}
            aria-label={t('ticket.links.title')}
          >
            <h3 className={styles['blockTitle']}>{t('ticket.links.title')}</h3>
            <LinkedAssets ticketId={ticket.id} links={ticket.links} />
          </section>
          <Comments ticketId={ticket.id} comments={commentsOf(snapshot, ticket.id)} />
          <footer className={styles['meta']}>
            <span>
              <PriorityIcon aria-hidden="true" /> {t(`tickets.priorities.${ticket.priority}`)}
            </span>
            <span>{t('ticket.created', { when: format.dateTime(ticket.createdAt) })}</span>
            <span>{t('ticket.updated', { when: format.relative(ticket.updatedAt) })}</span>
            {ticket.resolvedAt ? (
              <span>{t('ticket.resolved', { when: format.dateTime(ticket.resolvedAt) })}</span>
            ) : null}
          </footer>
          <ConfirmDialog
            open={dialog === 'delete'}
            onOpenChange={(open) => {
              if (!open) setDialog(null);
            }}
            title={t('ticket.delete')}
            description={t('ticket.deleteConfirm', { key, title: ticket.title })}
            confirmLabel={tc('actions.delete')}
            cancelLabel={tc('actions.cancel')}
            closeLabel={tc('actions.close')}
            destructive
            onConfirm={() => ticketActions.remove(ticket.id).then(() => undefined)}
          />
          {dialog === 'template' ? (
            <PromptDialog
              open
              onOpenChange={(open) => {
                if (!open) setDialog(null);
              }}
              title={t('ticket.saveTemplate')}
              label={t('ticket.templateName')}
              initialValue={ticket.title}
              submitLabel={tc('actions.save')}
              onSubmit={(name) =>
                templateActions
                  .create({
                    name,
                    title: ticket.title,
                    description: ticket.description,
                    type: ticket.type,
                    priority: ticket.priority,
                    estimate: ticket.estimate,
                    labelIds: ticketLabels.map((label) => label.id),
                  })
                  .then(() => undefined)
              }
            />
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
