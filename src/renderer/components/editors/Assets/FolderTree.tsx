import { useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ChevronRight, Folder, FolderOpen } from 'lucide-react';
import type { AssetFolder, AssetScope } from '@shared/assets';
import { buildFolderTree, descendantFolderIds, folderActions, type FolderNode } from '@renderer/lib/assets';
import { useTranslation } from '@renderer/lib/i18n';
import { ConfirmDialog, ContextMenu, cx } from '@renderer/ui';
import { PromptDialog } from '../../Shell/PromptDialog';
import { ROOT_VALUE, folderDropId, folderLabel, hasFiles, type FolderDropData } from './kinds';
import styles from './FolderTree.module.scss';

export interface FolderTreeProps {
  scope: AssetScope;
  label: string;
  rootLabel: string;
  rootIcon: ReactNode;
  folders: AssetFolder[];
  counts: Map<string | null, number>;
  total: number;
  selectedId: string | null | undefined;
  onSelect: (id: string | null) => void;
  onImport?: ((files: FileList, folderId: string | null) => void) | undefined;
}

type Dialog = { kind: 'rename' | 'subfolder' | 'delete'; folderId: string } | { kind: 'new' } | null;

interface RowProps {
  id: string | null;
  scope: AssetScope;
  label: string;
  count: number;
  depth: number;
  icon: ReactNode;
  selected: boolean;
  expanded: boolean | undefined;
  onToggle?: () => void;
  onSelect: () => void;
  onImport: ((files: FileList) => void) | undefined;
  menu: ReactNode;
  children?: ReactNode;
}

