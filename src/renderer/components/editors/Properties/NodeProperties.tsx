import { useState, type ComponentType } from 'react';
import {
  IMAGE_FITS,
  MIN_ITEM_SIZE,
  boardLinkSchema,
  type BoardLink,
  type Board,
  type BoardNode,
  type BoardNodeType,
  type ItemStyle,
} from '@shared/board';
import { useAssetsSnapshot } from '@renderer/lib/assets';
import {
  ITEM_KINDS,
  commitChanges,
  dockCluster,
  fromUnits,
  itemData,
  normaliseAngle,
  resizeTable,
  resolveItemStyle,
  rotateCluster,
  rotationOf,
  tableSize,
  toUnits,
  undock,
  useBoardTiles,
  useBoards,
  useLiveNode,
  withData,
} from '@renderer/lib/board';
import {
  createSavedCard,
  updateSavedCard,
  useBoardCard,
  useCardTemplate,
  useCardTemplates,
  useSavedCards,
} from '@renderer/lib/cards';
import { useNotes } from '@renderer/lib/notes';
import { usePalettes } from '@renderer/lib/palettes';
import { cardTarget, openInEditor, useWorkspaceNames } from '@renderer/lib/workspaces';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, Field, Input, PropertySection, Select, Switch, TextArea } from '@renderer/ui';
import { GAME_ICON_NAMES } from '../../GameIcon/GameIcon';
import { CardView } from '../Cards/CardView';
import { ArrangeSection } from './ArrangeSection';
import { NumberField } from './NumberField';
import { AppearanceSection, TypographySection, styleTarget } from './StyleSections';
import styles from './PropertiesEditor.module.scss';

const NONE = '__none';

function save(node: BoardNode) {
  void commitChanges(node.boardId, { upsertNodes: [node] });
}

function setStyle(node: BoardNode, key: keyof ItemStyle, value: ItemStyle[keyof ItemStyle] | undefined) {
  const rest = Object.entries((node.data['style'] ?? {}) as ItemStyle).filter(([name]) => name !== key);
  const style = Object.fromEntries(value === undefined ? rest : [...rest, [key, value]]);
  save(withData(node, { style }));
}

