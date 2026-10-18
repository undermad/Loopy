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
  Files,
  FolderPlus,
  FolderTree as FolderTreeIcon,
  LayoutGrid,
  List,
  Palette,
  PanelRight,
  PenTool,
  Settings2,
  Shapes,
  Upload,
} from 'lucide-react';
import { ASSET_KINDS, assetKindOf, type Asset, type AssetScope, type AssetTarget } from '@shared/assets';
import { updateBoard, useBoards } from '@renderer/lib/board';
import { updatePalette, usePalettes } from '@renderer/lib/palettes';
import { openLinked, useWorkspaceNames } from '@renderer/lib/workspaces';
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
import { useSettings } from '@renderer/lib/settings';
import { Button, IconButton, Input, ScrollArea, Spinner, ToggleGroup, cx } from '@renderer/ui';
import { AreaHeaderContent } from '../../Shell/AreaHeaderContent';
import { PromptDialog } from '../../Shell/PromptDialog';
import { AssetDetails } from './AssetDetails';
import { AssetGrid, AssetThumbnail, type SelectModifiers } from './AssetGrid';
import { AssetOptionsDialog } from './AssetOptionsDialog';
import { FolderTree } from './FolderTree';
import { InternalDetails } from './InternalDetails';
import { InternalGrid, InternalThumbnail } from './InternalGrid';
import { KindList, type KindChoice } from './KindList';
import {
  INTERNAL_SCOPES,
  hasFiles,
  internalKey,
  readBoolean,
  readFolderId,
  readScope,
  readString,
  type AssetDragData,
  type FolderDropData,
  type InternalDragData,
  type InternalItem,
  type InternalKind,
} from './kinds';
import gridStyles from './AssetGrid.module.scss';
import styles from './AssetsEditor.module.scss';

type View = 'folders' | 'types';
type Layout = 'grid' | 'list';

function isKind(value: string): value is KindChoice {
  return value === 'board' || value === 'palette' || (ASSET_KINDS as readonly string[]).includes(value);
}

function internalOf(item: { data: { current?: unknown } } | null | undefined): InternalDragData | null {
  const current = item?.data.current;
  return typeof current === 'object' && current !== null && (current as { type?: string }).type === 'internal'
    ? (current as InternalDragData)
    : null;
}

function matchesName(name: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return needle.length === 0 || name.toLowerCase().includes(needle);
}