function TreeRow({
  id,
  scope,
  label,
  count,
  depth,
  icon,
  selected,
  expanded,
  onToggle,
  onSelect,
  onImport,
  menu,
  children,
}: RowProps) {
  const [hover, setHover] = useState(false);
  const data: FolderDropData = { type: 'folder', id, scope };
  const { setNodeRef, isOver } = useDroppable({ id: folderDropId(id, scope), data });

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (!onImport || !hasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    setHover(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHover(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    setHover(false);
    if (!onImport || event.dataTransfer.files.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    onImport(event.dataTransfer.files);
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          ref={setNodeRef}
          role="treeitem"
          tabIndex={selected ? 0 : -1}
          aria-selected={selected}
          aria-expanded={expanded}
          aria-level={depth + 1}
          data-row={id ?? ROOT_VALUE}
          className={cx(styles['row'], selected && styles['selected'], (isOver || hover) && styles['over'])}
          style={{ paddingLeft: `calc(var(--space-2) + ${String(depth)} * var(--space-4))` }}
          onClick={onSelect}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <span
            className={cx(
              styles['chevron'],
              expanded && styles['open'],
              expanded === undefined && styles['leaf'],
            )}
            aria-hidden="true"
            onClick={(event) => {
              event.stopPropagation();
              onToggle?.();
            }}
          >
            <ChevronRight />
          </span>
          <span className={styles['icon']} aria-hidden="true">
            {icon}
          </span>
          <span className={styles['name']}>{label}</span>
          <span className={styles['count']}>{count}</span>
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Content>{menu}</ContextMenu.Content>
      {children}
    </ContextMenu.Root>
  );
}

export function FolderTree({
  scope,
  label,
  rootLabel,
  rootIcon,
  folders: allFolders,
  counts,
  total,
  selectedId,
  onSelect,
  onImport,
}: FolderTreeProps) {
  const { t } = useTranslation('assets');
  const { t: tc } = useTranslation('common');
  const treeRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const folders = allFolders.filter((folder) => folder.scope === scope);
  const tree = buildFolderTree(folders);
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const dialogFolder = dialog && 'folderId' in dialog ? byId.get(dialog.folderId) : undefined;

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function visibleIds(): string[] {
    const ids: string[] = [ROOT_VALUE];
    const walk = (nodes: FolderNode[]) => {
      for (const node of nodes) {
        ids.push(node.folder.id);
        if (!collapsed.has(node.folder.id)) walk(node.children);
      }
    };
    walk(tree);
    return ids;
  }

  function focusRow(id: string) {
    treeRef.current?.querySelector<HTMLElement>(`[data-row="${id}"]`)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-row]');
    const id = row?.dataset['row'];
    if (!id) return;
    const ids = visibleIds();
    const index = ids.indexOf(id);
    const folder = byId.get(id);
    const hasChildren = folders.some((candidate) => candidate.parentId === id);
    switch (event.key) {
      case 'ArrowDown':
        focusRow(ids[Math.min(index + 1, ids.length - 1)] ?? id);
        break;
      case 'ArrowUp':
        focusRow(ids[Math.max(index - 1, 0)] ?? id);
        break;
      case 'ArrowRight':
        if (hasChildren && collapsed.has(id)) toggle(id);
        else if (hasChildren) focusRow(ids[index + 1] ?? id);
        break;
      case 'ArrowLeft':
        if (hasChildren && !collapsed.has(id)) toggle(id);
        else if (folder) focusRow(folder.parentId ?? ROOT_VALUE);
        break;
      case 'Home':
        focusRow(ROOT_VALUE);
        break;
      case 'End':
        focusRow(ids[ids.length - 1] ?? id);
        break;
      case 'Enter':
      case ' ':
        onSelect(id === ROOT_VALUE ? null : id);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function moveTargets(folder: AssetFolder) {
    const excluded = descendantFolderIds(folders, folder.id);
    return folders
      .filter((candidate) => !excluded.has(candidate.id))
      .map((candidate) => ({ id: candidate.id, label: folderLabel(folders, candidate.id) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  function folderMenu(folder: AssetFolder) {
    return (
      <>
        <ContextMenu.Item
          onSelect={() => {
            setDialog({ kind: 'rename', folderId: folder.id });
          }}
        >
          {t('folder.rename')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onSelect={() => {
            setDialog({ kind: 'subfolder', folderId: folder.id });
          }}
        >
          {t('newSubfolder')}
        </ContextMenu.Item>
        <ContextMenu.Sub>
          <ContextMenu.SubTrigger>{t('folder.moveTo')}</ContextMenu.SubTrigger>
          <ContextMenu.SubContent>
            <ContextMenu.Item
              disabled={folder.parentId === null}
              onSelect={() => void folderActions.update(folder.id, { parentId: null })}
            >
              {rootLabel}
            </ContextMenu.Item>
            {moveTargets(folder).map((target) => (
              <ContextMenu.Item
                key={target.id}
                disabled={folder.parentId === target.id}
                onSelect={() => void folderActions.update(folder.id, { parentId: target.id })}
              >
                {target.label}
              </ContextMenu.Item>
            ))}
          </ContextMenu.SubContent>
        </ContextMenu.Sub>
        <ContextMenu.Separator />
        <ContextMenu.Item
          onSelect={() => {
            setDialog({ kind: 'delete', folderId: folder.id });
          }}
        >
          {t('folder.delete')}
        </ContextMenu.Item>
      </>
    );
  }

  function renderNode(node: FolderNode): ReactNode {
    const { folder } = node;
    const expanded = node.children.length > 0 ? !collapsed.has(folder.id) : undefined;
    return (
      <TreeRow
        key={folder.id}
        id={folder.id}
        scope={scope}
        label={folder.name}
        count={counts.get(folder.id) ?? 0}
        depth={node.depth + 1}
        icon={expanded ? <FolderOpen /> : <Folder />}
        selected={selectedId === folder.id}
        expanded={expanded}
        onToggle={() => {
          toggle(folder.id);
        }}
        onSelect={() => {
          onSelect(folder.id);
        }}
        onImport={
          onImport
            ? (files) => {
                onImport(files, folder.id);
              }
            : undefined
        }
        menu={folderMenu(folder)}
      >
        {expanded ? (
          <div role="group" className={styles['group']}>
            {node.children.map(renderNode)}
          </div>
        ) : null}
      </TreeRow>
    );
  }

  return (
    <>
      <div ref={treeRef} role="tree" aria-label={label} className={styles['tree']} onKeyDown={onKeyDown}>
        <TreeRow
          id={null}
          scope={scope}
          label={rootLabel}
          count={total}
          depth={0}
          icon={rootIcon}
          selected={selectedId === null}
          expanded={undefined}
          onSelect={() => {
            onSelect(null);
          }}
          onImport={
            onImport
              ? (files) => {
                  onImport(files, null);
                }
              : undefined
          }
          menu={
            <ContextMenu.Item
              onSelect={() => {
                setDialog({ kind: 'new' });
              }}
            >
              {t('newFolder')}
            </ContextMenu.Item>
          }
        />
        {tree.map(renderNode)}
      </div>
      {dialog?.kind === 'rename' && dialogFolder ? (
        <PromptDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          title={t('folder.rename')}
          label={t('folderName')}
          initialValue={dialogFolder.name}
          submitLabel={tc('actions.rename')}
          onSubmit={(name) => folderActions.update(dialogFolder.id, { name }).then(() => undefined)}
        />
      ) : null}
      {dialog?.kind === 'subfolder' || dialog?.kind === 'new' ? (
        <PromptDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          title={dialog.kind === 'new' ? t('newFolder') : t('newSubfolder')}
          label={t('folderName')}
          submitLabel={tc('actions.create')}
          onSubmit={(name) =>
            folderActions
              .create({ name, parentId: dialog.kind === 'subfolder' ? dialog.folderId : null, scope })
              .then(() => undefined)
          }
        />
      ) : null}
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={t('folder.delete')}
        description={t('folder.deleteConfirm', {
          name: dialogFolder?.name ?? '',
          parent: dialogFolder?.parentId ? (byId.get(dialogFolder.parentId)?.name ?? '') : rootLabel,
        })}
        confirmLabel={tc('actions.delete')}
        cancelLabel={tc('actions.cancel')}
        closeLabel={tc('actions.close')}
        destructive
        onConfirm={async () => {
          if (!dialogFolder) return;
          await folderActions.remove(dialogFolder.id);
          if (selectedId === dialogFolder.id) onSelect(dialogFolder.parentId);
        }}
      />
    </>
  );
}
