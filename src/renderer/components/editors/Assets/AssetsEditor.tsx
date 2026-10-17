import { useRef, useState, type DragEvent } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  FolderPlus,
  FolderTree as FolderTreeIcon,
  LayoutGrid,
  List,
  PanelRight,
  Settings2,
  Shapes,
  Upload,
} from 'lucide-react';
import { ASSET_KINDS, assetKindOf, type Asset, type AssetKind, type AssetTarget } from '@shared/assets';
import type { EditorProps } from '@renderer/lib/editors';
import {
  assetActions,
  assetsInFolder,
  assetsOfKind,
  folderActions,
  folderCounts,
  importFiles,
  kindCounts,
  matchesAssetSearch,
  pickFiles,
  reportAssetDrag,
  useAssetsLoaded,
  useAssetsSnapshot,
} from '@renderer/lib/assets';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, IconButton, Input, ScrollArea, Spinner, ToggleGroup, cx } from '@renderer/ui';
import { AreaHeaderContent } from '../../Shell/AreaHeaderContent';
import { PromptDialog } from '../../Shell/PromptDialog';
import { AssetDetails } from './AssetDetails';
import { AssetGrid, AssetThumbnail, type SelectModifiers } from './AssetGrid';
import { AssetOptionsDialog } from './AssetOptionsDialog';
import { FolderTree } from './FolderTree';
import { KindList } from './KindList';
import {
  hasFiles,
  readBoolean,
  readFolderId,
  readString,
  type AssetDragData,
  type FolderDropData,
} from './kinds';
import gridStyles from './AssetGrid.module.scss';
import styles from './AssetsEditor.module.scss';

type View = 'folders' | 'types';
type Layout = 'grid' | 'list';

function isKind(value: string): value is AssetKind {
  return (ASSET_KINDS as readonly string[]).includes(value);
}

function dragDataOf(item: { data: { current?: unknown } } | null | undefined): AssetDragData | null {
  const current = item?.data.current;
  return typeof current === 'object' && current !== null && (current as { type?: string }).type === 'asset'
    ? (current as AssetDragData)
    : null;
}

function dropDataOf(item: { data: { current?: unknown } } | null | undefined): FolderDropData | null {
  const current = item?.data.current;
  return typeof current === 'object' && current !== null && (current as { type?: string }).type === 'folder'
    ? (current as FolderDropData)
    : null;
}

