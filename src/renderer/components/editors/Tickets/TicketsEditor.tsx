import { Columns3, ListTodo } from 'lucide-react';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import { useTicketsLoaded } from '@renderer/lib/tickets';
import { Input, Spinner, ToggleGroup } from '@renderer/ui';
import { AreaHeaderContent } from '../../Shell/AreaHeaderContent';
import { BacklogView } from './BacklogView';
import { BoardView } from './BoardView';
import styles from './TicketsEditor.module.scss';

export function TicketsEditor({ state, setState }: EditorProps) {
  const { t } = useTranslation('editors');
  const loaded = useTicketsLoaded();
  const mode = state['mode'] === 'backlog' ? 'backlog' : 'board';
  const search = typeof state['search'] === 'string' ? state['search'] : '';

  return (
    <div className={styles['editor']}>
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
      </AreaHeaderContent>
      {!loaded ? (
        <div className={styles['loading']}>
          <Spinner label={t('tickets.loading')} />
        </div>
      ) : mode === 'board' ? (
        <BoardView search={search} />
      ) : (
        <BacklogView search={search} />
      )}
    </div>
  );
}
