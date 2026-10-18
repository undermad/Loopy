import { useMemo, useState } from 'react';
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
import { Copy, GripVertical, LayoutTemplate, Plus, Trash2 } from 'lucide-react';
import type { CardValue } from '@shared/board';
import {
  CARD_FIELD_KINDS,
  cardTemplateInputSchema,
  type CardField,
  type CardLayout,
  type CardTemplate,
} from '@shared/cards';
import { resolveItemStyle } from '@renderer/lib/board';
import {
  STARTER_TEMPLATES,
  blankTemplate,
  createCardTemplate,
  deleteCardTemplate,
  duplicateCardTemplate,
  moveField,
  newField,
  updateCardTemplate,
  useCardTemplates,
} from '@renderer/lib/cards';
import { readableTextColour } from '@renderer/lib/colour';
import { useTranslation } from '@renderer/lib/i18n';
import { useResolvedColour } from '@renderer/lib/palettes';
import {
  Button,
  ConfirmDialog,
  Dialog,
  DropdownMenu,
  Field,
  IconButton,
  Input,
  Select,
  cx,
  useToast,
} from '@renderer/ui';
import { CardView } from './CardView';
import { CardSettings, FieldSettings } from './TemplateSettings';
import styles from './TemplateEditorDialog.module.scss';

export type TemplateDraft = CardLayout & { name: string };

export interface TemplateEditorDialogProps {
  open: boolean;
  templateId: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (template: CardTemplate) => void;
}

function toDraft(template: CardTemplate): TemplateDraft {
  const { id: _id, createdAt: _created, updatedAt: _updated, ...rest } = structuredClone(template);
  return rest;
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
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('editors');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const label = field.label || t('cards.untitled');
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
      <button
        type="button"
        className={styles['fieldSelect']}
        aria-label={t('cards.selectField', { label })}
        onClick={onSelect}
      >
        <span className={styles['fieldName']}>{label}</span>
        <span className={styles['fieldKind']}>{t(`cards.kinds.${field.kind}`)}</span>
      </button>
      <IconButton
        label={t('cards.duplicateField', { label })}
        size="sm"
        tooltip={false}
        onClick={onDuplicate}
      >
        <Copy aria-hidden="true" />
      </IconButton>
      <IconButton label={t('cards.removeField', { label })} size="sm" tooltip={false} onClick={onRemove}>
        <Trash2 aria-hidden="true" />
      </IconButton>
    </li>
  );
}

function CardPreview({
  draft,
  values,
  selectedFieldId,
  onValue,
  onSelectField,
}: {
  draft: TemplateDraft;
  values: Record<string, CardValue>;
  selectedFieldId: string | null;
  onValue: (fieldId: string, value: CardValue) => void;
  onSelectField: (fieldId: string) => void;
}) {
  const style = resolveItemStyle('card', draft.style);
  const fill = useResolvedColour(style.fill);
  const stroke = useResolvedColour(style.stroke);
  const textOverride = useResolvedColour(style.textColour);
  const accent = useResolvedColour(draft.accent);
  const text = textOverride ?? (fill ? readableTextColour(fill) : '#1a1a1a');
  return (
    <div
      className={styles['previewCard']}
      style={{
        width: draft.width,
        height: draft.height,
        background: fill ?? 'transparent',
        border:
          stroke && style.strokeWidth > 0
            ? `${String(style.strokeWidth)}px ${style.strokeStyle} ${stroke}`
            : 'none',
        borderRadius: style.radius,
        boxShadow: style.shadow ? '0 2px 10px rgb(0 0 0 / 18%)' : 'none',
        padding: style.padding,
        color: text,
        fontSize: style.fontSize,
        opacity: style.opacity,
      }}
    >
      {accent ? <span className={styles['accent']} style={{ background: accent }} /> : null}
      <CardView
        layout={draft}
        values={values}
        editable
        onChange={onValue}
        selectedFieldId={selectedFieldId}
        onSelectField={onSelectField}
        className={styles['previewBody']}
      />
    </div>
  );
}

