import { useState, type ComponentType, type ReactNode } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
} from 'lucide-react';
import {
  FONT_WEIGHTS,
  IMAGE_FITS,
  ITEM_SHAPES,
  MIN_ITEM_SIZE,
  STROKE_STYLES,
  TEXT_ALIGNS,
  VERTICAL_ALIGNS,
  type Board,
  type BoardNode,
  type BoardNodeType,
  type ItemStyle,
} from '@shared/board';
import type { ColourValue } from '@shared/colours';
import { useAssetsSnapshot } from '@renderer/lib/assets';
import {
  commitChanges,
  fromUnits,
  itemData,
  resolveItemStyle,
  toUnits,
  useLiveNode,
  withData,
} from '@renderer/lib/board';
import { useCardTemplate, useCardTemplates } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, Field, Input, Select, Switch, TextArea, ToggleGroup } from '@renderer/ui';
import { CardView } from '../Board/cards/CardView';
import { TemplateEditorDialog } from '../Board/cards/TemplateEditorDialog';
import { ProjectColourPicker } from '../../ProjectColourPicker/ProjectColourPicker';
import { NumberField } from './NumberField';
import styles from './PropertiesEditor.module.scss';

const ALIGN_ICONS: Record<NonNullable<ItemStyle['align']>, ReactNode> = {
  left: <AlignLeft aria-hidden="true" />,
  center: <AlignCenter aria-hidden="true" />,
  right: <AlignRight aria-hidden="true" />,
};

const VERTICAL_ALIGN_ICONS: Record<NonNullable<ItemStyle['verticalAlign']>, ReactNode> = {
  top: <AlignVerticalJustifyStart aria-hidden="true" />,
  middle: <AlignVerticalJustifyCenter aria-hidden="true" />,
  bottom: <AlignVerticalJustifyEnd aria-hidden="true" />,
};

const NONE = '__none';

function save(node: BoardNode) {
  void commitChanges(node.boardId, { upsertNodes: [node] });
}

function setStyle(node: BoardNode, key: keyof ItemStyle, value: ItemStyle[keyof ItemStyle] | undefined) {
  const rest = Object.entries((node.data['style'] ?? {}) as ItemStyle).filter(([name]) => name !== key);
  const style = Object.fromEntries(value === undefined ? rest : [...rest, [key, value]]);
  save(withData(node, { style }));
}

function TransformSection({ board, node: stored }: { board: Board; node: BoardNode }) {
  const { t } = useTranslation('editors');
  const node = useLiveNode(stored);
  const patch = (changes: Partial<Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>>) => {
    save({ ...node, ...changes });
  };
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
          min={toUnits(MIN_ITEM_SIZE.width, board)}
          onCommit={(value) => {
            patch({ width: fromUnits(value, board) });
          }}
        />
        <NumberField
          label={label('height')}
          value={toUnits(node.height, board)}
          min={toUnits(MIN_ITEM_SIZE.height, board)}
          onCommit={(value) => {
            patch({ height: fromUnits(value, board) });
          }}
        />
      </div>
    </>
  );
}

interface ColourFieldProps {
  label: string;
  value: ColourValue | null | undefined;
  fallback: string;
  onChange: (value: ColourValue | null | undefined) => void;
}

function ColourField({ label, value, fallback, onChange }: ColourFieldProps) {
  const { t } = useTranslation('editors');
  return (
    <div className={styles['swatchRow']}>
      <ProjectColourPicker
        size="sm"
        value={value ?? { hex: fallback, ref: null }}
        label={label}
        onChange={onChange}
      />
      <span>{label}</span>
      {value !== undefined ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onChange(undefined);
          }}
        >
          {t('properties.resetFill')}
        </Button>
      ) : null}
      {value !== null ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onChange(null);
          }}
        >
          {t('properties.none')}
        </Button>
      ) : null}
    </div>
  );
}

function ItemSection({ node }: { node: BoardNode }) {
  const { t } = useTranslation('editors');
  const data = itemData(node);
  const [name, setName] = useState<string | null>(null);
  return (
    <>
      <Field label={t('properties.itemName')}>
        <Input
          size="sm"
          value={name ?? data.name}
          maxLength={80}
          onChange={(event) => {
            setName(event.target.value);
          }}
          onBlur={() => {
            if (name !== null && name !== data.name) save(withData(node, { name }));
            setName(null);
          }}
        />
      </Field>
      <Switch
        size="sm"
        label={t('properties.locked')}
        checked={data.locked}
        onCheckedChange={(locked) => {
          save(withData(node, { locked }));
        }}
      />
    </>
  );
}