function TransformSection({
  board,
  node: stored,
  nodes,
}: {
  board: Board;
  node: BoardNode;
  nodes: BoardNode[];
}) {
  const { t } = useTranslation('editors');
  const node = useLiveNode(stored);
  const docked = typeof node.data['dock'] === 'string';
  const kind = ITEM_KINDS[node.type];
  const fixed = docked || !kind.resizable;
  const patch = (changes: Partial<Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>>) => {
    save({ ...node, ...changes });
  };
  const label = (key: 'x' | 'y' | 'width' | 'height') => `${t(`properties.${key}`)} (${board.unit})`;

  return (
    <>
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
      <NumberField
        label={t('properties.rotation')}
        disabled={!kind.rotatable}
        value={rotationOf(node.data)}
        step={1}
        digits={1}
        onCommit={(value) => {
          void commitChanges(node.boardId, {
            upsertNodes: rotateCluster(node.id, normaliseAngle(value), nodes),
          });
        }}
      />
      <div className={styles['pair']}>
        <NumberField
          label={label('width')}
          disabled={fixed}
          value={toUnits(node.width, board)}
          min={toUnits(MIN_ITEM_SIZE.width, board)}
          onCommit={(value) => {
            patch({ width: fromUnits(value, board) });
          }}
        />
        <NumberField
          label={label('height')}
          disabled={fixed}
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

function IdentityFields({ node }: { node: BoardNode }) {
  const { t } = useTranslation('editors');
  const data = itemData(node);
  const [name, setName] = useState<string | null>(null);
  return (
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
  );
}

function BehaviourFields({ node, nodes }: { node: BoardNode; nodes: BoardNode[] }) {
  const { t } = useTranslation('editors');
  const data = itemData(node);
  const peers = dockCluster(node.id, nodes).length - 1;
  return (
    <>
      <div className={styles['pair']}>
        <Switch
          size="sm"
          label={t('properties.locked')}
          checked={data.locked}
          onCheckedChange={(locked) => {
            save(withData(node, { locked }));
          }}
        />
        <Switch
          size="sm"
          label={t('properties.visible')}
          checked={!data.hidden}
          onCheckedChange={(visible) => {
            save(withData(node, { hidden: !visible }));
          }}
        />
      </div>
      {peers > 0 ? (
        <div className={styles['docked']}>
          <span>{t('properties.docked', { count: peers })}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void commitChanges(node.boardId, { upsertNodes: undock([node.id], nodes) });
            }}
          >
            {t('properties.detach')}
          </Button>
        </div>
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
  const names = useWorkspaceNames();
  const data = itemData({ type: 'card', data: node.data });
  const templates = useCardTemplates() ?? [];
  const template = useCardTemplate(data.templateId);
  const { card, layout, values } = useBoardCard(data);
  const linked = data.cardId !== null;
  return (
    <>
      {linked ? (
        <>
          <p className={styles['docked']}>
            {card ? t('properties.linkedCard', { name: card.name }) : t('properties.linkedCardMissing')}
          </p>
          {card ? (
            <Button
              size="sm"
              onClick={() => {
                openInEditor(cardTarget({ kind: 'card', id: card.id }, names));
              }}
            >
              {t('properties.openCard')}
            </Button>
          ) : null}
          <Button
            size="sm"
            disabled={card !== null && card.templateId === null}
            onClick={() => {
              save(
                withData(node, {
                  cardId: null,
                  templateId: card ? card.templateId : data.templateId,
                  values: structuredClone(values),
                }),
              );
            }}
          >
            {t('properties.makeCopy')}
          </Button>
        </>
      ) : (
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
              openInEditor(
                cardTarget(data.templateId ? { kind: 'template', id: data.templateId } : null, names),
              );
            }}
          >
            {t('properties.editTemplate')}
          </Button>
          {template ? (
            <Button
              size="sm"
              onClick={() => {
                void createSavedCard({
                  name: data.name || template.name,
                  templateId: template.id,
                  values: structuredClone(data.values),
                }).then((saved) => {
                  save(withData(node, { cardId: saved.id }));
                });
              }}
            >
              {t('properties.saveCardAsset')}
            </Button>
          ) : null}
        </>
      )}
      {layout ? (
        <>
          <h3 className={styles['heading']}>{t('properties.values')}</h3>
          <CardView
            layout={layout}
            values={values}
            editable
            showHidden
            onChange={(fieldId, value) => {
              const next = { ...values, [fieldId]: value };
              if (card) void updateSavedCard(card.id, { values: next });
              save(withData(node, { values: next }));
            }}
          />
        </>
      ) : null}
    </>
  );
}

function FileSection({ node }: { node: BoardNode }) {
  const { t } = useTranslation('editors');
  const data = itemData({ type: 'file', data: node.data });
  const assets = useAssetsSnapshot().assets.filter((asset) => asset.kind !== 'image');
  return (
    <Field label={t('properties.chooseFile')}>
      <Select
        size="sm"
        value={data.assetId ?? NONE}
        aria-label={t('properties.chooseFile')}
        options={[
          { value: NONE, label: t('board.fileMissing') },
          ...assets.map((asset) => ({ value: asset.id, label: asset.name })),
        ]}
        onValueChange={(value) => {
          save(withData(node, { assetId: value === NONE ? null : value }));
        }}
      />
    </Field>
  );
}

function LinkSection({ node }: { node: BoardNode }) {
  const { t } = useTranslation('editors');
  const { target } = itemData({ type: 'link', data: node.data });
  const boards = useBoards() ?? [];
  const palettes = usePalettes() ?? [];
  const value = target ? `${target.kind}:${target.id}` : NONE;
  return (
    <Field label={t('properties.linkTarget')}>
      <Select
        size="sm"
        value={value}
        aria-label={t('properties.linkTarget')}
        options={[
          { value: NONE, label: t('assetLink.missing') },
          ...boards
            .filter((board) => board.id !== node.boardId)
            .map((board) => ({
              value: `board:${board.id}`,
              label: `${t('assetLink.kinds.board')}: ${board.name}`,
            })),
          ...palettes.map((palette) => ({
            value: `palette:${palette.id}`,
            label: `${t('assetLink.kinds.palette')}: ${palette.name}`,
          })),
        ]}
        onValueChange={(next) => {
          const [kind, ...rest] = next.split(':');
          const id = rest.join(':');
          save(
            withData(node, {
              target: next === NONE || (kind !== 'board' && kind !== 'palette') ? null : { kind, id },
            }),
          );
        }}
      />
    </Field>
  );
}

function DrawingSection({ node }: { node: BoardNode }) {
  const { t } = useTranslation('editors');
  const tiles = Object.values(useBoardTiles(node.boardId)).filter((tile) => tile.nodeId === node.id).length;
  const { resolution } = itemData({ type: 'drawing', data: node.data });
  const own = (node.data['style'] ?? {}) as ItemStyle;
  const style = resolveItemStyle('drawing', own);
  return (
    <>
      <NumberField
        label={t('properties.opacity')}
        value={Math.round(style.opacity * 100)}
        min={0}
        max={100}
        step={1}
        digits={0}
        onCommit={(value) => {
          setStyle(node, 'opacity', Math.min(1, Math.max(0, value / 100)));
        }}
      />
      <dl className={styles['facts']}>
        <dt>{t('drawing.resolution')}</dt>
        <dd>{t('drawing.resolutionValue', { value: resolution })}</dd>
        <dt>{t('drawing.tilesLabel')}</dt>
        <dd>{t('drawing.tiles', { count: tiles })}</dd>
      </dl>
    </>
  );
}

function IconSection({ node }: { node: BoardNode }) {
  const { t } = useTranslation('editors');
  const { icon } = itemData({ type: 'icon', data: node.data });
  return (
    <Field label={t('properties.icon')}>
      <Select
        size="sm"
        value={icon}
        aria-label={t('properties.icon')}
        options={GAME_ICON_NAMES.map((name) => ({ value: name, label: t(`icons.${name}`) }))}
        onValueChange={(value) => {
          save(withData(node, { icon: value }));
        }}
      />
    </Field>
  );
}

function ChecklistSection({ node }: { node: BoardNode }) {
  const { t } = useTranslation('editors');
  const data = itemData({ type: 'checklist', data: node.data });
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
        label={t('properties.showProgress')}
        checked={data.showProgress}
        onCheckedChange={(showProgress) => {
          save(withData(node, { showProgress }));
        }}
      />
    </>
  );
}

