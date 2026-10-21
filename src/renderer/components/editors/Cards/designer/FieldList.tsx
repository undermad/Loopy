import { createElement, useState, type MouseEvent } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Copy, GripVertical, ListPlus, Lock, Trash2 } from 'lucide-react';
import type { CardField } from '@shared/cards';
import { moveField, presetOf, type FieldPresetId } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, IconButton, cx } from '@renderer/ui';
import { FieldPicker, type FieldBlockId } from '../FieldPicker';
import { FIELD_ICONS } from '../fieldIcons';
import { AddSeveralDialog } from './AddSeveralDialog';
import styles from '../CardDesigner.module.scss';

export type SelectMode = 'only' | 'toggle' | 'range';

function selectMode(event: MouseEvent): SelectMode {
  if (event.shiftKey) return 'range';
  return event.ctrlKey || event.metaKey ? 'toggle' : 'only';
}

function FieldRow({
  field,
  selected,
  onSelect,
  onDuplicate,
  onRemove,
}: {
  field: CardField;
  selected: boolean;
  onSelect: (mode: SelectMode) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('editors');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const label = field.label || t('cards.untitled');
  const preset = presetOf(field);
  return (
    <li
      ref={setNodeRef}
      className={cx(
        styles['fieldRow'],
        selected && styles['fieldRowSelected'],
        isDragging && styles['dragging'],
      )}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        className={styles['grip']}
        aria-label={t('cards.dragField', { label })}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" />
      </button>
      {createElement(FIELD_ICONS[preset], { 'aria-hidden': true, className: styles['fieldIcon'] })}
      <button
        type="button"
        className={styles['fieldSelect']}
        aria-label={t('cards.selectField', { label })}
        aria-pressed={selected}
        onClick={(event) => {
          onSelect(selectMode(event));
        }}
      >
        <span className={styles['fieldName']}>{label}</span>
        <span className={styles['fieldKind']}>{t(`cards.presets.${preset}`)}</span>
      </button>
      {field.locked ? (
        <Lock aria-label={t('cards.badges.locked')} role="img" className={styles['fieldIcon']} />
      ) : null}
      <IconButton
        label={t('cards.duplicateField', { label })}
        size="sm"
        tooltip={false}
        onClick={onDuplicate}
      >
        <Copy aria-hidden="true" />
      </IconButton>
      <IconButton
        label={t('cards.removeField', { label })}
        size="sm"
        tooltip={false}
        disabled={field.locked}
        onClick={onRemove}
      >
        <Trash2 aria-hidden="true" />
      </IconButton>
    </li>
  );
}

export interface FieldListProps {
  fields: CardField[];
  selected: readonly string[];
  pickerOpen: boolean;
  onPickerOpen: (open: boolean) => void;
  onSelect: (id: string, mode: SelectMode) => void;
  onFields: (fields: CardField[]) => void;
  onAdd: (preset: FieldPresetId) => void;
  onAddBlock: (block: FieldBlockId) => void;
  onAddSeveral: (text: string, preset: FieldPresetId) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onCardSettings: () => void;
}

export function FieldList({
  fields,
  selected,
  pickerOpen,
  onPickerOpen,
  onSelect,
  onFields,
  onAdd,
  onAddBlock,
  onAddSeveral,
  onDuplicate,
  onRemove,
  onCardSettings,
}: FieldListProps) {
  const { t } = useTranslation('editors');
  const [several, setSeveral] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function reorder(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const from = fields.findIndex((field) => field.id === event.active.id);
    const to = fields.findIndex((field) => field.id === event.over?.id);
    onFields(moveField(fields, from, to));
  }

  return (
    <aside className={styles['fields']} aria-label={t('cards.fields')}>
      <div className={styles['fieldsHeader']}>
        <h3 className={styles['heading']}>{t('cards.fields')}</h3>
        <FieldPicker
          label={t('cards.addField')}
          onPick={onAdd}
          onPickBlock={onAddBlock}
          open={pickerOpen}
          onOpenChange={onPickerOpen}
        />
      </div>
      <Button
        size="sm"
        variant="ghost"
        icon={<ListPlus aria-hidden="true" />}
        onClick={() => {
          setSeveral(true);
        }}
      >
        {t('cards.addSeveral')}
      </Button>
      {fields.length === 0 ? (
        <p className={styles['muted']}>{t('cards.emptyHint')}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder}>
          <SortableContext items={fields.map((field) => field.id)} strategy={verticalListSortingStrategy}>
            <ul className={styles['fieldList']}>
              {fields.map((field) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  selected={selected.includes(field.id)}
                  onSelect={(mode) => {
                    onSelect(field.id, mode);
                  }}
                  onDuplicate={() => {
                    onDuplicate(field.id);
                  }}
                  onRemove={() => {
                    onRemove(field.id);
                  }}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      <Button
        size="sm"
        variant="ghost"
        className={cx(styles['cardButton'], selected.length === 0 && styles['cardButtonActive'])}
        onClick={onCardSettings}
      >
        {t('cards.cardSettings')}
      </Button>
      <AddSeveralDialog open={several} onOpenChange={setSeveral} onAdd={onAddSeveral} />
    </aside>
  );
}