function StyleSection({ node, layers = [] }: { node: BoardNode; layers?: (ItemStyle | undefined)[] }) {
  const { t } = useTranslation('editors');
  const own = (node.data['style'] ?? {}) as ItemStyle;
  const style = resolveItemStyle(node.type, ...layers, own);
  const set = <K extends keyof ItemStyle>(key: K, value: ItemStyle[K] | undefined) => {
    setStyle(node, key, value);
  };
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  return (
    <>
      <h3 className={styles['heading']}>{t('properties.style')}</h3>
      <Field label={t('properties.shape')}>
        <Select
          size="sm"
          value={style.shape}
          aria-label={t('properties.shape')}
          options={ITEM_SHAPES.map((shape) => ({ value: shape, label: t(`properties.shapes.${shape}`) }))}
          onValueChange={(value) => {
            set('shape', value as ItemStyle['shape']);
          }}
        />
      </Field>
      <ColourField
        label={t('properties.fill')}
        value={own.fill}
        fallback="#ffffff"
        onChange={(value) => {
          set('fill', value);
        }}
      />
      <ColourField
        label={t('properties.stroke')}
        value={own.stroke}
        fallback="#334155"
        onChange={(value) => {
          set('stroke', value);
        }}
      />
      <div className={styles['pair']}>
        <NumberField
          label={t('properties.strokeWidth')}
          value={style.strokeWidth}
          min={0}
          step={1}
          digits={1}
          onCommit={(value) => {
            set('strokeWidth', clamp(value, 0, 32));
          }}
        />
        <Field label={t('properties.strokeStyle')}>
          <Select
            size="sm"
            value={style.strokeStyle}
            aria-label={t('properties.strokeStyle')}
            options={STROKE_STYLES.map((value) => ({ value, label: t(`properties.strokeStyles.${value}`) }))}
            onValueChange={(value) => {
              set('strokeStyle', value as ItemStyle['strokeStyle']);
            }}
          />
        </Field>
      </div>
      <div className={styles['pair']}>
        <NumberField
          label={t('properties.radius')}
          value={style.radius}
          min={0}
          step={1}
          digits={0}
          onCommit={(value) => {
            set('radius', clamp(value, 0, 400));
          }}
        />
        <NumberField
          label={t('properties.padding')}
          value={style.padding}
          min={0}
          step={1}
          digits={0}
          onCommit={(value) => {
            set('padding', clamp(value, 0, 200));
          }}
        />
      </div>
      <NumberField
        label={`${t('properties.opacity')} (%)`}
        value={Math.round(style.opacity * 100)}
        min={0}
        step={5}
        digits={0}
        onCommit={(value) => {
          set('opacity', clamp(value, 0, 100) / 100);
        }}
      />
      <Switch
        size="sm"
        label={t('properties.shadow')}
        checked={style.shadow}
        onCheckedChange={(value) => {
          set('shadow', value);
        }}
      />
      {node.type !== 'image' ? (
        <>
          <h3 className={styles['heading']}>{t('properties.typography')}</h3>
          <ColourField
            label={t('properties.textColour')}
            value={own.textColour}
            fallback="#1a1a1a"
            onChange={(value) => {
              set('textColour', value);
            }}
          />
          <div className={styles['pair']}>
            <NumberField
              label={t('properties.fontSize')}
              value={style.fontSize}
              min={6}
              step={1}
              digits={0}
              onCommit={(value) => {
                set('fontSize', clamp(value, 6, 400));
              }}
            />
            <Field label={t('properties.fontWeight')}>
              <Select
                size="sm"
                value={style.fontWeight}
                aria-label={t('properties.fontWeight')}
                options={FONT_WEIGHTS.map((value) => ({ value, label: t(`properties.weights.${value}`) }))}
                onValueChange={(value) => {
                  set('fontWeight', value as ItemStyle['fontWeight']);
                }}
              />
            </Field>
          </div>
          <div className={styles['pair']}>
            <Field label={t('properties.align')}>
              <ToggleGroup
                size="sm"
                iconsOnly
                value={style.align}
                aria-label={t('properties.align')}
                items={TEXT_ALIGNS.map((value) => ({
                  value,
                  label: t(`properties.aligns.${value}`),
                  icon: ALIGN_ICONS[value],
                }))}
                onValueChange={(value) => {
                  set('align', value as ItemStyle['align']);
                }}
              />
            </Field>
            <Field label={t('properties.verticalAlign')}>
              <ToggleGroup
                size="sm"
                iconsOnly
                value={style.verticalAlign}
                aria-label={t('properties.verticalAlign')}
                items={VERTICAL_ALIGNS.map((value) => ({
                  value,
                  label: t(`properties.verticalAligns.${value}`),
                  icon: VERTICAL_ALIGN_ICONS[value],
                }))}
                onValueChange={(value) => {
                  set('verticalAlign', value as ItemStyle['verticalAlign']);
                }}
              />
            </Field>
          </div>
        </>
      ) : null}
    </>
  );
}

function TextSection({ node }: { node: BoardNode }) {
  const { t } = useTranslation('editors');
  const { text } = itemData({ type: 'text', data: node.data });
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Field label={t('properties.content')}>
      <TextArea
        rows={4}
        value={draft ?? text}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          if (draft !== null && draft !== text) save(withData(node, { text: draft }));
          setDraft(null);
        }}
      />
    </Field>
  );
}

