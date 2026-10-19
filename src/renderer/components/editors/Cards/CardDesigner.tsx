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
import { Copy, GripVertical, IdCard, LayoutTemplate, Plus, Trash2 } from 'lucide-react';
import type { CardValue } from '@shared/board';
import {
  CARD_FIELD_KINDS,
  cardLayoutSchema,
  cardTemplateInputSchema,
  type CardField,
  type CardLayout,
  type CardTemplate,
  type SavedCard,
} from '@shared/cards';
import {
  STARTER_TEMPLATES,
  blankTemplate,
  createCardTemplate,
  createSavedCard,
  deleteCardTemplate,
  deleteSavedCard,
  duplicateCardTemplate,
  duplicateSavedCard,
  moveField,
  newField,
  resolveCardLayout,
  updateCardTemplate,
  updateSavedCard,
  useCardTemplates,
  useSavedCards,
} from '@renderer/lib/cards';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  Field,
  IconButton,
  Input,
  Select,
  cx,
  useToast,
} from '@renderer/ui';
import { BoardCardDesigner } from './BoardCardDesigner';
import { CardPreview } from './CardPreview';
import { CardSettings, FieldSettings } from './TemplateSettings';
import styles from './CardDesigner.module.scss';

export type TemplateDraft = CardLayout & { name: string };

type TargetKind = 'template' | 'card';

interface Target {
  kind: TargetKind;
  id: string;
}

interface Draft {
  kind: TargetKind;
  name: string;
  templateId: string | null;
  layout: CardLayout | null;
  values: Record<string, CardValue>;
}

const NO_TEMPLATE = '__none';

function readTarget(state: Record<string, unknown>): Target | null {
  const raw = state['target'];
  if (typeof raw !== 'object' || raw === null) return null;
  const { kind, id } = raw as Record<string, unknown>;
  return (kind === 'template' || kind === 'card') && typeof id === 'string' && id ? { kind, id } : null;
}

function layoutOf(source: CardLayout): CardLayout {
  const { width, height, style, accent, gap, fields } = structuredClone(source);
  return { width, height, style, accent, gap, fields };
}

function templateDraft(template: CardTemplate): Draft {
  return { kind: 'template', name: template.name, templateId: null, layout: layoutOf(template), values: {} };
}

function cardDraft(card: SavedCard): Draft {
  return {
    kind: 'card',
    name: card.name,
    templateId: card.templateId,
    layout: card.templateId === null && card.layout ? layoutOf(card.layout) : null,
    values: structuredClone(card.values),
  };
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

function Starters({ onStart }: { onStart: (draft: Draft) => void }) {
  const { t } = useTranslation('editors');
  const templates = useCardTemplates() ?? [];
  const cards = useSavedCards() ?? [];
  const parse = (input: Parameters<typeof cardTemplateInputSchema.parse>[0]) => {
    const { name, ...layout } = cardTemplateInputSchema.parse(input);
    return { name, layout };
  };
  return (
    <div className={styles['starters']}>
      <h3 className={styles['heading']}>{t('cards.startFrom')}</h3>
      <div className={styles['starterGrid']}>
        <button
          type="button"
          className={styles['starter']}
          onClick={() => {
            const { name, layout } = parse(
              blankTemplate(t('cards.defaultName', { number: templates.length + 1 })),
            );
            onStart({ kind: 'template', name, templateId: null, layout, values: {} });
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
              const { name, layout } = parse(structuredClone(starter.template));
              onStart({ kind: 'template', name, templateId: null, layout, values: {} });
            }}
          >
            <LayoutTemplate aria-hidden="true" />
            {starter.template.name}
          </button>
        ))}
      </div>
      <h3 className={styles['heading']}>{t('cards.newCard')}</h3>
      <div className={styles['starterGrid']}>
        <button
          type="button"
          className={styles['starter']}
          onClick={() => {
            const { name, layout } = parse(
              blankTemplate(t('cards.defaultName', { number: cards.length + 1 })),
            );
            onStart({ kind: 'card', name, templateId: null, layout, values: {} });
          }}
        >
          <IdCard aria-hidden="true" />
          {t('cards.blankCard')}
        </button>
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            className={styles['starter']}
            onClick={() => {
              onStart({
                kind: 'card',
                name: template.name,
                templateId: template.id,
                layout: null,
                values: {},
              });
            }}
          >
            <IdCard aria-hidden="true" />
            {t('cards.cardFrom', { name: template.name })}
          </button>
        ))}
      </div>
    </div>
  );
}

