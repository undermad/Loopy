import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
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
import { Group, Panel, Separator } from 'react-resizable-panels';
import {
  Files,
  FolderPlus,
  FolderTree as FolderTreeIcon,
  LayoutGrid,
  List,
  ListTree,
  Palette,
  PanelRight,
  PenTool,
  Plus,
  Settings2,
  Shapes,
  Upload,
} from 'lucide-react';
import { ASSET_KINDS, assetKindOf, type Asset, type AssetScope, type AssetTarget } from '@shared/assets';
import type { BoardLink } from '@shared/board';
import { createBoard, deleteBoard, updateBoard, useBoards } from '@renderer/lib/board';
import { harmonyColours } from '@renderer/lib/colour';
import { createPalette, deletePalette, updatePalette, usePalettes } from '@renderer/lib/palettes';
import { openLinked, useWorkspaceNames } from '@renderer/lib/workspaces';
import type { EditorProps } from '@renderer/lib/editors';
import {
  assetActions,
  assetsInFolder,
  assetsOfKind,
  folderActions,
  folderCounts,
  importFiles,
  isRenameClick,
  kindCounts,
  matchesAssetSearch,
  pickFiles,
  pickSelection,
  recordClick,
  reportAssetDrag,
  useAssetsLoaded,
  useAssetsSnapshot,
  type ClickRecord,
} from '@renderer/lib/assets';
import { useTranslation } from '@renderer/lib/i18n';
import { useSettings } from '@renderer/lib/settings';
import {
  ConfirmDialog,
  DropdownMenu,
  IconButton,
  Input,
  ScrollArea,
  Spinner,
  ToggleGroup,
  cx,
} from '@renderer/ui';
import { AreaHeaderContent } from '../../Shell/AreaHeaderContent';
import { PromptDialog } from '../../Shell/PromptDialog';
import { AssetDetails } from './AssetDetails';
import { AssetGrid, AssetThumbnail, type SelectModifiers } from './AssetGrid';
import { AssetMenuItems, type AssetMenuActions, type MenuEntry } from './AssetMenu';
import { AssetOptionsDialog } from './AssetOptionsDialog';
import { FolderTree, type TreeLeaf } from './FolderTree';
import { InternalDetails } from './InternalDetails';
import { InternalGrid, InternalThumbnail } from './InternalGrid';
import { KindList, type KindChoice } from './KindList';
import {
  INTERNAL_SCOPES,
  KIND_ICONS,
  hasFiles,
  internalKey,
  readBoolean,
  readFolderId,
  readScope,
  readString,
  type AssetDragData,
  type FolderDropData,
  type InternalItem,
  type InternalKind,
} from './kinds';
import gridStyles from './AssetGrid.module.scss';
import styles from './AssetsEditor.module.scss';

type View = 'folders' | 'types';
type Layout = 'grid' | 'list';
type Place = 'tree' | 'main';
type Dialog = 'folder' | 'board' | 'palette' | 'options' | null;

const NEW_PALETTE_BASE = '#4f46e5';

function isKind(value: string): value is KindChoice {
  return value === 'board' || value === 'palette' || (ASSET_KINDS as readonly string[]).includes(value);
}

function isInternalKey(key: string): boolean {
  return key.startsWith('board:') || key.startsWith('palette:');
}

