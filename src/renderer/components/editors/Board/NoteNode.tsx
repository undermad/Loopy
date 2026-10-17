import { useEffect, useRef, useState } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { MIN_NOTE_SIZE, noteDataSchema } from '@shared/board';
import { useTranslation } from '@renderer/lib/i18n';
import { cx } from '@renderer/ui';
import styles from './NoteNode.module.scss';

export interface NoteNodeData extends Record<string, unknown> {
  text: string;
  onChange: (text: string) => void;
}

export function NoteNode({ data, selected, dragging }: NodeProps & { data: NoteNodeData }) {
  const { t } = useTranslation('editors');
  const parsed = noteDataSchema.safeParse(data);
  const text = parsed.success ? parsed.data.text : '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) area.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft !== text) data.onChange(draft);
  }

  return (
    <div
      className={cx(
        styles['note'],
        selected && styles['selected'],
        dragging && styles['dragging'],
        editing && styles['editing'],
      )}
      tabIndex={0}
      onDoubleClick={() => {
        setDraft(text);
        setEditing(true);
      }}
      onKeyDown={(event) => {
        if (!editing && event.key === 'Enter' && event.target === event.currentTarget) {
          event.preventDefault();
          setDraft(text);
          setEditing(true);
        }
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_NOTE_SIZE.width}
        minHeight={MIN_NOTE_SIZE.height}
        lineClassName={styles['resizeLine'] ?? ''}
      />
      {editing ? (
        <textarea
          ref={area}
          className={`nodrag nowheel nopan ${styles['text'] ?? ''}`}
          value={draft}
          placeholder={t('board.notePlaceholder')}
          aria-label={t('board.addNote')}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              commit();
            }
            event.stopPropagation();
          }}
        />
      ) : (
        <div
          className={cx(styles['text'], styles['display'], !text && styles['placeholder'])}
          title={t('board.editHint')}
        >
          {text || t('board.notePlaceholder')}
        </div>
      )}
    </div>
  );
}
