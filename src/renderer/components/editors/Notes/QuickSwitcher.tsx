import { useMemo, useState } from 'react';
import { FilePlus, NotebookText } from 'lucide-react';
import { sanitiseNoteTitle } from '@shared/notes';
import { useAssetsSnapshot } from '@renderer/lib/assets';
import { useTranslation } from '@renderer/lib/i18n';
import { createNote, fuzzyScore, nextNoteTitle, useNoteIndex } from '@renderer/lib/notes';
import { Dialog, Input, cx } from '@renderer/ui';
import { folderPathOf } from './paths';
import { useNoteNavigation } from './useNoteNavigation';
import styles from './QuickSwitcher.module.scss';

export interface QuickSwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LIMIT = 30;

export function QuickSwitcher({ open, onOpenChange }: QuickSwitcherProps) {
  const { t } = useTranslation('notes');
  const index = useNoteIndex();
  const { folders } = useAssetsSnapshot();
  const nav = useNoteNavigation();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  const results = useMemo(() => {
    const scored = index.notes
      .map((note) => {
        const aliases = index.parsed.get(note.id)?.aliases ?? [];
        const best = Math.max(
          fuzzyScore(note.title, query),
          ...aliases.map((alias) => fuzzyScore(alias, query) - 1),
        );
        return { note, score: best };
      })
      .filter((entry) => entry.score > 0);
    scored.sort((a, b) =>
      query.trim() ? b.score - a.score : b.note.updatedAt.localeCompare(a.note.updatedAt),
    );
    return scored.slice(0, LIMIT).map((entry) => entry.note);
  }, [index, query]);

  const exact = results.some((note) => note.title.toLowerCase() === query.trim().toLowerCase());
  const canCreate = query.trim().length > 0 && !exact;

  function close() {
    onOpenChange(false);
    setQuery('');
    setCursor(0);
  }

  async function create() {
    const note = await createNote({ title: nextNoteTitle(sanitiseNoteTitle(query)) });
    close();
    nav.openNote(note.id);
  }

  function choose(position: number) {
    const note = results[position];
    if (note) {
      close();
      nav.openNote(note.id);
      return;
    }
    if (canCreate) void create();
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(true);
      }}
    >
      <Dialog.Content title={t('switcher.title')} closeLabel={t('close')} size="md">
        <div className={styles['switcher']}>
          <Input
            autoFocus
            value={query}
            placeholder={t('switcher.placeholder')}
            aria-label={t('switcher.placeholder')}
            role="combobox"
            aria-expanded="true"
            aria-controls="note-switcher-list"
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setCursor((value) => Math.min(value + 1, results.length - (canCreate ? 0 : 1)));
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setCursor((value) => Math.max(value - 1, 0));
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                if (event.shiftKey && canCreate) void create();
                else choose(cursor);
              }
            }}
          />
          <ul
            id="note-switcher-list"
            role="listbox"
            className={styles['list']}
            aria-label={t('switcher.title')}
          >
            {results.map((note, position) => (
              <li
                key={note.id}
                role="option"
                aria-selected={position === cursor}
                className={cx(styles['option'], position === cursor && styles['selected'])}
                onMouseEnter={() => {
                  setCursor(position);
                }}
                onClick={() => {
                  choose(position);
                }}
              >
                <NotebookText aria-hidden="true" />
                <span className={styles['name']}>{note.title}</span>
                <span className={styles['path']}>{folderPathOf(folders, note.folderId)}</span>
              </li>
            ))}
            {canCreate ? (
              <li
                role="option"
                aria-selected={cursor === results.length}
                className={cx(styles['option'], cursor === results.length && styles['selected'])}
                onMouseEnter={() => {
                  setCursor(results.length);
                }}
                onClick={() => void create()}
              >
                <FilePlus aria-hidden="true" />
                <span className={styles['name']}>{t('switcher.create', { name: query.trim() })}</span>
              </li>
            ) : null}
            {results.length === 0 && !canCreate ? (
              <li className={styles['empty']}>{t('switcher.none')}</li>
            ) : null}
          </ul>
          <p className={styles['hint']}>{t('switcher.hint')}</p>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