function linkOf(key: string): BoardLink | null {
  const [kind, ...rest] = key.split(':');
  const id = rest.join(':');
  return (kind === 'board' || kind === 'palette') && id ? { kind, id } : null;
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

function isEditable(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

function percent(value: number): string {
  return `${String(value)}%`;
}

function readSplit(state: Record<string, unknown>, key: string, fallback: number): number {
  const splits = state['splits'];
  if (typeof splits !== 'object' || splits === null) return fallback;
  const value = (splits as Record<string, unknown>)[key];
  return typeof value === 'number' && value > 0 && value < 100 ? value : fallback;
}

export function AssetsEditor({ state, setState }: EditorProps) {
  const { t } = useTranslation('assets');
  const { t: tc } = useTranslation('common');
  const loaded = useAssetsLoaded();
  const { folders, assets, settings } = useAssetsSnapshot();
  const boards = useBoards();
  const palettes = usePalettes();
  const names = useWorkspaceNames();
  const editorRef = useRef<HTMLDivElement>(null);
  const [portrait, setPortrait] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dropping, setDropping] = useState(false);
  const [dragging, setDragging] = useState<AssetDragData | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ key: string; place: Place } | null>(null);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const lastClick = useRef<ClickRecord | null>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    const element = editorRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setPortrait(box.height > box.width);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  const view: View = readString(state, 'view', 'folders') === 'types' ? 'types' : 'folders';
  const preferences = useSettings().editors.assets;
  const layout: Layout = readString(state, 'layout', preferences.layout) === 'list' ? 'list' : 'grid';
  const search = readString(state, 'search', '');
  const treeFiles = view === 'folders' && readBoolean(state, 'treeFiles', false);
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
    internalKind !== null || searching || treeFiles
      ? (internalItems.find((item) => internalKey(item) === selectedInternal) ?? null)
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
  const existing = new Set([...assets.map((asset) => asset.id), ...internalItems.map(internalKey)]);
  const primary = selectedInternal || selectedId;
  const activeKeys = (selection.length > 0 ? selection : primary ? [primary] : []).filter((key) =>
    existing.has(key),
  );
  const selectedIds = new Set(activeKeys.filter((key) => !isInternalKey(key)));
  const selectedKeys = new Set(activeKeys);
  const selectedAsset = assets.find((asset) => asset.id === selectedId) ?? null;
  const counts = folderCounts(fileFolders, assets);
  const selectedFolder = folders.find((folder) => folder.id === folderId);
  const importTarget = view === 'types' || scope !== 'files' ? 'auto' : folderId;
  const mainOrder =
    internalKind !== null
      ? shownInternal.map(internalKey)
      : [...visible.map((asset) => asset.id), ...(searching ? shownInternal.map(internalKey) : [])];

  function entryOf(key: string): MenuEntry | null {
    const internal = internalItems.find((item) => internalKey(item) === key);
    if (internal) {
      return { key, kind: internal.kind, id: internal.id, name: internal.name, folderId: internal.folderId };
    }
    const asset = assets.find((item) => item.id === key);
    return asset ? { key, kind: 'file', id: asset.id, name: asset.name, folderId: asset.folderId } : null;
  }

  function openItem(item: Pick<InternalItem, 'kind' | 'id'>) {
    openLinked({ kind: item.kind, id: item.id }, names);
  }

  function openKey(key: string) {
    const entry = entryOf(key);
    if (!entry) return;
    if (entry.kind === 'file') {
      setSelection([key]);
      setAnchor(key);
      setState({ selectedId: key, details: true, internalId: '' });
    } else {
      openItem({ kind: entry.kind, id: entry.id });
    }
  }

  function clearSelection() {
    setSelection([]);
    setAnchor(null);
    setState({ selectedId: '', internalId: '' });
  }

  function select(
    key: string,
    modifiers: SelectModifiers,
    order: string[] = mainOrder,
    place: Place = 'main',
  ) {
    const plain = !modifiers.ctrl && !modifiers.shift;
    if (plain && activeKeys.length === 1 && activeKeys[0] === key && isRenameClick(lastClick.current, key)) {
      lastClick.current = null;
      setRenaming({ key, place });
      return;
    }
    lastClick.current = recordClick(key);
    const picked = pickSelection(order, activeKeys, primary || anchor, key, modifiers);
    setSelection(picked.selection);
    setAnchor(picked.anchor);
    if (modifiers.shift) return;
    const included = picked.selection.includes(key);
    if (isInternalKey(key)) {
      if (included) setState({ internalId: key });
      return;
    }
    if (modifiers.ctrl) {
      if (included || !picked.selection.includes(selectedId)) {
        const first = picked.selection.find((item) => !isInternalKey(item)) ?? '';
        setState({ selectedId: included ? key : first });
      }
      return;
    }
    setState({ selectedId: key, internalId: '' });
  }

  function renameDone(key: string, name: string | null) {
    setRenaming(null);
    const entry = entryOf(key);
    if (!entry || name === null) return;
    if (entry.kind === 'file') void assetActions.update(entry.id, { name });
    else if (entry.kind === 'board') void updateBoard(entry.id, { name });
    else void updatePalette(entry.id, { name });
  }

  function moveKeys(keys: string[], kindOf: MenuEntry['kind'], target: string | null) {
    const entries = keys.map(entryOf).filter((entry): entry is MenuEntry => entry?.kind === kindOf);
    if (kindOf === 'file') {
      const ids = entries.map((entry) => entry.id);
      if (ids.length > 0) void assetActions.move(ids, target);
      return;
    }
    for (const entry of entries) {
      if (entry.kind === 'board') void updateBoard(entry.id, { folderId: target });
      else void updatePalette(entry.id, { folderId: target });
    }
  }

  async function removeKeys(keys: string[]) {
    const entries = keys.map(entryOf).filter((entry): entry is MenuEntry => entry !== null);
    const files = entries.filter((entry) => entry.kind === 'file').map((entry) => entry.id);
    if (files.length > 0) await assetActions.remove(files);
    for (const entry of entries) {
      if (entry.kind === 'board') await deleteBoard(entry.id);
      if (entry.kind === 'palette') await deletePalette(entry.id);
    }
    clearSelection();
  }

  async function createInternal(of: InternalKind, name: string) {
    const target = scope === INTERNAL_SCOPES[of] ? folderId : null;
    if (of === 'board') {
      const board = await createBoard({ name });
      if (target) await updateBoard(board.id, { folderId: target });
      setSelection([`board:${board.id}`]);
      setState({ internalId: `board:${board.id}` });
      return;
    }
    const palette = await createPalette({
      name,
      harmony: 'analogous',
      colours: harmonyColours(NEW_PALETTE_BASE, 'analogous').map((hex) => ({ hex })),
    });
    if (target) await updatePalette(palette.id, { folderId: target });
    setSelection([`palette:${palette.id}`]);
    setState({ internalId: `palette:${palette.id}` });
  }

  function menuFor(place: Place): AssetMenuActions {
    return {
      open: (entry) => {
        openKey(entry.key);
      },
      rename: (entry) => {
        setRenaming({ key: entry.key, place });
      },
      move: moveKeys,
      exportFile: (id) => void assetActions.exportToDisk(id),
      remove: (keys) => {
        setConfirm(keys);
      },
    };
  }

  const menu = menuFor('main');
  const treeMenu = menuFor('tree');
  const mainRenaming = renaming?.place === 'main' ? renaming.key : null;
  const treeRenaming = renaming?.place === 'tree' ? renaming.key : null;

  function onKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || isEditable(event.target)) return;
    const mod = event.ctrlKey || event.metaKey;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (activeKeys.length === 0) return;
      setConfirm(activeKeys);
    } else if (event.key === 'F2') {
      const only = activeKeys.length === 1 ? activeKeys[0] : undefined;
      if (!only) return;
      setRenaming({
        key: only,
        place: event.target instanceof Element && event.target.closest('[role="tree"]') ? 'tree' : 'main',
      });
    } else if (mod && event.key.toLowerCase() === 'a') {
      setSelection(mainOrder);
      setAnchor(mainOrder[0] ?? null);
    } else if (event.key === 'Escape') {
      if (activeKeys.length === 0) return;
      clearSelection();
    } else {
      return;
    }
    event.preventDefault();
  }

  function onBackground(event: MouseEvent<HTMLDivElement>) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    if ((event.target as Element).closest('[data-key], button, input, [role="menu"]')) return;
    if (activeKeys.length > 0) clearSelection();
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  function imported(ids: string[], firstName?: string) {
    const first = ids[0];
    if (!first) return;
    setSelection([first]);
    setAnchor(first);
    const patch: Record<string, unknown> = { selectedId: first, internalId: '' };
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

  function groupOf(key: string): string[] {
    return selectedKeys.has(key) && selectedKeys.size > 1 ? Array.from(selectedKeys) : [key];
  }

  function dragFor(key: string): AssetDragData {
    const group = groupOf(key);
    return {
      type: 'asset',
      ids: group.filter((item) => !isInternalKey(item)),
      links: group.map(linkOf).filter((link): link is BoardLink => link !== null),
    };
  }

  function onDragStart({ active }: DragStartEvent) {
    const data = dragDataOf(active);
    setDragging(data);
    const key = String(active.id).replace(/^tree:/, '');
    if (!selectedKeys.has(key)) {
      setSelection([key]);
      setAnchor(key);
      setState(isInternalKey(key) ? { internalId: key } : { selectedId: key, internalId: '' });
    }
  }

  function pointerOf({ activatorEvent, delta }: DragMoveEvent | DragEndEvent): { x: number; y: number } {
    const start = activatorEvent as Partial<PointerEvent>;
    return { x: (start.clientX ?? Number.NaN) + delta.x, y: (start.clientY ?? Number.NaN) + delta.y };
  }

  function onDragMove(event: DragMoveEvent) {
    const data = dragDataOf(event.active);
    if (!data) return;
    const { x, y } = pointerOf(event);
    reportAssetDrag(data.ids, x, y, 'move', data.links);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDragging(null);
    const data = dragDataOf(active);
    if (!data) return;
    const { x, y } = pointerOf(event);
    if (reportAssetDrag(data.ids, x, y, 'drop', data.links)) return;
    const target = dropDataOf(over);
    if (!target) return;
    if (target.scope === 'files') {
      const ids = data.ids.filter((id) => assets.find((asset) => asset.id === id)?.folderId !== target.id);
      if (ids.length > 0) void assetActions.move(ids, target.id);
      return;
    }
    for (const link of data.links) {
      if (INTERNAL_SCOPES[link.kind] !== target.scope) continue;
      if (link.kind === 'board') void updateBoard(link.id, { folderId: target.id });
      else void updatePalette(link.id, { folderId: target.id });
    }
  }

  function leafMenu(entry: MenuEntry): ReactNode {
    return <AssetMenuItems entry={entry} group={groupOf(entry.key)} folders={folders} actions={treeMenu} />;
  }

  const fileLeaves: TreeLeaf[] | undefined = treeFiles
    ? assets
        .filter((asset) => matchesAssetSearch(asset, search))
        .map((asset) => {
          const Icon = KIND_ICONS[asset.kind];
          return {
            key: asset.id,
            name: asset.name,
            folderId: asset.folderId,
            icon: <Icon />,
            drag: dragFor(asset.id),
            menu: leafMenu({
              key: asset.id,
              kind: 'file',
              id: asset.id,
              name: asset.name,
              folderId: asset.folderId,
            }),
          };
        })
    : undefined;

  function internalLeaves(of: InternalKind): TreeLeaf[] | undefined {
    if (!treeFiles) return undefined;
    return internalItems
      .filter((item) => item.kind === of && matchesName(item.name, search))
      .map((item) => {
        const key = internalKey(item);
        return {
          key,
          name: item.name,
          folderId: item.folderId,
          icon: of === 'board' ? <PenTool /> : <Palette />,
          drag: dragFor(key),
          menu: leafMenu({ key, kind: item.kind, id: item.id, name: item.name, folderId: item.folderId }),
        };
      });
  }

  const treeProps = {
    folders,
    selectedKeys,
    renamingKey: treeRenaming,
    onLeafSelect: (key: string, modifiers: SelectModifiers, order: string[]) => {
      select(key, modifiers, order, 'tree');
    },
    onLeafOpen: openKey,
    onRenameDone: renameDone,
  };

  function saveSplit(key: string, value: number | undefined) {
    if (value === undefined) return;
    const current = typeof state['splits'] === 'object' && state['splits'] !== null ? state['splits'] : {};
    setState({ splits: { ...current, [key]: Math.round(value * 10) / 10 } });
  }

  const confirmEntries = (confirm ?? []).map(entryOf).filter((entry): entry is MenuEntry => entry !== null);
  const confirmFiles = confirmEntries.every((entry) => entry.kind === 'file');
  const confirmFirst = confirmEntries[0];
  const confirmTitle =
    confirmEntries.length > 1
      ? confirmFiles
        ? t('asset.deleteMany', { count: confirmEntries.length })
        : t('item.deleteMany', { count: confirmEntries.length })
      : confirmFirst === undefined || confirmFirst.kind === 'file'
        ? t('asset.delete')
        : t(`item.delete.${confirmFirst.kind}`);
  const confirmText =
    confirmEntries.length > 1
      ? confirmFiles
        ? t('asset.deleteManyConfirm', { count: confirmEntries.length })
        : t('item.deleteManyConfirm', { count: confirmEntries.length })
      : confirmFiles
        ? t('asset.deleteConfirm', { name: confirmFirst?.name ?? '' })
        : t('item.deleteConfirm', { name: confirmFirst?.name ?? '' });

  const draggingKeys = dragging
    ? [...dragging.ids, ...dragging.links.map((link) => `${link.kind}:${link.id}`)]
    : [];
  const draggingFirst = draggingKeys[0];
  const draggingAsset = draggingFirst ? (assets.find((asset) => asset.id === draggingFirst) ?? null) : null;
  const draggingItem = draggingFirst
    ? (internalItems.find((item) => internalKey(item) === draggingFirst) ?? null)
    : null;
  const dropLabel =
    view === 'types' || scope !== 'files'
      ? t('drop.auto')
      : t('drop.into', { name: selectedFolder?.name ?? t('allFiles') });

  const sidebar = (
    <div className={styles['sidebar']}>
      <div className={styles['sideTop']}>
        <Input
          size="sm"
          type="search"
          value={search}
          aria-label={t('search')}
          placeholder={t('search')}
          className={styles['sideSearch']}
          onChange={(event) => {
            setState({ search: event.target.value });
          }}
        />
        <IconButton
          label={t('import')}
          size="sm"
          onClick={() =>
            void pickFiles(importTarget).then((ids) => {
              imported(ids);
            })
          }
        >
          <Upload aria-hidden="true" />
        </IconButton>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <IconButton label={t('create.label')} size="sm">
              <Plus aria-hidden="true" />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item
              onSelect={() => {
                setDialog('folder');
              }}
            >
              <FolderPlus aria-hidden="true" />
              {t('newFolder')}
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              onSelect={() => {
                setDialog('board');
              }}
            >
              <PenTool aria-hidden="true" />
              {t('create.board')}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => {
                setDialog('palette');
              }}
            >
              <Palette aria-hidden="true" />
              {t('create.palette')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
      <ScrollArea className={styles['sideScroll']}>
        {view === 'folders' ? (
          <>
            <div className={styles['section']}>{t('external')}</div>
            <FolderTree
              {...treeProps}
              scope="files"
              label={t('tree')}
              rootLabel={t('allFiles')}
              rootIcon={<Files />}
              counts={counts}
              total={assets.length}
              selectedId={scope === 'files' ? folderId : undefined}
              onSelect={(id) => {
                setState({ scope: 'files', folderId: id ?? '' });
              }}
              onImport={importDropped}
              leaves={fileLeaves}
              renameLabel={t('asset.fileName')}
            />
            <div className={styles['section']}>{t('internal')}</div>
            {(['board', 'palette'] as const).map((item) => {
              const itemScope = INTERNAL_SCOPES[item];
              const own = internalItems.filter((candidate) => candidate.kind === item);
              return (
                <FolderTree
                  {...treeProps}
                  key={item}
                  scope={itemScope}
                  label={t(itemScope)}
                  rootLabel={t(itemScope)}
                  rootIcon={item === 'board' ? <PenTool /> : <Palette />}
                  counts={folderTally(own)}
                  total={own.length}
                  selectedId={scope === itemScope ? folderId : undefined}
                  onSelect={(id) => {
                    setState({ scope: itemScope, folderId: id ?? '' });
                  }}
                  leaves={internalLeaves(item)}
                  renameLabel={t('item.name')}
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
    </div>
  );

  const list = (
    <div className={styles['listBox']} onClick={onBackground}>
      <ScrollArea className={styles['main']} viewportClassName={styles['mainViewport']}>
        {internalKind !== null ? (
          <InternalGrid
            items={shownInternal}
            folders={folders}
            selectedKeys={selectedKeys}
            renamingKey={mainRenaming}
            layout={layout}
            showPath={view === 'types' || folderId === null}
            searching={searching}
            label={t(INTERNAL_SCOPES[internalKind])}
            menu={menu}
            dragFor={dragFor}
            onSelect={(item, modifiers) => {
              select(internalKey(item), modifiers);
            }}
            onOpen={openItem}
            onRenameDone={(item, name) => {
              renameDone(internalKey(item), name);
            }}
          />
        ) : (
          <>
            <AssetGrid
              assets={visible}
              folders={folders}
              selectedIds={selectedIds}
              layout={layout}
              showPath={view === 'types' || folderId === null}
              searching={searching}
              renamingKey={mainRenaming}
              menu={menu}
              dragFor={dragFor}
              onSelect={(id, modifiers) => {
                select(id, modifiers);
              }}
              onOpen={openKey}
              onRenameDone={renameDone}
            />
            {searching && shownInternal.length > 0 ? (
              <>
                <div className={styles['section']}>{t('internal')}</div>
                <InternalGrid
                  items={shownInternal}
                  folders={folders}
                  selectedKeys={selectedKeys}
                  renamingKey={mainRenaming}
                  layout={layout}
                  showPath
                  searching
                  label={t('internal')}
                  menu={menu}
                  dragFor={dragFor}
                  onSelect={(item, modifiers) => {
                    select(internalKey(item), modifiers);
                  }}
                  onOpen={openItem}
                  onRenameDone={(item, name) => {
                    renameDone(internalKey(item), name);
                  }}
                />
              </>
            ) : null}
          </>
        )}
      </ScrollArea>
    </div>
  );

  const detailsPanel = details ? (
    <div className={styles['details']}>
      {internalDetails ? (
        <InternalDetails item={internalDetails} folders={folders} onOpen={openItem} />
      ) : (
        <AssetDetails asset={selectedAsset} folders={fileFolders} />
      )}
    </div>
  ) : null;

  const direction = portrait ? 'vertical' : 'horizontal';
  const body = treeFiles ? (
    <Group
      key={`tree-${direction}-${String(details)}`}
      orientation={direction}
      className={styles['body']}
      onLayoutChanged={(next) => {
        saveSplit('treeOnly', next['tree']);
      }}
    >
      <Panel id="tree" defaultSize={percent(details ? readSplit(state, 'treeOnly', 60) : 100)} minSize="25">
        {sidebar}
      </Panel>
      {detailsPanel ? (
        <>
          <Separator className={styles['separator']} />
          <Panel id="details" minSize="20">
            {detailsPanel}
          </Panel>
        </>
      ) : null}
    </Group>
  ) : (
    <Group
      key={`outer-${direction}`}
      orientation="horizontal"
      className={styles['body']}
      onLayoutChanged={(next) => {
        saveSplit(portrait ? 'treeTall' : 'tree', next['tree']);
      }}
    >
      <Panel
        id="tree"
        defaultSize={percent(readSplit(state, portrait ? 'treeTall' : 'tree', portrait ? 45 : 24))}
        minSize="15"
      >
        {sidebar}
      </Panel>
      <Separator className={styles['separator']} />
      <Panel id="content" minSize="35">
        <Group
          key={`inner-${direction}-${String(details)}`}
          orientation={direction}
          className={styles['content']}
          onLayoutChanged={(next) => {
            saveSplit(portrait ? 'detailsBelow' : 'detailsBeside', next['details']);
          }}
        >
          <Panel id="list" minSize="25">
            {list}
          </Panel>
          {detailsPanel ? (
            <>
              <Separator className={styles['separator']} />
              <Panel
                id="details"
                defaultSize={percent(
                  portrait ? readSplit(state, 'detailsBelow', 45) : readSplit(state, 'detailsBeside', 32),
                )}
                minSize="20"
              >
                {detailsPanel}
              </Panel>
            </>
          ) : null}
        </Group>
      </Panel>
    </Group>
  );

  return (
    <div
      ref={editorRef}
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
        {view === 'folders' ? (
          <IconButton
            label={t('treeFiles')}
            size="sm"
            active={treeFiles}
            onClick={() => {
              setState({ treeFiles: !treeFiles });
            }}
          >
            <ListTree aria-hidden="true" />
          </IconButton>
        ) : null}
        {treeFiles ? null : (
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
        )}
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
          <div className={styles['frame']} onKeyDown={onKeys}>
            {body}
          </div>
          <DragOverlay dropAnimation={null}>
            {draggingAsset || draggingItem ? (
              <div className={gridStyles['ghost']}>
                {draggingAsset ? (
                  <AssetThumbnail asset={draggingAsset} />
                ) : draggingItem ? (
                  <InternalThumbnail item={draggingItem} />
                ) : null}
                <span>
                  {draggingKeys.length > 1
                    ? t('item.dragging', { count: draggingKeys.length })
                    : (draggingAsset?.name ?? draggingItem?.name)}
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
      {dialog === 'board' || dialog === 'palette' ? (
        <PromptDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          title={t(dialog === 'board' ? 'create.board' : 'create.palette')}
          label={t('item.name')}
          initialValue={t(dialog === 'board' ? 'create.boardName' : 'create.paletteName')}
          submitLabel={tc('actions.create')}
          onSubmit={(name) => createInternal(dialog, name)}
        />
      ) : null}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirmTitle}
        description={confirmText}
        confirmLabel={tc('actions.delete')}
        cancelLabel={tc('actions.cancel')}
        closeLabel={tc('actions.close')}
        destructive
        onConfirm={() => removeKeys(confirm ?? [])}
      />
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
