import { useState, type ComponentType } from 'react';
import {
  DEFAULT_NOTE_FILL,
  MIN_NOTE_SIZE,
  noteDataSchema,
  type Board,
  type BoardNode,
  type BoardNodeType,
} from '@shared/board';
import { commitChanges, fromUnits, toUnits, useLiveNode } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, Field, TextArea } from '@renderer/ui';
import { ProjectColourPicker } from '../../ProjectColourPicker/ProjectColourPicker';
import { NumberField } from './NumberField';
import styles from './PropertiesEditor.module.scss';

function TransformSection({ board, node: stored }: { board: Board; node: BoardNode }) {
  const { t } = useTranslation('editors');
  const node = useLiveNode(stored);
  const patch = (changes: Partial<Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>>) =>
    void commitChanges(node.boardId, { upsertNodes: [{ ...node, ...changes }] });
  const label = (key: 'x' | 'y' | 'width' | 'height') => `${t(`properties.${key}`)} (${board.unit})`;

  return (
    <>
      <h3 className={styles['heading']}>{t('properties.position')}</h3>
      <div className={styles['pair']}>
        <NumberField
          label={label('x')}
          value={toUnits(node.x, board)}
          onCommit={(value) => {
            patch({ x: fromUnits(value, board) });
          }}
        />
        <NumberField
          label={label('y')}
          value={toUnits(node.y, board)}
          onCommit={(value) => {
            patch({ y: fromUnits(value, board) });
          }}
        />
      </div>
      <h3 className={styles['heading']}>{t('properties.size')}</h3>
      <div className={styles['pair']}>
        <NumberField
          label={label('width')}
          value={toUnits(node.width, board)}
          min={toUnits(MIN_NOTE_SIZE.width, board)}
          onCommit={(value) => {
            patch({ width: fromUnits(value, board) });
          }}
        />
        <NumberField
          label={label('height')}
          value={toUnits(node.height, board)}
          min={toUnits(MIN_NOTE_SIZE.height, board)}
          onCommit={(value) => {
            patch({ height: fromUnits(value, board) });
          }}
        />
      </div>
    </>
  );
}

function NoteSection({ node }: { node: BoardNode }) {
  const { t } = useTranslation('editors');
  const parsed = noteDataSchema.safeParse(node.data).data;
  const text = parsed?.text ?? '';
  const fill = parsed?.fill ?? null;
  const [draft, setDraft] = useState<string | null>(null);
  const setFill = (next: typeof fill) =>
    void commitChanges(node.boardId, { upsertNodes: [{ ...node, data: { ...node.data, fill: next } }] });

  return (
    <>
      <h3 className={styles['heading']}>{t('properties.note')}</h3>
      <div className={styles['swatchRow']}>
        <ProjectColourPicker
          size="sm"
          value={fill ?? { hex: DEFAULT_NOTE_FILL, ref: null }}
          label={t('properties.fill')}
          onChange={setFill}
        />
        <span>{t('properties.fill')}</span>
        {fill ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFill(null);
            }}
          >
            {t('properties.resetFill')}
          </Button>
        ) : null}
      </div>
      <Field label={t('properties.text')}>
        <TextArea
          rows={4}
          value={draft ?? text}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onBlur={() => {
            if (draft !== null && draft !== text) {
              void commitChanges(node.boardId, {
                upsertNodes: [{ ...node, data: { ...node.data, text: draft } }],
              });
            }
            setDraft(null);
          }}
        />
      </Field>
    </>
  );
}

const TYPE_SECTIONS: Record<BoardNodeType, ComponentType<{ node: BoardNode }>> = { note: NoteSection };

export function NodeProperties({ board, node }: { board: Board; node: BoardNode }) {
  const { t } = useTranslation('editors');
  const TypeSection = TYPE_SECTIONS[node.type];
  return (
    <section className={styles['section']} aria-label={t(`properties.${node.type}`)}>
      <TransformSection board={board} node={node} />
      <TypeSection node={node} />
    </section>
  );
}