export function TemplateEditorDialog({ open, templateId, onOpenChange, onSaved }: TemplateEditorDialogProps) {
  const { t } = useTranslation('editors');
  const { t: tc } = useTranslation('common');
  const toast = useToast();
  const templates = useCardTemplates() ?? [];
  const [currentId, setCurrentId] = useState<string | null>(templateId);
  const stored = templates.find((item) => item.id === currentId) ?? null;
  const [draft, setDraft] = useState<TemplateDraft | null>(stored ? toDraft(stored) : null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, CardValue>>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const dirty = useMemo(
    () => draft !== null && (!stored || JSON.stringify(draft) !== JSON.stringify(toDraft(stored))),
    [draft, stored],
  );
  const selectedField = draft?.fields.find((field) => field.id === selectedFieldId) ?? null;

  function load(id: string | null, from: CardTemplate[] = templates) {
    const next = from.find((item) => item.id === id) ?? null;
    setCurrentId(next ? id : null);
    setDraft(next ? toDraft(next) : null);
    setSelectedFieldId(null);
    setValues({});
  }

  function start(input: Parameters<typeof cardTemplateInputSchema.parse>[0]) {
    setDraft(cardTemplateInputSchema.parse(input));
    setSelectedFieldId(null);
    setValues({});
  }

  function patch(next: Partial<TemplateDraft>) {
    setDraft((current) => (current ? { ...current, ...next } : current));
  }

  function patchField(id: string, next: Partial<CardField>) {
    setDraft((current) =>
      current
        ? {
            ...current,
            fields: current.fields.map((field) => (field.id === id ? { ...field, ...next } : field)),
          }
        : current,
    );
  }

  function addField(kind: CardField['kind']) {
    if (!draft) return;
    const field = newField(kind, t(`cards.kinds.${kind}`), draft.fields);
    patch({ fields: [...draft.fields, field] });
    setSelectedFieldId(field.id);
  }

  function reorder(event: DragEndEvent) {
    if (!draft || !event.over || event.active.id === event.over.id) return;
    const from = draft.fields.findIndex((field) => field.id === event.active.id);
    const to = draft.fields.findIndex((field) => field.id === event.over?.id);
    patch({ fields: moveField(draft.fields, from, to) });
  }

  async function save() {
    if (!draft || busy || !dirty) return;
    setBusy(true);
    try {
      const input = {
        ...draft,
        name: draft.name.trim() || t('cards.defaultName', { number: templates.length + 1 }),
      };
      const saved = stored ? await updateCardTemplate(stored.id, input) : await createCardTemplate(input);
      setCurrentId(saved.id);
      setDraft(toDraft(saved));
      toast.show({ title: t('cards.saved', { name: saved.name }), variant: 'success' });
      onSaved?.(saved);
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    if (!stored) return;
    const copy = await duplicateCardTemplate(stored.id, t('cards.copyName', { name: stored.name }));
    if (copy) load(copy.id, [copy]);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        title={t('cards.editorTitle')}
        closeLabel={tc('actions.close')}
        size="xl"
        className={styles['dialog']}
      >
        <div className={styles['top']}>
          <Field label={t('cards.templates')}>
            <Select
              size="sm"
              value={currentId ?? '__new'}
              aria-label={t('cards.templates')}
              options={[
                ...templates.map((template) => ({ value: template.id, label: template.name })),
                { value: '__new', label: t('cards.newTemplate') },
              ]}
              onValueChange={(value) => {
                load(value === '__new' ? null : value);
              }}
            />
          </Field>
          {draft ? (
            <Field label={t('cards.name')}>
              <Input
                size="sm"
                value={draft.name}
                maxLength={80}
                onChange={(event) => {
                  patch({ name: event.target.value });
                }}
              />
            </Field>
          ) : null}
          <span className={styles['spacer']} />
          {dirty ? <span className={styles['unsaved']}>{t('cards.unsaved')}</span> : null}
        </div>
        {draft ? (
          <div className={styles['layout']}>
            <aside className={styles['fields']} aria-label={t('cards.fields')}>
              <div className={styles['fieldsHeader']}>
                <h3 className={styles['heading']}>{t('cards.fields')}</h3>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <Button size="sm" icon={<Plus aria-hidden="true" />}>
                      {t('cards.addField')}
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end">
                    {CARD_FIELD_KINDS.map((kind) => (
                      <DropdownMenu.Item
                        key={kind}
                        onSelect={() => {
                          addField(kind);
                        }}
                      >
                        {t(`cards.kinds.${kind}`)}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </div>
              {draft.fields.length === 0 ? (
                <p className={styles['muted']}>{t('cards.emptyHint')}</p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder}>
                  <SortableContext
                    items={draft.fields.map((field) => field.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className={styles['fieldList']}>
                      {draft.fields.map((field) => (
                        <FieldRow
                          key={field.id}
                          field={field}
                          selected={field.id === selectedFieldId}
                          onSelect={() => {
                            setSelectedFieldId(field.id);
                          }}
                          onDuplicate={() => {
                            const copy = {
                              ...structuredClone(field),
                              id: newField(field.kind, '', draft.fields).id,
                            };
                            const index = draft.fields.indexOf(field);
                            patch({
                              fields: [
                                ...draft.fields.slice(0, index + 1),
                                copy,
                                ...draft.fields.slice(index + 1),
                              ],
                            });
                            setSelectedFieldId(copy.id);
                          }}
                          onRemove={() => {
                            patch({ fields: draft.fields.filter((item) => item.id !== field.id) });
                            if (selectedFieldId === field.id) setSelectedFieldId(null);
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
                className={cx(styles['cardButton'], selectedFieldId === null && styles['cardButtonActive'])}
                onClick={() => {
                  setSelectedFieldId(null);
                }}
              >
                {t('cards.cardSettings')}
              </Button>
            </aside>
            <section className={styles['stage']} aria-label={t('cards.preview')}>
              <CardPreview
                draft={draft}
                values={values}
                selectedFieldId={selectedFieldId}
                onValue={(fieldId, value) => {
                  setValues((current) => ({ ...current, [fieldId]: value }));
                }}
                onSelectField={setSelectedFieldId}
              />
            </section>
            <aside
              className={styles['settings']}
              aria-label={selectedField ? t('cards.fieldSettings') : t('cards.cardSettings')}
            >
              {selectedField ? (
                <FieldSettings
                  key={selectedField.id}
                  field={selectedField}
                  onChange={(next) => {
                    patchField(selectedField.id, next);
                  }}
                />
              ) : (
                <CardSettings draft={draft} onChange={patch} />
              )}
            </aside>
          </div>
        ) : (
          <div className={styles['starters']}>
            <h3 className={styles['heading']}>{t('cards.startFrom')}</h3>
            <div className={styles['starterGrid']}>
              <button
                type="button"
                className={styles['starter']}
                onClick={() => {
                  start(blankTemplate(t('cards.defaultName', { number: templates.length + 1 })));
                }}
              >
                <LayoutTemplate aria-hidden="true" />
                {t('cards.blank')}
              </button>
              {STARTER_TEMPLATES.map((starter) => (
                <button
                  key={starter.id}
                  type="button"
                  className={styles['starter']}
                  onClick={() => {
                    start(structuredClone(starter.template));
                  }}
                >
                  <LayoutTemplate aria-hidden="true" />
                  {starter.template.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <Dialog.Footer>
          {stored ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 aria-hidden="true" />}
                onClick={() => {
                  setConfirming(true);
                }}
              >
                {t('cards.delete')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Copy aria-hidden="true" />}
                onClick={() => void duplicate()}
              >
                {t('cards.duplicate')}
              </Button>
            </>
          ) : null}
          <span className={styles['spacer']} />
          {dirty ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                load(currentId);
              }}
            >
              {t('cards.discard')}
            </Button>
          ) : null}
          <Button size="sm" variant="primary" disabled={!draft || busy} onClick={() => void save()}>
            {t('cards.save')}
          </Button>
        </Dialog.Footer>
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={t('cards.delete')}
          description={t('cards.deleteConfirm', { name: stored?.name ?? '' })}
          confirmLabel={tc('actions.delete')}
          cancelLabel={tc('actions.cancel')}
          closeLabel={tc('actions.close')}
          destructive
          onConfirm={async () => {
            if (!stored) return;
            const remaining = await deleteCardTemplate(stored.id);
            load(remaining[0]?.id ?? null, remaining);
          }}
        />
      </Dialog.Content>
    </Dialog.Root>
  );
}
