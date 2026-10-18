import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { wordCount } from '@shared/markdown';
import type { Note, NoteVersion } from '@shared/notes';
import { useFormat, useTranslation } from '@renderer/lib/i18n';
import { listNoteVersions, restoreNoteVersion } from '@renderer/lib/notes';
import { Button, cx, useToast } from '@renderer/ui';
import { NoteMarkdown } from './NoteMarkdown';
import styles from './NoteDetails.module.scss';

export function NoteHistory({ note }: { note: Note }) {
  const { t } = useTranslation('notes');
  const format = useFormat();
  const toast = useToast();
  const [versions, setVersions] = useState<NoteVersion[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void listNoteVersions(note.id).then((list) => {
      if (current) setVersions(list);
    });
    return () => {
      current = false;
    };
  }, [note.id, note.updatedAt]);

  const chosen = versions?.find((version) => version.id === selected) ?? null;

  if (versions === null) return null;
  if (versions.length === 0) return <p className={styles['muted']}>{t('panel.noHistory')}</p>;

  return (
    <div className={styles['history']}>
      <ul className={styles['list']} aria-label={t('panel.history')}>
        {versions.map((version) => (
          <li key={version.id}>
            <button
              type="button"
              aria-pressed={version.id === selected}
              className={cx(styles['version'], version.id === selected && styles['chosen'])}
              onClick={() => {
                setSelected(version.id === selected ? null : version.id);
              }}
            >
              <span>{format.dateTime(version.createdAt)}</span>
              <span className={styles['muted']}>
                {version.title === note.title ? '' : `${version.title} · `}
                {t('editor.words', { count: wordCount(version.body) })}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {chosen ? (
        <section className={styles['preview']} aria-label={t('panel.versionPreview')}>
          <Button
            size="sm"
            icon={<RotateCcw aria-hidden="true" />}
            onClick={() => {
              void restoreNoteVersion(chosen.id).then(() => {
                setSelected(null);
                toast.show({ title: t('panel.restored'), variant: 'success' });
              });
            }}
          >
            {t('panel.restore')}
          </Button>
          <NoteMarkdown
            body={chosen.body}
            noteId={note.id}
            depth={2}
            onLink={() => undefined}
            onTag={() => undefined}
          />
        </section>
      ) : null}
    </div>
  );
}
