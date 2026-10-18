import { useState } from 'react';
import { sanitiseNoteTitle, type Note } from '@shared/notes';
import { useTranslation } from '@renderer/lib/i18n';
import { createNote, mergeNotes, nextNoteTitle, useNotes } from '@renderer/lib/notes';
import { Button, Dialog, Field, Select } from '@renderer/ui';
import { PromptDialog } from '../../Shell/PromptDialog';
import styles from './NoteEditor.module.scss';

export function extractTitle(text: string): string {
  const line = text.split('\n').find((item) => item.trim().length > 0) ?? '';
  return sanitiseNoteTitle(line.replace(/^\s*(#{1,6}|[-*+]|\d+\.)\s+/, '').slice(0, 80));
}

export function ExtractDialog({
  note,
  text,
  onClose,
  onExtracted,
}: {
  note: Note;
  text: string;
  onClose: () => void;
  onExtracted: (created: Note) => void;
}) {
  const { t } = useTranslation('notes');
  return (
    <PromptDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('composer.extractTitle')}
      label={t('composer.newTitle')}
      initialValue={extractTitle(text)}
      submitLabel={t('composer.extract')}
      onSubmit={async (title) => {
        const created = await createNote({
          title: nextNoteTitle(sanitiseNoteTitle(title)),
          folderId: note.folderId,
          body: text,
        });
        onExtracted(created);
      }}
    />
  );
}

export function MergeDialog({
  note,
  onClose,
  onMerged,
}: {
  note: Note;
  onClose: () => void;
  onMerged: (targetId: string) => void;
}) {
  const { t } = useTranslation('notes');
  const notes = useNotes();
  const options = notes
    .filter((item) => item.id !== note.id)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((item) => ({ value: item.id, label: item.title }));
  const [target, setTarget] = useState(options[0]?.value ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Content
        title={t('composer.mergeTitle', { name: note.title })}
        description={t('composer.mergeHint')}
        closeLabel={t('close')}
        size="sm"
      >
        <div className={styles['composer']}>
          {options.length === 0 ? (
            <p>{t('composer.nothingToMerge')}</p>
          ) : (
            <Field label={t('composer.mergeInto')}>
              <Select
                options={options}
                value={target}
                aria-label={t('composer.mergeInto')}
                onValueChange={setTarget}
              />
            </Field>
          )}
          <Dialog.Footer>
            <Button variant="ghost" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={!target || busy}
              loading={busy}
              onClick={() => {
                setBusy(true);
                void mergeNotes(note.id, target)
                  .then(() => {
                    onMerged(target);
                  })
                  .finally(() => {
                    setBusy(false);
                  });
              }}
            >
              {t('composer.merge')}
            </Button>
          </Dialog.Footer>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
