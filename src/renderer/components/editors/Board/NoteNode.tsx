import { useState } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { noteDataSchema } from '@shared/board';
import { useTranslation } from '@renderer/lib/i18n';
import styles from './NoteNode.module.scss';

export interface NoteNodeData extends Record<string, unknown> {
  text: string;
  onChange: (text: string) => void;
}

export function NoteNode({ data, selected }: NodeProps & { data: NoteNodeData }) {
  const { t } = useTranslation('editors');
  const parsed = noteDataSchema.safeParse(data);
  const [draft, setDraft] = useState(parsed.success ? parsed.data.text : '');

  return (
    <div className={styles['note']}>
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={80}
        lineClassName={styles['resizeLine'] ?? ''}
      />
      <textarea
        className={`nodrag ${styles['text'] ?? ''}`}
        value={draft}
        placeholder={t('board.notePlaceholder')}
        aria-label={t('board.addNote')}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          if (draft !== data.text) data.onChange(draft);
        }}
      />
    </div>
  );
}
