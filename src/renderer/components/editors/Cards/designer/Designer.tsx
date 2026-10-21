import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Copy, IdCard, LayoutTemplate, Trash2 } from 'lucide-react';
import type { CardValue } from '@shared/board';
import { cardLayoutSchema, type CardField, type CardTemplate, type SavedCard } from '@shared/cards';
import {
  copyFieldsToClipboard,
  createCardTemplate,
  createSavedCard,
  deleteCardTemplate,
  deleteSavedCard,
  designerKeyAction,
  duplicateCardTemplate,
  duplicateFields,
  duplicateSavedCard,
  fieldClipboard,
  fieldsFromLines,
  moveFieldBy,
  newBlock,
  newField,
  pasteFields,
  placeField,
  removeFields,
  renameFieldId,
  resolveCardLayout,
  sampleValues,
  setDesignerDirty,
  updateCardTemplate,
  updateFields,
  updateSavedCard,
  useCardTemplates,
  useHistory,
  useSavedCards,
  type DesignerAction,
  type FieldPresetId,
} from '@renderer/lib/cards';
import { isEditable, useEditTarget } from '@renderer/lib/commands';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, ConfirmDialog, Field, Input, Select, useToast } from '@renderer/ui';
import { CardPreview } from '../CardPreview';
import type { FieldBlockId } from '../FieldPicker';
import { DesignCanvas } from '../canvas/DesignCanvas';
import { CardSettings, FieldSettings } from '../settings';
import { cardDraft, layoutOf, templateDraft, type Draft, type Target, type TemplateDraft } from './draft';
import { FieldList, type SelectMode } from './FieldList';
import { MultiFieldSettings } from './MultiFieldSettings';
import { StageBar, type DesignerMode } from './StageBar';
import { Starters } from './Starters';
import styles from '../CardDesigner.module.scss';

const NO_TEMPLATE = '__none';
const SPAN_STEP: Partial<Record<DesignerAction, number>> = { narrower: -1, wider: 1 };

