import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Columns3, ListTodo, PanelRight, Plus } from 'lucide-react';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import {
  activeSprint,
  selectTicket,
  ticketActions,
  useSelectedTicketId,
  useTicketsLoaded,
  useTicketsSnapshot,
} from '@renderer/lib/tickets';
import { panelActions, usePanelOpen } from '@renderer/lib/workspaces';
import { Button, DropdownMenu, IconButton, Input, Spinner, Tag, ToggleGroup } from '@renderer/ui';
import { AreaHeaderContent } from '../../Shell/AreaHeaderContent';
import { PromptDialog } from '../../Shell/PromptDialog';
import { BacklogView } from './BacklogView';
import { BoardView } from './BoardView';
import { CompletedView } from './CompletedView';
import { TemplatesDialog } from './TemplatesDialog';
import styles from './TicketsEditor.module.scss';

export const TICKET_PANEL_WIDTH = 420;

type Mode = 'board' | 'backlog' | 'completed';

function newest(tickets: { id: string; number: number }[]): string | null {
  return (
    tickets.reduce<{ id: string; number: number } | null>(
      (latest, ticket) => (latest === null || ticket.number > latest.number ? ticket : latest),
      null,
    )?.id ?? null
  );
}

export function TicketsEditor({ areaId, state, setState }: EditorProps) {
  const { t } = useTranslation('editors');
  const loaded = useTicketsLoaded();
  const snapshot = useTicketsSnapshot();
  const selectedId = useSelectedTicketId();
  const panelOpen = usePanelOpen('ticket');
  const editorRef = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<'new' | 'templates' | null>(null);
  const mode: Mode = state['mode'] === 'backlog' || state['mode'] === 'completed' ? state['mode'] : 'board';
  const search = typeof state['search'] === 'string' ? state['search'] : '';
  const sprint = activeSprint(snapshot);
  const width = () => editorRef.current?.getBoundingClientRect().width ?? 0;

  useEffect(() => {
    if (selectedId && !panelOpen) panelActions.open(areaId, 'ticket', width(), TICKET_PANEL_WIDTH);
  }, [selectedId, panelOpen, areaId]);

  return (
    <div ref={editorRef} className={styles['editor']}>
      <AreaHeaderContent>
        <ToggleGroup
          size="sm"
          aria-label={t('tickets.mode')}
          value={mode}
          onValueChange={(next) => {
            setState({ mode: next });
          }}
          items={[
            { value: 'board', label: t('tickets.modes.board'), icon: <Columns3 aria-hidden="true" /> },
            { value: 'backlog', label: t('tickets.modes.backlog'), icon: <ListTodo aria-hidden="true" /> },
            {
              value: 'completed',
              label: t('tickets.modes.completed'),
              icon: <CheckCircle2 aria-hidden="true" />,
            },
          ]}
        />
        <Input
          size="sm"
          type="search"
          value={search}
          aria-label={t('tickets.search')}
          placeholder={t('tickets.search')}
          className={styles['search']}
          onChange={(event) => {
            setState({ search: event.target.value });
          }}
        />
        {mode === 'board' && sprint ? (
          <Tag size="sm" className={styles['sprintTag']}>
            {`${t('tickets.activeSprint')}: ${sprint.name}`}
          </Tag>
        ) : null}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button size="sm" variant="primary" icon={<Plus aria-hidden="true" />}>
              {t('tickets.newTicket')}
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item
              onSelect={() => {
                setDialog('new');
              }}
            >
              {t('tickets.blankTicket')}
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Label>{t('tickets.fromTemplate')}</DropdownMenu.Label>
            {snapshot.templates.length === 0 ? (
              <DropdownMenu.Item disabled>{t('tickets.noTemplates')}</DropdownMenu.Item>
            ) : null}
            {snapshot.templates.map((template) => (
              <DropdownMenu.Item
                key={template.id}
                onSelect={() => {
                  void ticketActions.fromTemplate(template).then((result) => {
                    selectTicket(newest(result.tickets));
                  });
                }}
              >
                {template.name}
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              onSelect={() => {
                setDialog('templates');
              }}
            >
              {t('ticket.manageTemplates')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <IconButton
          label={t('tickets.ticketPanel')}
          size="sm"
          active={panelOpen}
          onClick={() => {
            panelActions.toggle(areaId, 'ticket', width(), TICKET_PANEL_WIDTH);
          }}
        >
          <PanelRight aria-hidden="true" />
        </IconButton>
      </AreaHeaderContent>
      {!loaded ? (
        <div className={styles['loading']}>
          <Spinner label={t('tickets.loading')} />
        </div>
      ) : mode === 'board' ? (
        <BoardView search={search} />
      ) : mode === 'backlog' ? (
        <BacklogView search={search} />
      ) : (
        <CompletedView search={search} />
      )}
      {dialog === 'new' ? (
        <PromptDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          title={t('tickets.newTicket')}
          label={t('ticket.title')}
          submitLabel={t('tickets.add')}
          onSubmit={(title) =>
            ticketActions.create({ title }).then((result) => {
              selectTicket(newest(result.tickets));
            })
          }
        />
      ) : null}
      {dialog === 'templates' ? (
        <TemplatesDialog
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
        />
      ) : null}
    </div>
  );
}