function ImageSection({ node }: { node: BoardNode }) {
  const { t } = useTranslation('editors');
  const data = itemData({ type: 'image', data: node.data });
  const images = useAssetsSnapshot().assets.filter((asset) => asset.kind === 'image');
  const [alt, setAlt] = useState<string | null>(null);
  return (
    <>
      <Field label={t('properties.chooseImage')}>
        <Select
          size="sm"
          value={data.assetId ?? NONE}
          aria-label={t('properties.chooseImage')}
          options={[
            { value: NONE, label: t('board.imageMissing') },
            ...images.map((asset) => ({ value: asset.id, label: asset.name })),
          ]}
          onValueChange={(value) => {
            save(withData(node, { assetId: value === NONE ? null : value }));
          }}
        />
      </Field>
      <Field label={t('properties.fit')}>
        <Select
          size="sm"
          value={data.fit}
          aria-label={t('properties.fit')}
          options={IMAGE_FITS.map((fit) => ({ value: fit, label: t(`properties.fits.${fit}`) }))}
          onValueChange={(value) => {
            save(withData(node, { fit: value }));
          }}
        />
      </Field>
      <Field label={t('properties.alt')}>
        <Input
          size="sm"
          value={alt ?? data.alt}
          maxLength={200}
          onChange={(event) => {
            setAlt(event.target.value);
          }}
          onBlur={() => {
            if (alt !== null && alt !== data.alt) save(withData(node, { alt }));
            setAlt(null);
          }}
        />
      </Field>
    </>
  );
}

function ContainerSection({ node }: { node: BoardNode }) {
  const { t } = useTranslation('editors');
  const data = itemData({ type: 'container', data: node.data });
  const [title, setTitle] = useState<string | null>(null);
  return (
    <>
      <Field label={t('properties.title')}>
        <Input
          size="sm"
          value={title ?? data.title}
          maxLength={80}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          onBlur={() => {
            if (title !== null && title !== data.title) save(withData(node, { title }));
            setTitle(null);
          }}
        />
      </Field>
      <Switch
        size="sm"
        label={t('properties.showTitle')}
        checked={data.showTitle}
        onCheckedChange={(showTitle) => {
          save(withData(node, { showTitle }));
        }}
      />
    </>
  );
}

function CardSection({ node }: { node: BoardNode }) {
  const { t } = useTranslation('editors');
  const data = itemData({ type: 'card', data: node.data });
  const templates = useCardTemplates() ?? [];
  const template = useCardTemplate(data.templateId);
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  return (
    <>
      <Field label={t('properties.template')}>
        <Select
          size="sm"
          value={data.templateId ?? NONE}
          aria-label={t('properties.template')}
          options={[
            { value: NONE, label: t('board.chooseTemplate') },
            ...templates.map((item) => ({ value: item.id, label: item.name })),
          ]}
          onValueChange={(value) => {
            save(withData(node, { templateId: value === NONE ? null : value }));
          }}
        />
      </Field>
      <Button
        size="sm"
        onClick={() => {
          setEditing({ id: data.templateId });
        }}
      >
        {t('properties.editTemplate')}
      </Button>
      {template ? (
        <>
          <h3 className={styles['heading']}>{t('properties.values')}</h3>
          <CardView
            layout={template}
            values={data.values}
            editable
            onChange={(fieldId, value) => {
              save(withData(node, { values: { ...data.values, [fieldId]: value } }));
            }}
          />
        </>
      ) : null}
      {editing ? (
        <TemplateEditorDialog
          open
          templateId={editing.id}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onSaved={(saved) => {
            if (!data.templateId) save(withData(node, { templateId: saved.id }));
          }}
        />
      ) : null}
    </>
  );
}

const TYPE_SECTIONS: Record<BoardNodeType, ComponentType<{ node: BoardNode }>> = {
  text: TextSection,
  image: ImageSection,
  container: ContainerSection,
  card: CardSection,
};

function CardStyleSection({ node }: { node: BoardNode }) {
  const template = useCardTemplate(itemData({ type: 'card', data: node.data }).templateId);
  return <StyleSection node={node} layers={[template?.style]} />;
}

export function NodeProperties({ board, node }: { board: Board; node: BoardNode }) {
  const { t } = useTranslation('editors');
  const TypeSection = TYPE_SECTIONS[node.type];
  return (
    <section className={styles['section']} aria-label={t(`properties.${node.type}`)}>
      <h3 className={styles['heading']}>{t(`properties.${node.type}`)}</h3>
      <ItemSection node={node} />
      <TypeSection node={node} />
      <TransformSection board={board} node={node} />
      {node.type === 'card' ? <CardStyleSection node={node} /> : <StyleSection node={node} />}
    </section>
  );
}