function TableSection({ node }: { node: BoardNode }) {
  const { t } = useTranslation('editors');
  const data = itemData({ type: 'table', data: node.data });
  const size = tableSize(data.rows);
  return (
    <>
      <div className={styles['pair']}>
        <NumberField
          label={t('properties.rows')}
          value={size.rows}
          min={1}
          step={1}
          digits={0}
          onCommit={(rows) => {
            save(withData(node, { rows: resizeTable(data.rows, rows, size.columns) }));
          }}
        />
        <NumberField
          label={t('properties.columns')}
          value={size.columns}
          min={1}
          step={1}
          digits={0}
          onCommit={(columns) => {
            save(withData(node, { rows: resizeTable(data.rows, size.rows, columns) }));
          }}
        />
      </div>
      <Switch
        size="sm"
        label={t('properties.headerRow')}
        checked={data.header}
        onCheckedChange={(header) => {
          save(withData(node, { header }));
        }}
      />
    </>
  );
}

function EmbedSection({ node }: { node: BoardNode }) {
  const { t } = useTranslation('editors');
  const { target } = itemData({ type: 'embed', data: node.data });
  const boards = useBoards() ?? [];
  const palettes = usePalettes() ?? [];
  const notes = useNotes();
  const cards = useSavedCards() ?? [];
  const option = (kind: BoardLink['kind'], id: string, name: string) => ({
    value: `${kind}:${id}`,
    label: `${t(`assetLink.kinds.${kind}`)}: ${name}`,
  });
  return (
    <Field label={t('properties.embedTarget')}>
      <Select
        size="sm"
        value={target ? `${target.kind}:${target.id}` : NONE}
        aria-label={t('properties.embedTarget')}
        options={[
          { value: NONE, label: t('board.embedEmpty') },
          ...notes.map((note) => option('note', note.id, note.title)),
          ...cards.map((card) => option('card', card.id, card.name)),
          ...palettes.map((palette) => option('palette', palette.id, palette.name)),
          ...boards
            .filter((board) => board.id !== node.boardId)
            .map((board) => option('board', board.id, board.name)),
        ]}
        onValueChange={(next) => {
          const [kind, ...rest] = next.split(':');
          const parsed = boardLinkSchema.safeParse({ kind, id: rest.join(':') });
          save(withData(node, { target: next === NONE || !parsed.success ? null : parsed.data }));
        }}
      />
    </Field>
  );
}

const TYPE_SECTIONS: Record<BoardNodeType, ComponentType<{ node: BoardNode }>> = {
  text: TextSection,
  image: ImageSection,
  container: ContainerSection,
  card: CardSection,
  file: FileSection,
  link: LinkSection,
  drawing: DrawingSection,
  icon: IconSection,
  checklist: ChecklistSection,
  table: TableSection,
  embed: EmbedSection,
};

function useStyleLayers(node: BoardNode): (ItemStyle | undefined)[] {
  const template = useCardTemplate(
    node.type === 'card' ? itemData({ type: 'card', data: node.data }).templateId : null,
  );
  return [template?.style];
}

export interface NodePropertiesProps {
  board: Board;
  node: BoardNode;
  nodes: BoardNode[];
}

export function NodeProperties({ board, node, nodes }: NodePropertiesProps) {
  const { t } = useTranslation('editors');
  const TypeSection = TYPE_SECTIONS[node.type];
  const kind = ITEM_KINDS[node.type];
  const target = styleTarget([node], useStyleLayers(node));
  return (
    <section className={styles['section']} aria-label={t(`properties.${node.type}`)}>
      <h3 className={styles['heading']}>{t(`properties.${node.type}`)}</h3>
      <PropertySection title={t('properties.sections.identity')}>
        <IdentityFields node={node} />
      </PropertySection>
      <PropertySection title={t('properties.sections.content')}>
        <TypeSection node={node} />
      </PropertySection>
      <PropertySection title={t('properties.sections.layout')}>
        <TransformSection board={board} node={node} nodes={nodes} />
        <ArrangeSection boardId={board.id} ids={[node.id]} nodes={nodes} />
      </PropertySection>
      {kind.appearance ? <AppearanceSection target={target} /> : null}
      {kind.text ? <TypographySection target={target} /> : null}
      <PropertySection title={t('properties.sections.behaviour')}>
        <BehaviourFields node={node} nodes={nodes} />
      </PropertySection>
    </section>
  );
}