export function AssetsEditor({ state, setState }: EditorProps) {
  const { t } = useTranslation('assets');
  const loaded = useAssetsLoaded();
  const { folders, assets, settings } = useAssetsSnapshot();
  const [dialog, setDialog] = useState<'folder' | 'options' | null>(null);
  const [dropping, setDropping] = useState(false);
  const [dragging, setDragging] = useState<string[] | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const dragDepth = useRef(0);

  const view: View = readString(state, 'view', 'folders') === 'types' ? 'types' : 'folders';
  const layout: Layout = readString(state, 'layout', 'grid') === 'list' ? 'list' : 'grid';
  const search = readString(state, 'search', '');
  const folderId = readFolderId(state, folders);
  const kindValue = readString(state, 'kind', 'image');
  const kind: AssetKind = isKind(kindValue) ? kindValue : 'image';
  const selectedId = readString(state, 'selectedId', '');
  const details = readBoolean(state, 'details', true);

  const byName = (a: Asset, b: Asset) => a.name.localeCompare(b.name);
  const visible = (
    view === 'types'
      ? assetsOfKind(assets, kind, search)
      : folderId === null
        ? assets.filter((asset) => matchesAssetSearch(asset, search))
        : assetsInFolder(assets, folderId, search)
  ).sort(byName);
  const existing = new Set(assets.map((asset) => asset.id));
  const selectedIds = new Set(
    (selection.length > 0 ? selection : [selectedId]).filter((id) => existing.has(id)),
  );
  const selectedAsset = assets.find((asset) => asset.id === selectedId) ?? null;
  const counts = folderCounts(folders, assets);
  const selectedFolder = folders.find((folder) => folder.id === folderId);
  const importTarget = view === 'types' ? 'auto' : folderId;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  function select(id: string, modifiers: SelectModifiers) {
    if (modifiers.shift && selectedId) {
      const ids = visible.map((asset) => asset.id);
      const from = ids.indexOf(selectedId);
      const to = ids.indexOf(id);
      if (from >= 0 && to >= 0) {
        setSelection(ids.slice(Math.min(from, to), Math.max(from, to) + 1));
        return;
      }
    }
    if (modifiers.ctrl) {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelection(Array.from(next));
      if (next.has(id) || !next.has(selectedId))
        setState({ selectedId: next.has(id) ? id : (Array.from(next)[0] ?? '') });
      return;
    }
    setSelection([id]);
    setState({ selectedId: id });
  }

  function imported(ids: string[], firstName?: string) {
    const first = ids[0];
    if (!first) return;
    setSelection([first]);
    const patch: Record<string, unknown> = { selectedId: first };
    if (view === 'types' && firstName) patch['kind'] = assetKindOf(firstName);
    setState(patch);
  }

  function importDropped(files: FileList, target: AssetTarget) {
    const first = files[0];
    void importFiles(Array.from(files), target).then((result) => {
      imported(result.ids, first?.name);
    });
  }

  function onDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!hasFiles(event.dataTransfer)) return;
    dragDepth.current += 1;
    setDropping(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!hasFiles(event.dataTransfer)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDropping(false);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (hasFiles(event.dataTransfer)) event.preventDefault();
  }

  function resetDrop() {
    dragDepth.current = 0;
    setDropping(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    if (event.dataTransfer.files.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    importDropped(event.dataTransfer.files, importTarget);
  }

  function onDragStart({ active }: DragStartEvent) {
    setDragging(dragDataOf(active)?.ids ?? null);
  }

  function pointerOf({ activatorEvent, delta }: DragMoveEvent | DragEndEvent): { x: number; y: number } {
    const start = activatorEvent as Partial<PointerEvent>;
    return { x: (start.clientX ?? Number.NaN) + delta.x, y: (start.clientY ?? Number.NaN) + delta.y };
  }

  function onDragMove(event: DragMoveEvent) {
    const ids = dragDataOf(event.active)?.ids;
    if (!ids) return;
    const { x, y } = pointerOf(event);
    reportAssetDrag(ids, x, y, 'move');
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDragging(null);
    const data = dragDataOf(active);
    if (data) {
      const { x, y } = pointerOf(event);
      if (reportAssetDrag(data.ids, x, y, 'drop')) return;
    }
    const target = dropDataOf(over);
    if (!data || !target) return;
    const ids = data.ids.filter((id) => assets.find((asset) => asset.id === id)?.folderId !== target.id);
    if (ids.length > 0) void assetActions.move(ids, target.id);
  }

  const draggingAssets = (dragging ?? []).flatMap((id) => assets.filter((asset) => asset.id === id));
  const dropLabel =
    view === 'types' ? t('drop.auto') : t('drop.into', { name: selectedFolder?.name ?? t('allFiles') });

  return (
    <div
      className={cx(styles['editor'], dropping && styles['dropping'])}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDropCapture={resetDrop}
      onDrop={onDrop}
    >
      <AreaHeaderContent>
        <ToggleGroup
          size="sm"
          aria-label={t('view.label')}
          value={view}
          onValueChange={(next) => {
            setState({ view: next });
          }}
          items={[
            { value: 'folders', label: t('view.folders'), icon: <FolderTreeIcon aria-hidden="true" /> },
            { value: 'types', label: t('view.types'), icon: <Shapes aria-hidden="true" /> },
          ]}
        />
        <Input
          size="sm"
          type="search"
          value={search}
          aria-label={t('search')}
          placeholder={t('search')}
          className={styles['search']}
          onChange={(event) => {
            setState({ search: event.target.value });
          }}
        />
        <ToggleGroup
          size="sm"
          iconsOnly
          aria-label={t('layout.label')}
          value={layout}
          onValueChange={(next) => {
            setState({ layout: next });
          }}
          items={[
            { value: 'grid', label: t('layout.grid'), icon: <LayoutGrid aria-hidden="true" /> },
            { value: 'list', label: t('layout.list'), icon: <List aria-hidden="true" /> },
          ]}
        />
        <Button
          size="sm"
          variant="primary"
          icon={<Upload aria-hidden="true" />}
          disabled={!loaded}
          onClick={() =>
            void pickFiles(importTarget).then((ids) => {
              imported(ids);
            })
          }
        >
          {t('import')}
        </Button>
        <Button
          size="sm"
          icon={<FolderPlus aria-hidden="true" />}
          disabled={!loaded}
          onClick={() => {
            setDialog('folder');
          }}
        >
          {t('newFolder')}
        </Button>
        <IconButton
          label={t('options')}
          size="sm"
          disabled={!loaded}
          onClick={() => {
            setDialog('options');
          }}
        >
          <Settings2 aria-hidden="true" />
        </IconButton>
        <IconButton
          label={t('details')}
          size="sm"
          active={details}
          onClick={() => {
            setState({ details: !details });
          }}
        >
          <PanelRight aria-hidden="true" />
        </IconButton>
      </AreaHeaderContent>
      {!loaded ? (
        <div className={styles['loading']}>
          <Spinner label={t('loading')} />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setDragging(null);
            reportAssetDrag([], Number.NaN, Number.NaN, 'cancel');
          }}
        >
          <div className={styles['body']}>
            <ScrollArea className={styles['sidebar']}>
              {view === 'folders' ? (
                <FolderTree
                  folders={folders}
                  counts={counts}
                  total={assets.length}
                  selectedId={folderId}
                  onSelect={(id) => {
                    setState({ folderId: id ?? '' });
                  }}
                  onImport={importDropped}
                />
              ) : (
                <KindList
                  counts={kindCounts(assets)}
                  selected={kind}
                  onSelect={(next) => {
                    setState({ kind: next });
                  }}
                  onImport={(files) => {
                    importDropped(files, 'auto');
                  }}
                />
              )}
            </ScrollArea>
            <ScrollArea className={styles['main']} viewportClassName={styles['mainViewport']}>
              <AssetGrid
                assets={visible}
                folders={folders}
                selectedIds={selectedIds}
                layout={layout}
                showPath={view === 'types' || folderId === null}
                searching={search.trim().length > 0}
                onSelect={select}
                onOpen={(id) => {
                  setSelection([id]);
                  setState({ selectedId: id, details: true });
                }}
              />
            </ScrollArea>
            {details ? (
              <div className={styles['details']}>
                <AssetDetails asset={selectedAsset} folders={folders} />
              </div>
            ) : null}
          </div>
          <DragOverlay dropAnimation={null}>
            {draggingAssets[0] ? (
              <div className={gridStyles['ghost']}>
                <AssetThumbnail asset={draggingAssets[0]} />
                <span>
                  {draggingAssets.length > 1
                    ? t('asset.dragging', { count: draggingAssets.length })
                    : draggingAssets[0].name}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
      {dropping ? (
        <div className={styles['dropHint']} aria-hidden="true">
          <Upload />
          <span>{dropLabel}</span>
        </div>
      ) : null}
      {dialog === 'folder' ? (
        <PromptDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          title={t('newFolder')}
          label={t('folderName')}
          submitLabel={t('newFolder')}
          onSubmit={(name) =>
            folderActions
              .create({ name, parentId: view === 'folders' ? folderId : null })
              .then(() => undefined)
          }
        />
      ) : null}
      <AssetOptionsDialog
        open={dialog === 'options'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        folders={folders}
        settings={settings}
      />
    </div>
  );
}