function folderTally(items: { folderId: string | null }[]): Map<string | null, number> {
  const counts = new Map<string | null, number>();
  for (const item of items) counts.set(item.folderId, (counts.get(item.folderId) ?? 0) + 1);
  return counts;
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
  const boards = useBoards();
  const palettes = usePalettes();
  const names = useWorkspaceNames();
  const [draggingInternal, setDraggingInternal] = useState<InternalItem | null>(null);
  const [dialog, setDialog] = useState<'folder' | 'options' | null>(null);
  const [dropping, setDropping] = useState(false);
  const [dragging, setDragging] = useState<string[] | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const dragDepth = useRef(0);

  const view: View = readString(state, 'view', 'folders') === 'types' ? 'types' : 'folders';
  const preferences = useSettings().editors.assets;
  const layout: Layout = readString(state, 'layout', preferences.layout) === 'list' ? 'list' : 'grid';
  const search = readString(state, 'search', '');
  const scope: AssetScope = view === 'folders' ? readScope(state) : 'files';
  const fileFolders = folders.filter((folder) => folder.scope === 'files');
  const folderId = readFolderId(state, folders, scope);
  const kindValue = readString(state, 'kind', 'image');
  const kind: KindChoice = isKind(kindValue) ? kindValue : 'image';
  const selectedInternal = readString(state, 'internalId', '');
  const internalItems: InternalItem[] = [
    ...(boards ?? []).map((board) => ({
      kind: 'board' as const,
      id: board.id,
      name: board.name,
      folderId: board.folderId,
      colours: [],
    })),
    ...(palettes ?? []).map((palette) => ({
      kind: 'palette' as const,
      id: palette.id,
      name: palette.name,
      folderId: palette.folderId,
      colours: palette.colours.map((colour) => colour.hex),
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const internalKind: InternalKind | null =
    view === 'types'
      ? kind === 'board' || kind === 'palette'
        ? kind
        : null
      : scope === 'boards'
        ? 'board'
        : scope === 'palettes'
          ? 'palette'
          : null;
  const searching = search.trim().length > 0;
  const shownInternal = internalItems.filter(
    (item) =>
      (internalKind === null || item.kind === internalKind) &&
      (view === 'types' || internalKind === null || folderId === null || item.folderId === folderId) &&
      matchesName(item.name, search),
  );
  const internalDetails =
    internalKind !== null || searching
      ? (shownInternal.find((item) => internalKey(item) === selectedInternal) ?? null)
      : null;
  const selectedId = readString(state, 'selectedId', '');
  const details = readBoolean(state, 'details', preferences.details);

  const byName = (a: Asset, b: Asset) => a.name.localeCompare(b.name);
  const visible = (
    view === 'types'
      ? kind === 'board' || kind === 'palette'
        ? []
        : assetsOfKind(assets, kind, search)
      : folderId === null
        ? assets.filter((asset) => matchesAssetSearch(asset, search))
        : assetsInFolder(assets, folderId, search)
  ).sort(byName);
  const existing = new Set(assets.map((asset) => asset.id));
  const selectedIds = new Set(
    (selection.length > 0 ? selection : [selectedId]).filter((id) => existing.has(id)),
  );
  const selectedAsset = assets.find((asset) => asset.id === selectedId) ?? null;
  const counts = folderCounts(fileFolders, assets);
  const selectedFolder = folders.find((folder) => folder.id === folderId);
  const importTarget = view === 'types' || scope !== 'files' ? 'auto' : folderId;

  function openItem(item: InternalItem) {
    openLinked({ kind: item.kind, id: item.id }, names);
  }

  function selectInternal(item: InternalItem) {
    setState({ internalId: internalKey(item) });
  }

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
    setState({ selectedId: id, internalId: '' });
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
    const internal = internalOf(active);
    setDraggingInternal(
      internal
        ? (internalItems.find((item) => item.kind === internal.kind && item.id === internal.id) ?? null)
        : null,
    );
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
    setDraggingInternal(null);
    const internal = internalOf(active);
    const drop = dropDataOf(over);
    if (internal) {
      if (drop?.scope !== INTERNAL_SCOPES[internal.kind]) return;
      const patch = { folderId: drop.id };
      void (internal.kind === 'board' ? updateBoard(internal.id, patch) : updatePalette(internal.id, patch));
      return;
    }
    const data = dragDataOf(active);
    if (data) {
      const { x, y } = pointerOf(event);
      if (reportAssetDrag(data.ids, x, y, 'drop')) return;
    }
    const target = drop;
    if (!data || target?.scope !== 'files') return;
    const ids = data.ids.filter((id) => assets.find((asset) => asset.id === id)?.folderId !== target.id);
    if (ids.length > 0) void assetActions.move(ids, target.id);
  }

  const draggingAssets = (dragging ?? []).flatMap((id) => assets.filter((asset) => asset.id === id));
  const dropLabel =
    view === 'types' || scope !== 'files'
      ? t('drop.auto')
      : t('drop.into', { name: selectedFolder?.name ?? t('allFiles') });

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
            setDraggingInternal(null);
            reportAssetDrag([], Number.NaN, Number.NaN, 'cancel');
          }}
        >
          <div className={styles['body']}>
            <ScrollArea className={styles['sidebar']}>
              {view === 'folders' ? (
                <>
                  <div className={styles['section']}>{t('external')}</div>
                  <FolderTree
                    scope="files"
                    label={t('tree')}
                    rootLabel={t('allFiles')}
                    rootIcon={<Files />}
                    folders={folders}
                    counts={counts}
                    total={assets.length}
                    selectedId={scope === 'files' ? folderId : undefined}
                    onSelect={(id) => {
                      setState({ scope: 'files', folderId: id ?? '' });
                    }}
                    onImport={importDropped}
                  />
                  <div className={styles['section']}>{t('internal')}</div>
                  {(['board', 'palette'] as const).map((item) => {
                    const itemScope = INTERNAL_SCOPES[item];
                    const own = internalItems.filter((candidate) => candidate.kind === item);
                    return (
                      <FolderTree
                        key={item}
                        scope={itemScope}
                        label={t(itemScope)}
                        rootLabel={t(itemScope)}
                        rootIcon={item === 'board' ? <PenTool /> : <Palette />}
                        folders={folders}
                        counts={folderTally(own)}
                        total={own.length}
                        selectedId={scope === itemScope ? folderId : undefined}
                        onSelect={(id) => {
                          setState({ scope: itemScope, folderId: id ?? '' });
                        }}
                      />
                    );
                  })}
                </>
              ) : (
                <KindList
                  internalCounts={{
                    board: internalItems.filter((item) => item.kind === 'board').length,
                    palette: internalItems.filter((item) => item.kind === 'palette').length,
                  }}
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
              {internalKind !== null ? (
                <InternalGrid
                  items={shownInternal}
                  folders={folders}
                  selectedKey={selectedInternal}
                  layout={layout}
                  showPath={view === 'types' || folderId === null}
                  searching={searching}
                  label={t(INTERNAL_SCOPES[internalKind])}
                  onSelect={selectInternal}
                  onOpen={openItem}
                />
              ) : (
                <>
                  <AssetGrid
                    assets={visible}
                    folders={fileFolders}
                    selectedIds={selectedIds}
                    layout={layout}
                    showPath={view === 'types' || folderId === null}
                    searching={search.trim().length > 0}
                    onSelect={select}
                    onOpen={(id) => {
                      setSelection([id]);
                      setState({ selectedId: id, details: true, internalId: '' });
                    }}
                  />
                  {searching && shownInternal.length > 0 ? (
                    <>
                      <div className={styles['section']}>{t('internal')}</div>
                      <InternalGrid
                        items={shownInternal}
                        folders={folders}
                        selectedKey={selectedInternal}
                        layout={layout}
                        showPath
                        searching
                        label={t('internal')}
                        onSelect={selectInternal}
                        onOpen={openItem}
                      />
                    </>
                  ) : null}
                </>
              )}
            </ScrollArea>
            {details ? (
              <div className={styles['details']}>
                {internalDetails ? (
                  <InternalDetails item={internalDetails} folders={folders} onOpen={openItem} />
                ) : (
                  <AssetDetails asset={selectedAsset} folders={fileFolders} />
                )}
              </div>
            ) : null}
          </div>
          <DragOverlay dropAnimation={null}>
            {draggingInternal ? (
              <div className={gridStyles['ghost']}>
                <InternalThumbnail item={draggingInternal} />
                <span>{draggingInternal.name}</span>
              </div>
            ) : draggingAssets[0] ? (
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
              .create({
                name,
                parentId: view === 'folders' ? folderId : null,
                scope: internalKind ? INTERNAL_SCOPES[internalKind] : 'files',
              })
              .then(() => undefined)
          }
        />
      ) : null}
      <AssetOptionsDialog
        open={dialog === 'options'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        folders={fileFolders}
        settings={settings}
      />
    </div>
  );
}
