import { useEffect, useRef, useState } from 'react';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { MoreHorizontal } from 'lucide-react';
import type { StateCategory, Ticket, TicketState, TicketsSnapshot } from '@shared/tickets';
import { useTranslation } from '@renderer/lib/i18n';
import { labelsOf, selectTicket, stateActions, useSelectedTicketId } from '@renderer/lib/tickets';
import { ColorPicker, ConfirmDialog, DropdownMenu, IconButton, ScrollArea, cx } from '@renderer/ui';
import { PromptDialog } from '../../Shell/PromptDialog';
import type { ColumnDropData } from './dnd';
import { QuickAdd } from './QuickAdd';
import { TicketCard } from './TicketCard';
import styles from './BoardColumn.module.scss';

export interface BoardColumnProps {
  state: TicketState;
  tickets: Ticket[];
  snapshot: TicketsSnapshot;
  keyFor: (ticket: Ticket) => string;
  index: number;
  total: number;
}

const CATEGORIES: StateCategory[] = ['todo', 'doing', 'done'];

export function BoardColumn({ state, tickets, snapshot, keyFor, index, total }: BoardColumnProps) {
  const { t } = useTranslation('editors');
  const { t: tc } = useTranslation('common');
  const selectedId = useSelectedTicketId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);

  useEffect(() => {
    const element = bodyRef.current;
    if (!element) return;
    const data: ColumnDropData = { type: 'column', stateId: state.id };
    return dropTargetForElements({
      element,
      canDrop: ({ source }) => source.data['type'] === 'ticket',
      getData: () => ({ ...data }),
      onDragEnter: () => {
        setOver(true);
      },
      onDragLeave: () => {
        setOver(false);
      },
      onDrop: () => {
        setOver(false);
      },
    });
  }, [state.id]);

  return (
    <section className={cx(styles['column'], over && styles['over'])} aria-label={state.name}>
      <header className={styles['header']}>
        <ColorPicker
          size="sm"
          value={state.color}
          label={t('tickets.stateColor')}
          onChange={(color) => void stateActions.update(state.id, { color })}
        />
        <h3 className={styles['name']}>{state.name}</h3>
        <span className={styles['count']}>{tickets.length}</span>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <IconButton label={`${state.name}: ${tc('actions.open')}`} size="sm" tooltip={false}>
              <MoreHorizontal aria-hidden="true" />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item
              onSelect={() => {
                setDialog('rename');
              }}
            >
              {t('tickets.renameState')}
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Label>{t('tickets.category')}</DropdownMenu.Label>
            <DropdownMenu.RadioGroup
              value={state.category}
              onValueChange={(category) =>
                void stateActions.update(state.id, { category: category as StateCategory })
              }
            >
              {CATEGORIES.map((category) => (
                <DropdownMenu.RadioItem key={category} value={category}>
                  {t(`tickets.categories.${category}`)}
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
            <DropdownMenu.Separator />
            <DropdownMenu.Item disabled={index === 0} onSelect={() => void stateActions.move(state.id, -1)}>
              {t('tickets.moveLeft')}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              disabled={index === total - 1}
              onSelect={() => void stateActions.move(state.id, 1)}
            >
              {t('tickets.moveRight')}
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              onSelect={() => {
                setDialog('delete');
              }}
            >
              {t('tickets.deleteState')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </header>
      <ScrollArea className={styles['scroll']} viewportClassName={styles['viewport']}>
        <div ref={bodyRef} className={styles['body']}>
          {tickets.length === 0 ? <p className={styles['empty']}>{t('tickets.emptyColumn')}</p> : null}
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              ticketKey={keyFor(ticket)}
              labels={labelsOf(snapshot, ticket.id)}
              selected={ticket.id === selectedId}
              onSelect={() => {
                selectTicket(ticket.id);
              }}
            />
          ))}
        </div>
      </ScrollArea>
      <footer className={styles['footer']}>
        <QuickAdd stateId={state.id} />
      </footer>
      {dialog === 'rename' ? (
        <PromptDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          title={t('tickets.renameState')}
          label={t('tickets.stateName')}
          initialValue={state.name}
          submitLabel={tc('actions.rename')}
          onSubmit={(name) => stateActions.update(state.id, { name }).then(() => undefined)}
        />
      ) : null}
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={t('tickets.deleteState')}
        description={t('tickets.deleteStateConfirm', { name: state.name, count: tickets.length })}
        confirmLabel={tc('actions.delete')}
        cancelLabel={tc('actions.cancel')}
        closeLabel={tc('actions.close')}
        destructive
        onConfirm={() => stateActions.remove(state.id, null).then(() => undefined)}
      />
    </section>
  );
}