export function Designer({
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
  const savedCards = useSavedCards() ?? [];
  const history = useHistory<Draft | null>(initial);
  const [preview, setPreview] = useState<Record<string, CardValue>>({});
  const [source, setSource] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [mode, setMode] = useState<DesignerMode>('design');
  const [showGrid, setShowGrid] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [seed, setSeed] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const draft = history.value;
  const dirty = useMemo(
    () => draft !== null && (!initial || JSON.stringify(draft) !== JSON.stringify(initial)),
    [draft, initial],
  );

  useEffect(() => {
    setDesignerDirty(dirty);
  }, [dirty]);
  useEffect(
    () => () => {
      setDesignerDirty(false);
    },
    [],
  );

  const fields = draft?.layout?.fields ?? [];
  const selected = selection.filter((id) => fields.some((field) => field.id === id));
  const ordered = fields.filter((field) => selected.includes(field.id));
  const editable = (ids: readonly string[]) =>
    fields.filter((field) => ids.includes(field.id) && !field.locked).map((field) => field.id);

  useEditTarget(rootRef, (command, focused) => {
    if (isEditable(focused)) return false;
    if (command === 'undo' || command === 'redo') {
      run(command);
      return true;
    }
    if (!canvasRef.current?.contains(focused) || mode !== 'design') return false;
    run(command === 'delete' ? 'delete' : command);
    return true;
  });

  if (!draft) {
    return (
      <div className={styles['designer']}>
        {target ? <p className={styles['muted']}>{t('cards.missingTarget')}</p> : null}
        <Starters onStart={history.reset} />
      </div>
    );
  }

  const current = draft;
  const isTemplate = current.kind === 'template';
  const layout = resolveCardLayout(current, templates);
  const values = isTemplate ? preview : current.values;
  const designing = mode === 'design' && current.layout !== null;
  const sources = isTemplate && stored ? savedCards.filter((card) => card.templateId === stored.id) : [];
  const usedBy = sources.length;

  function update(next: (draft: Draft) => Draft, key: string | null = null) {
    history.set((value) => (value ? next(value) : value), key);
  }

  function patchLayout(next: Partial<TemplateDraft>) {
    const { name, ...rest } = next;
    update(
      (value) => ({
        ...value,
        ...(name === undefined ? {} : { name }),
        layout: value.layout ? { ...value.layout, ...rest } : value.layout,
      }),
      `layout:${Object.keys(next).join()}`,
    );
  }

  function setFields(next: CardField[], key: string | null = null) {
    update((value) => (value.layout ? { ...value, layout: { ...value.layout, fields: next } } : value), key);
  }

  function replaceField(next: CardField, key: string | null = `field:${next.id}`) {
    setFields(
      fields.map((field) => (field.id === next.id ? next : field)),
      key,
    );
  }

  function selectOnly(ids: string[]) {
    setSelection(ids);
    setAnchor(ids.at(-1) ?? null);
    setRenaming(null);
  }

  function select(id: string, how: SelectMode) {
    if (how === 'only') {
      selectOnly([id]);
      return;
    }
    if (how === 'toggle') {
      setSelection(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
      setAnchor(id);
      return;
    }
    const ids = fields.map((field) => field.id);
    const from = ids.indexOf(anchor ?? id);
    const to = ids.indexOf(id);
    setSelection(ids.slice(Math.min(from, to), Math.max(from, to) + 1));
  }

  function setValue(fieldId: string, value: CardValue) {
    if (isTemplate) setPreview((own) => ({ ...own, [fieldId]: value }));
    else update((own) => ({ ...own, values: { ...own.values, [fieldId]: value } }), `value:${fieldId}`);
  }

  function setAllValues(next: Record<string, CardValue>) {
    if (isTemplate) setPreview(next);
    else update((own) => ({ ...own, values: next }));
  }

  function insert(added: CardField[]) {
    const after = ordered.at(-1)?.id ?? null;
    const result = pasteFields(fields, added, after);
    setFields(result.fields);
    selectOnly(result.ids);
  }

  function addField(preset: FieldPresetId) {
    insert([newField(preset, t(`cards.presets.${preset}`), fields)]);
  }

  function place(preset: FieldPresetId, overId: string) {
    const field = newField(preset, t(`cards.presets.${preset}`), fields);
    setFields(placeField(fields, field, overId));
    selectOnly([field.id]);
  }

  function addBlock(block: FieldBlockId) {
    insert(newBlock(block, fields));
  }

  function addSeveral(text: string, preset: FieldPresetId) {
    const added = fieldsFromLines(text, preset, fields);
    if (added.length > 0) insert(added);
  }

  function duplicate(ids: readonly string[]) {
    const result = duplicateFields(fields, ids);
    setFields(result.fields);
    selectOnly(result.ids);
  }

  function remove(ids: readonly string[]) {
    const removable = editable(ids);
    if (removable.length === 0) return;
    setFields(removeFields(fields, removable));
    selectOnly([]);
  }

  function renameId(oldId: string, wanted: string) {
    if (!current.layout) return;
    const result = renameFieldId(
      { fields: current.layout.fields, accentField: current.layout.accentField },
      oldId,
      wanted,
    );
    if (result.id === oldId) return;
    update((own) => {
      if (!own.layout) return own;
      const { [oldId]: value, ...rest } = own.values;
      return {
        ...own,
        values: value === undefined ? own.values : { ...rest, [result.id]: value },
        layout: { ...own.layout, fields: result.fields, accentField: result.accentField },
      };
    });
    selectOnly([result.id]);
  }

  function step(delta: -1 | 1) {
    if (fields.length === 0) return;
    const at = fields.findIndex((field) => field.id === ordered.at(-1)?.id);
    const next =
      at < 0 ? (delta > 0 ? 0 : fields.length - 1) : Math.min(fields.length - 1, Math.max(0, at + delta));
    const id = fields[next]?.id;
    if (id) selectOnly([id]);
  }

  function run(action: DesignerAction) {
    const only = selected.length === 1 ? fields.find((field) => field.id === selected[0]) : undefined;
    switch (action) {
      case 'undo':
        history.undo();
        return;
      case 'redo':
        history.redo();
        return;
      case 'toggleMode':
        if (current.layout) setMode((own) => (own === 'design' ? 'fill' : 'design'));
        return;
      case 'selectNext':
        step(1);
        return;
      case 'selectPrevious':
        step(-1);
        return;
      case 'moveEarlier':
      case 'moveLater':
        if (only && !only.locked) setFields(moveFieldBy(fields, only.id, action === 'moveEarlier' ? -1 : 1));
        return;
      case 'narrower':
      case 'wider': {
        const delta = SPAN_STEP[action] ?? 0;
        setFields(
          updateFields(fields, editable(selected), (field) => ({
            ...field,
            span: Math.min(12, Math.max(1, field.span + delta)),
          })),
          'span',
        );
        return;
      }
      case 'duplicate':
        duplicate(selected);
        return;
      case 'delete':
        remove(selected);
        return;
      case 'deselect':
        selectOnly([]);
        return;
      case 'selectAll':
        setSelection(fields.map((field) => field.id));
        return;
      case 'copy':
        copyFieldsToClipboard(fields, selected);
        return;
      case 'cut':
        copyFieldsToClipboard(fields, selected);
        remove(selected);
        return;
      case 'paste': {
        const clip = fieldClipboard();
        if (clip) insert(clip);
        return;
      }
      case 'addField':
        setPickerOpen(true);
        return;
      case 'rename':
        if (only) setRenaming(only.id);
        return;
    }
  }

  function onCanvasKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!designing) return;
    const element = event.target as Element;
    if (isEditable(element)) return;
    if (element !== event.currentTarget && !element.matches('[data-field-id]')) return;
    const action = designerKeyAction(event);
    if (!action || action === 'undo' || action === 'redo' || action === 'toggleMode') return;
    event.preventDefault();
    run(action);
  }

  function onRootKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || isEditable(event.target as Element)) return;
    const action = designerKeyAction(event);
    if (action !== 'undo' && action !== 'redo' && action !== 'toggleMode') return;
    event.preventDefault();
    run(action);
  }

  function chooseTemplate(value: string) {
    update((own) => {
      if (value !== NO_TEMPLATE) return { ...own, templateId: value, layout: null };
      const resolved = resolveCardLayout(own, templates);
      return { ...own, templateId: null, layout: resolved ? layoutOf(resolved) : cardLayoutSchema.parse({}) };
    });
    selectOnly([]);
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
        setDesignerDirty(false);
        if (stored) history.reset(templateDraft(saved));
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
      setDesignerDirty(false);
      if (stored) history.reset(cardDraft(saved));
      else setTarget({ kind: 'card', id: saved.id });
    } finally {
      setBusy(false);
    }
  }

  async function duplicateTarget() {
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

  const single = selected.length === 1 ? fields.find((field) => field.id === selected[0]) : undefined;
  const stageBar = (
    <StageBar
      mode={designing ? 'design' : 'fill'}
      canDesign={current.layout !== null}
      canUndo={history.canUndo}
      canRedo={history.canRedo}
      showGrid={showGrid}
      zoom={zoom}
      sources={sources.map((card) => ({ id: card.id, name: card.name }))}
      source={source}
      onMode={setMode}
      onUndo={history.undo}
      onRedo={history.redo}
      onGrid={setShowGrid}
      onZoom={setZoom}
      onSample={() => {
        setAllValues(sampleValues(layout?.fields ?? [], seed));
        setSeed((own) => own + 1);
        setSource(null);
      }}
      onClear={() => {
        setAllValues({});
        setSource(null);
      }}
      onSource={(id) => {
        setSource(id);
        setPreview(structuredClone(sources.find((card) => card.id === id)?.values ?? {}));
      }}
    />
  );

  return (
    <div className={styles['designer']} ref={rootRef} onKeyDown={onRootKey}>
      <div className={styles['top']}>
        <Field label={isTemplate ? t('cards.name') : t('cards.cardName')}>
          <Input
            size="sm"
            value={current.name}
            maxLength={80}
            onChange={(event) => {
              const name = event.target.value;
              update((own) => ({ ...own, name }), 'name');
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
          <FieldList
            fields={fields}
            selected={selected}
            pickerOpen={pickerOpen}
            onPickerOpen={setPickerOpen}
            onSelect={select}
            onFields={(next) => {
              setFields(next);
            }}
            onAdd={addField}
            onAddBlock={addBlock}
            onAddSeveral={addSeveral}
            onDuplicate={(id) => {
              duplicate([id]);
            }}
            onRemove={(id) => {
              remove([id]);
            }}
            onCardSettings={() => {
              selectOnly([]);
            }}
          />
          <section className={styles['stage']} aria-label={t('cards.preview')}>
            {stageBar}
            <DesignCanvas
              layout={current.layout}
              values={values}
              designing={designing}
              showGrid={showGrid}
              zoom={zoom}
              canvasRef={canvasRef}
              actions={{
                selected,
                renaming,
                select: (id, how) => {
                  select(id, how);
                  canvasRef.current?.focus({ preventScroll: true });
                },
                change: (field, key) => {
                  replaceField(field, key ?? null);
                },
                rename: (id, label) => {
                  setRenaming(null);
                  const field = fields.find((item) => item.id === id);
                  if (field && label !== null && label !== field.label) replaceField({ ...field, label });
                  canvasRef.current?.focus({ preventScroll: true });
                },
                startRename: setRenaming,
                addToZone: (zone, preset) => {
                  place(preset, `zone:${zone}`);
                },
                duplicate: (id) => {
                  duplicate([id]);
                },
                remove: (id) => {
                  remove([id]);
                },
              }}
              onValue={setValue}
              onFields={(next) => {
                setFields(next);
              }}
              onAddPreset={(preset, overId) => {
                if (overId === null) addField(preset);
                else place(preset, overId);
              }}
              onCardSize={(size) => {
                patchLayout(size);
              }}
              onFitHeight={(height) => {
                patchLayout({ height });
              }}
              onKeyDown={onCanvasKey}
              onClearSelection={() => {
                selectOnly([]);
              }}
            />
          </section>
          <aside
            className={styles['settings']}
            aria-label={single ? t('cards.fieldSettings') : t('cards.cardSettings')}
          >
            {single ? (
              <FieldSettings
                key={single.id}
                field={single}
                fields={fields}
                onChange={(next) => {
                  replaceField(next);
                }}
                onRenameId={(wanted) => {
                  renameId(single.id, wanted);
                }}
              />
            ) : selected.length > 1 ? (
              <MultiFieldSettings
                fields={ordered}
                onChange={(change) => {
                  setFields(updateFields(fields, selected, change));
                }}
                onDuplicate={() => {
                  duplicate(selected);
                }}
                onRemove={() => {
                  remove(selected);
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
            {stageBar}
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
              onClick={() => void duplicateTarget()}
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
        {usedBy > 0 ? <span className={styles['muted']}>{t('cards.usedBy', { count: usedBy })}</span> : null}
        {dirty ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              history.reset(initial);
              selectOnly([]);
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
          setDesignerDirty(false);
          setTarget(null);
        }}
      />
    </div>
  );
}
