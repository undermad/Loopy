import { useRef, useState, type MouseEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EyeOff, Lock, Plus, Scissors, Sigma, Split } from 'lucide-react';
import { fieldGridStyle } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { cx } from '@renderer/ui';
import type { CardDesignFieldProps } from '../CardView';
import { FieldPicker } from '../FieldPicker';
import { useCanvas } from './context';
import { FieldResizer } from './FieldResizer';
import { FieldToolbar } from './FieldToolbar';
import styles from './Canvas.module.scss';

function RenameInput({ id, label }: { id: string; label: string }) {
  const { t } = useTranslation('editors');
  const canvas = useCanvas();
  const [draft, setDraft] = useState(label);
  const done = useRef(false);
  const finish = (next: string | null) => {
    if (done.current) return;
    done.current = true;
    canvas.rename(id, next);
  };
  return (
    <input
      className={styles['renameInput']}
      value={draft}
      maxLength={80}
      aria-label={t('cards.renameField', { label })}
      ref={(element) => {
        element?.focus();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') finish(draft.trim());
        if (event.key === 'Escape') finish(null);
      }}
      onBlur={() => {
        finish(draft.trim());
      }}
    />
  );
}

function Badges({ field }: Pick<CardDesignFieldProps, 'field'>) {
  const { t } = useTranslation('editors');
  const canvas = useCanvas();
  const marks = [
    field.kind === 'formula' ? { key: 'formula', label: t('cards.badges.formula'), Icon: Sigma } : null,
    field.visibleWhen ? { key: 'rule', label: t('cards.badges.rule'), Icon: Split } : null,
    field.hidden ? { key: 'hidden', label: t('cards.badges.hidden'), Icon: EyeOff } : null,
    field.locked ? { key: 'locked', label: t('cards.badges.locked'), Icon: Lock } : null,
    canvas.overflowing.includes(field.id)
      ? { key: 'overflow', label: t('cards.badges.overflow'), Icon: Scissors }
      : null,
  ].filter((mark) => mark !== null);
  if (marks.length === 0) return null;
  return (
    <span className={styles['badges']}>
      {marks.map(({ key, label, Icon }) => (
        <Icon key={key} role="img" aria-label={label} />
      ))}
    </span>
  );
}

export function FieldFrame({
  field,
  visible,
  label,
  className,
  labelClassName,
  helpMark,
  body,
}: CardDesignFieldProps) {
  const { t } = useTranslation('editors');
  const canvas = useCanvas();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
    disabled: field.locked,
  });
  const selected = canvas.selected.includes(field.id);
  const primary = selected && canvas.selected.length === 1;
  const preview = canvas.resizing?.id === field.id ? canvas.resizing : null;
  const shown = preview ? { ...field, span: preview.span ?? field.span, height: preview.height } : field;
  const renaming = canvas.renaming === field.id;
  const select = (event: MouseEvent) => {
    event.stopPropagation();
    canvas.select(field.id, event.shiftKey || event.ctrlKey || event.metaKey ? 'toggle' : 'only');
  };
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="group"
      tabIndex={-1}
      aria-label={label}
      aria-roledescription={undefined}
      className={cx(
        className,
        styles['frame'],
        field.locked && styles['locked'],
        selected && styles['selected'],
        isDragging && styles['dragging'],
        canvas.overflowing.includes(field.id) && styles['overflow'],
      )}
      style={{ ...fieldGridStyle(shown), transform: CSS.Translate.toString(transform), transition }}
      data-kind={field.kind}
      data-field-id={field.id}
      data-selected={selected ? 'true' : 'false'}
      data-visible={visible ? 'true' : 'false'}
      onClick={select}
    >
      {renaming ? (
        <RenameInput id={field.id} label={label} />
      ) : field.showLabel && field.kind !== 'separator' ? (
        <span
          className={labelClassName}
          onDoubleClick={(event) => {
            event.stopPropagation();
            canvas.startRename(field.id);
          }}
        >
          {label}
          {helpMark}
        </span>
      ) : null}
      {body}
      <Badges field={field} />
      {primary ? <FieldToolbar field={field} /> : null}
      {primary && !field.locked ? <FieldResizer field={field} label={label} /> : null}
      <span
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <FieldPicker
          label={t('cards.addFieldAfter', { label })}
          onPick={(preset) => {
            canvas.addAfter(field.id, preset);
          }}
          trigger={
            <button type="button" className={styles['add']} aria-label={t('cards.addFieldAfter', { label })}>
              <Plus aria-hidden="true" />
            </button>
          }
        />
      </span>
    </div>
  );
}