function Designer({
  target,
  stored,
  initial,
  setTarget,
}: {
  target: Target | null;
  stored: CardTemplate | SavedCard | null;
  initial: Draft | null;
  setTarget: (target: Target | null) => void;
}) {
  const { t } = useTranslation('editors');
  const { t: tc } = useTranslation('common');
  const toast = useToast();
  const templates = useCardTemplates() ?? [];
  const [draft, setDraft] = useState<Draft | null>(initial);
  const [preview, setPreview] = useState<Record<string, CardValue>>({});
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const dirty = useMemo(
    () => draft !== null && (!initial || JSON.stringify(draft) !== JSON.stringify(initial)),
    [draft, initial],
  );

  if (!draft) {
    return (
      <div className={styles['designer']}>
        {target ? <p className={styles['muted']}>{t('cards.missingTarget')}</p> : null}
        <Starters onStart={setDraft} />
      </div>
    );
  }

  const current = draft;
  const isTemplate = current.kind === 'template';
  const layout = resolveCardLayout(current, templates);
  const values = isTemplate ? preview : current.values;
  const selectedField = current.layout?.fields.find((field) => field.id === selectedFieldId) ?? null;

  function update(next: (draft: Draft) => Draft) {
    setDraft((value) => (value ? next(value) : value));
  }

  function patchLayout(next: Partial<TemplateDraft>) {
    const { name, ...rest } = next;
    update((value) => ({
      ...value,
      ...(name === undefined ? {} : { name }),
      layout: value.layout ? { ...value.layout, ...rest } : value.layout,
    }));
  }

  function patchField(id: string, next: Partial<CardField>) {
    update((value) =>
      value.layout
        ? {
            ...value,
            layout: {
              ...value.layout,
              fields: value.layout.fields.map((field) => (field.id === id ? { ...field, ...next } : field)),
            },
          }
        : value,
    );
  }

  function setValue(fieldId: string, value: CardValue) {
    if (isTemplate) setPreview((own) => ({ ...own, [fieldId]: value }));
    else update((own) => ({ ...own, values: { ...own.values, [fieldId]: value } }));
  }

  function chooseTemplate(value: string) {
    update((own) => {
      if (value !== NO_TEMPLATE) return { ...own, templateId: value, layout: null };
      const resolved = resolveCardLayout(own, templates);
      return { ...own, templateId: null, layout: resolved ? layoutOf(resolved) : cardLayoutSchema.parse({}) };
    });
    setSelectedFieldId(null);
  }

  function addField(kind: CardField['kind']) {
    if (!current.layout) return;
    const field = newField(kind, t(`cards.kinds.${kind}`), current.layout.fields);
    patchLayout({ fields: [...current.layout.fields, field] });
    setSelectedFieldId(field.id);
  }

  function reorder(event: DragEndEvent) {
    const fields = current.layout?.fields;
    if (!fields || !event.over || event.active.id === event.over.id) return;
    const from = fields.findIndex((field) => field.id === event.active.id);
    const to = fields.findIndex((field) => field.id === event.over?.id);
    patchLayout({ fields: moveField(fields, from, to) });
  }

  async function save() {
    if (busy || !dirty) return;
    setBusy(true);
    try {
      if (isTemplate) {
        const input = {
          ...(current.layout ?? {}),
          name: current.name.trim() || t('cards.defaultName', { number: templates.length + 1 }),
        };
        const saved = stored ? await updateCardTemplate(stored.id, input) : await createCardTemplate(input);
        toast.show({ title: t('cards.saved', { name: saved.name }), variant: 'success' });
        if (stored) setDraft(templateDraft(saved));
        else setTarget({ kind: 'template', id: saved.id });
        return;
      }
      const input = {
        name: current.name.trim() || t('cards.defaultName', { number: 1 }),
        templateId: current.templateId,
        layout: current.templateId === null ? current.layout : null,
        values: current.values,
      };
      const saved = stored ? await updateSavedCard(stored.id, input) : await createSavedCard(input);
      toast.show({ title: t('cards.cardSaved', { name: saved.name }), variant: 'success' });
      if (stored) setDraft(cardDraft(saved));
      else setTarget({ kind: 'card', id: saved.id });
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    if (!stored) return;
    const name = t('cards.copyName', { name: stored.name });
    const copy = isTemplate
      ? await duplicateCardTemplate(stored.id, name)
      : await duplicateSavedCard(stored.id, name);
    if (copy) setTarget({ kind: current.kind, id: copy.id });
  }

  async function newCard() {
    if (!stored) return;
    const card = await createSavedCard({ name: stored.name, templateId: stored.id });
    setTarget({ kind: 'card', id: card.id });
  }

  async function saveAsTemplate() {
    if (!stored || !current.layout) return;
    const template = await createCardTemplate({ ...current.layout, name: current.name });
    await updateSavedCard(stored.id, { templateId: template.id });
    update((own) => ({ ...own, templateId: template.id, layout: null }));
    toast.show({ title: t('cards.saved', { name: template.name }), variant: 'success' });
  }

  return (
    <div className={styles['designer']}>
      <div className={styles['top']}>
        <Field label={isTemplate ? t('cards.name') : t('cards.cardName')}>
          <Input
            size="sm"
            value={current.name}
            maxLength={80}
            onChange={(event) => {
              const name = event.target.value;
              update((own) => ({ ...own, name }));
            }}
          />
        </Field>
        {isTemplate ? null : (
          <Field label={t('cards.template')}>
            <Select
              size="sm"
              value={current.templateId ?? NO_TEMPLATE}
              aria-label={t('cards.template')}
              options={[
                { value: NO_TEMPLATE, label: t('cards.noTemplate') },
                ...templates.map((template) => ({ value: template.id, label: template.name })),
              ]}
              onValueChange={chooseTemplate}
            />
          </Field>
        )}
        <span className={styles['spacer']} />
        {dirty ? <span className={styles['unsaved']}>{t('cards.unsaved')}</span> : null}
      </div>
      {current.layout ? (
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
            {current.layout.fields.length === 0 ? (
              <p className={styles['muted']}>{t('cards.emptyHint')}</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder}>
                <SortableContext
                  items={current.layout.fields.map((field) => field.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className={styles['fieldList']}>
                    {current.layout.fields.map((field, index, fields) => (
                      <FieldRow
                        key={field.id}
                        field={field}
                        selected={field.id === selectedFieldId}
                        onSelect={() => {
                          setSelectedFieldId(field.id);
                        }}
                        onDuplicate={() => {
                          const copy = { ...structuredClone(field), id: newField(field.kind, '', fields).id };
                          patchLayout({
                            fields: [...fields.slice(0, index + 1), copy, ...fields.slice(index + 1)],
                          });
                          setSelectedFieldId(copy.id);
                        }}
                        onRemove={() => {
                          patchLayout({ fields: fields.filter((item) => item.id !== field.id) });
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
              layout={current.layout}
              values={values}
              selectedFieldId={selectedFieldId}
              onValue={setValue}
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
              <CardSettings draft={{ ...current.layout, name: current.name }} onChange={patchLayout} />
            )}
          </aside>
        </div>
      ) : layout ? (
        <div className={styles['valuesLayout']}>
          <section className={styles['stage']} aria-label={t('cards.preview')}>
            <CardPreview layout={layout} values={values} selectedFieldId={null} onValue={setValue} />
          </section>
          <aside className={styles['settings']} aria-label={t('cards.cardSettings')}>
            <p className={styles['muted']}>{t('cards.usesTemplate')}</p>
            <Button
              size="sm"
              icon={<LayoutTemplate aria-hidden="true" />}
              disabled={dirty}
              onClick={() => {
                if (current.templateId) setTarget({ kind: 'template', id: current.templateId });
              }}
            >
              {t('cards.editTemplate')}
            </Button>
          </aside>
        </div>
      ) : (
        <p className={styles['muted']}>{t('cards.missingTarget')}</p>
      )}
      <div className={styles['footer']}>
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
              {isTemplate ? t('cards.delete') : t('cards.deleteCard')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Copy aria-hidden="true" />}
              onClick={() => void duplicate()}
            >
              {isTemplate ? t('cards.duplicate') : t('cards.duplicateCard')}
            </Button>
            {isTemplate ? (
              <Button
                size="sm"
                variant="ghost"
                icon={<IdCard aria-hidden="true" />}
                onClick={() => void newCard()}
              >
                {t('cards.newCardFrom')}
              </Button>
            ) : current.templateId === null ? (
              <Button
                size="sm"
                variant="ghost"
                icon={<LayoutTemplate aria-hidden="true" />}
                onClick={() => void saveAsTemplate()}
              >
                {t('cards.saveAsTemplate')}
              </Button>
            ) : null}
          </>
        ) : null}
        <span className={styles['spacer']} />
        {dirty ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(initial);
              setSelectedFieldId(null);
            }}
          >
            {t('cards.discard')}
          </Button>
        ) : null}
        <Button size="sm" variant="primary" disabled={busy} onClick={() => void save()}>
          {isTemplate ? t('cards.save') : t('cards.saveCard')}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={isTemplate ? t('cards.delete') : t('cards.deleteCard')}
        description={
          isTemplate
            ? t('cards.deleteConfirm', { name: stored?.name ?? '' })
            : t('cards.deleteCardConfirm', { name: stored?.name ?? '' })
        }
        confirmLabel={tc('actions.delete')}
        cancelLabel={tc('actions.cancel')}
        closeLabel={tc('actions.close')}
        destructive
        onConfirm={async () => {
          if (!stored) return;
          if (isTemplate) await deleteCardTemplate(stored.id);
          else await deleteSavedCard(stored.id);
          setTarget(null);
        }}
      />
    </div>
  );
}

function readItem(state: Record<string, unknown>): { id: string; boardId: string } | null {
  const raw = state['target'];
  if (typeof raw !== 'object' || raw === null) return null;
  const { kind, id, boardId } = raw as Record<string, unknown>;
  return kind === 'item' && typeof id === 'string' && typeof boardId === 'string' ? { id, boardId } : null;
}

export function CardDesigner({ state, setState }: EditorProps) {
  const item = readItem(state);
  if (item) {
    return (
      <BoardCardDesigner
        boardId={item.boardId}
        nodeId={item.id}
        onOpenTemplate={(templateId) => {
          setState({ target: templateId ? { kind: 'template', id: templateId } : null });
        }}
        onSavedCard={(cardId) => {
          setState({ target: { kind: 'card', id: cardId } });
        }}
      />
    );
  }
  return <TemplateOrCardDesigner state={state} setState={setState} />;
}

function TemplateOrCardDesigner({ state, setState }: Pick<EditorProps, 'state' | 'setState'>) {
  const templates = useCardTemplates();
  const cards = useSavedCards();
  const target = readTarget(state);
  const stored =
    target?.kind === 'template'
      ? (templates?.find((item) => item.id === target.id) ?? null)
      : target?.kind === 'card'
        ? (cards?.find((item) => item.id === target.id) ?? null)
        : null;
  const initial = stored ? ('fields' in stored ? templateDraft(stored) : cardDraft(stored)) : null;
  const loaded = templates !== null && cards !== null;
  const key = [target?.kind ?? 'new', target?.id ?? '', loaded, stored !== null].join(':');
  return (
    <Designer
      key={key}
      target={target}
      stored={stored}
      initial={initial}
      setTarget={(next) => {
        setState({ target: next });
      }}
    />
  );
}
