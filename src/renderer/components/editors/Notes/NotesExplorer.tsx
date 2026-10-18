import { useMemo, useState, type DragEvent, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  Hash,
  NotebookText,
  Star,
  Upload,
} from 'lucide-react';
import type { AssetFolder } from '@shared/assets';
import type { Note } from '@shared/notes';
import type { EditorProps } from '@renderer/lib/editors';
import { folderActions, reportAssetDrag, useAssetsSnapshot } from '@renderer/lib/assets';
import { useTranslation } from '@renderer/lib/i18n';
import {
  deleteNotes,
  exportNotes,
  importNoteFiles,
  loadNotes,
  pickNotes,
  searchNotes,
  updateNote,
  useActiveNoteId,
  useNoteIndex,
  useNotes,
  useNotesLoaded,
} from '@renderer/lib/notes';
import {
  ConfirmDialog,
  ContextMenu,
  DropdownMenu,
  EmptyState,
  IconButton,
  Input,
  ScrollArea,
  Spinner,
  cx,
  useToast,
} from '@renderer/ui';
import { PromptDialog } from '../../Shell/PromptDialog';
import { createFromTemplate, openDailyNote, templateOptions } from './noteTemplates';
import { folderPathOf } from './paths';
import { useNoteNavigation } from './useNoteNavigation';
import styles from './NotesExplorer.module.scss';

type Prompt =
  { kind: 'folder'; parentId: string | null } | { kind: 'renameFolder'; folder: AssetFolder } | null;
type Confirm = { kind: 'notes'; ids: string[] } | { kind: 'folder'; folder: AssetFolder } | null;

const ROOT = 'notes-root';

function readText(state: Record<string, unknown>, key: string): string {
  const value = state[key];
  return typeof value === 'string' ? value : '';
}

function NoteRow({
  note,
  depth,
  active,
  renaming,
  onOpen,
  onRename,
  onRenameDone,
  menu,
}: {
  note: Note;
  depth: number;
  active: boolean;
  renaming: boolean;
  onOpen: () => void;
  onRename: () => void;
  onRenameDone: (title: string | null) => void;
  menu: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `note:${note.id}`,
    data: { noteId: note.id },
    disabled: renaming,
  });
  const [draft, setDraft] = useState(note.title);
  if (renaming) {
    return (
      <div
        className={styles['row']}
        style={{ paddingLeft: `calc(${String(depth)} * var(--space-3) + var(--space-4))` }}
      >
        <Input
          size="sm"
          autoFocus
          value={draft}
          aria-label={note.title}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onBlur={() => {
            onRenameDone(draft);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onRenameDone(draft);
            if (event.key === 'Escape') onRenameDone(null);
          }}
        />
      </div>
    );
  }
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <button
          ref={setNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          className={cx(
            styles['row'],
            styles['note'],
            active && styles['active'],
            isDragging && styles['dragging'],
          )}
          style={{ paddingLeft: `calc(${String(depth)} * var(--space-3) + var(--space-4))` }}
          onClick={onOpen}
          onDoubleClick={onRename}
          onKeyDown={(event) => {
            if (event.key === 'F2') onRename();
          }}
          data-note={note.id}
        >
          <NotebookText aria-hidden="true" className={styles['icon']} />
          <span className={styles['name']}>{note.title}</span>
          {note.starred ? <Star aria-hidden="true" className={styles['star']} /> : null}
        </button>
      </ContextMenu.Trigger>
      <ContextMenu.Content>{menu}</ContextMenu.Content>
    </ContextMenu.Root>
  );
}

function FolderRow({
  folder,
  depth,
  open,
  count,
  onToggle,
  menu,
}: {
  folder: AssetFolder | null;
  depth: number;
  open: boolean;
  count: number;
  onToggle: () => void;
  menu: ReactNode;
}) {
  const { t } = useTranslation('notes');
  const { setNodeRef, isOver } = useDroppable({ id: folder ? `folder:${folder.id}` : ROOT });
  const Chevron = open ? ChevronDown : ChevronRight;
  const Icon = open ? FolderOpen : Folder;
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <button
          ref={setNodeRef}
          type="button"
          className={cx(styles['row'], styles['folder'], isOver && styles['over'])}
          style={{ paddingLeft: `calc(${String(depth)} * var(--space-3) + var(--space-1))` }}
          aria-expanded={open}
          onClick={onToggle}
        >
          {folder ? <Chevron aria-hidden="true" className={styles['chevron']} /> : null}
          <Icon aria-hidden="true" className={styles['icon']} />
          <span className={styles['name']}>{folder ? folder.name : t('explorer.files')}</span>
          <span className={styles['count']}>{count}</span>
        </button>
      </ContextMenu.Trigger>
      <ContextMenu.Content>{menu}</ContextMenu.Content>
    </ContextMenu.Root>
  );
}

export function NotesExplorer({ state, setState }: EditorProps) {
  const { t } = useTranslation('notes');
  const toast = useToast();
  const loaded = useNotesLoaded();
  const notes = useNotes();
  const index = useNoteIndex();
  const activeId = useActiveNoteId();
  const { folders: allFolders } = useAssetsSnapshot();
  const folders = useMemo(() => allFolders.filter((folder) => folder.scope === 'notes'), [allFolders]);
  const nav = useNoteNavigation();
  const search = readText(state, 'search');
  const sort = readText(state, 'sort') === 'updated' ? 'updated' : 'name';
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [dragging, setDragging] = useState<Note | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const templates = templateOptions(t, notes, allFolders);

  const sorted = useMemo(
    () =>
      [...notes].sort((a, b) =>
        sort === 'updated' ? b.updatedAt.localeCompare(a.updatedAt) : a.title.localeCompare(b.title),
      ),
    [notes, sort],
  );
  const hits = useMemo(
    () =>
      search.trim() ? searchNotes(index, search, (note) => folderPathOf(allFolders, note.folderId)) : null,
    [index, search, allFolders],
  );
  const tags = useMemo(
    () =>
      [...index.tags.values()].sort(
        (a, b) => b.noteIds.length - a.noteIds.length || a.name.localeCompare(b.name),
      ),
    [index],
  );
  const counts = useMemo(() => {
    const result = new Map<string | null, number>();
    for (const note of notes) result.set(note.folderId, (result.get(note.folderId) ?? 0) + 1);
    return result;
  }, [notes]);

  async function createIn(folderId: string | null, choice = templates[0]?.choice) {
    if (!choice) return;
    const note = await createFromTemplate(t, choice, folderId);
    nav.openNote(note.id);
    setRenaming(note.id);
  }

  async function renameDone(note: Note, title: string | null) {
    setRenaming(null);
    if (title === null || title.trim() === note.title) return;
    try {
      const changed = await updateNote(note.id, { title: title.trim() });
      if (changed.length > 1) {
        toast.show({ title: t('editor.linksUpdated', { count: changed.length - 1 }), variant: 'success' });
      }
    } catch {
      toast.show({ title: t('editor.titleTaken', { name: title.trim() }), variant: 'danger' });
    }
  }

  async function importFrom(mode: 'files' | 'folder', folderId: string | null) {
    const ids = await pickNotes(mode, folderId);
    if (ids.length > 0)
      toast.show({ title: t('explorer.imported', { count: ids.length }), variant: 'success' });
  }

  async function exportIds(ids: string[]) {
    if (ids.length === 0) return;
    const result = await exportNotes({ ids, loopyLinks: 'keep' });
    if (result.status === 'exported') toast.show({ title: t('explorer.exported'), variant: 'success' });
  }

  function folderNotes(folderId: string): string[] {
    const ids = new Set([folderId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const folder of folders) {
        if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
          ids.add(folder.id);
          grew = true;
        }
      }
    }
    return notes.filter((note) => note.folderId !== null && ids.has(note.folderId)).map((note) => note.id);
  }

  function noteMenu(note: Note) {
    return (
      <>
        <ContextMenu.Item
          onSelect={() => {
            nav.openNote(note.id);
          }}
        >
          {t('explorer.open')}
        </ContextMenu.Item>
        <ContextMenu.Item
          onSelect={() => {
            setRenaming(note.id);
          }}
        >
          {t('explorer.rename')}
        </ContextMenu.Item>
        <ContextMenu.Item onSelect={() => void updateNote(note.id, { starred: !note.starred })}>
          {note.starred ? t('explorer.unstar') : t('explorer.star')}
        </ContextMenu.Item>
        <ContextMenu.Sub>
          <ContextMenu.SubTrigger>{t('explorer.moveTo')}</ContextMenu.SubTrigger>
          <ContextMenu.SubContent>
            <ContextMenu.Item onSelect={() => void updateNote(note.id, { folderId: null })}>
              {t('explorer.root')}
            </ContextMenu.Item>
            {folders.map((folder) => (
              <ContextMenu.Item
                key={folder.id}
                onSelect={() => void updateNote(note.id, { folderId: folder.id })}
              >
                {folderPathOf(allFolders, folder.id)}
              </ContextMenu.Item>
            ))}
          </ContextMenu.SubContent>
        </ContextMenu.Sub>
        <ContextMenu.Item onSelect={() => void exportIds([note.id])}>{t('explorer.export')}</ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item
          onSelect={() => {
            setConfirm({ kind: 'notes', ids: [note.id] });
          }}
        >
          {t('explorer.delete')}
        </ContextMenu.Item>
      </>
    );
  }

  function folderMenu(folder: AssetFolder | null) {
    const folderId = folder?.id ?? null;
    return (
      <>
        <ContextMenu.Item onSelect={() => void createIn(folderId)}>{t('explorer.newNote')}</ContextMenu.Item>
        <ContextMenu.Item
          onSelect={() => {
            setPrompt({ kind: 'folder', parentId: folderId });
          }}
        >
          {t('explorer.newFolder')}
        </ContextMenu.Item>
        <ContextMenu.Item onSelect={() => void importFrom('files', folderId)}>
          {t('explorer.importFiles')}
        </ContextMenu.Item>
        {folder ? (
          <>
            <ContextMenu.Item
              onSelect={() => {
                setPrompt({ kind: 'renameFolder', folder });
              }}
            >
              {t('explorer.rename')}
            </ContextMenu.Item>
            <ContextMenu.Item onSelect={() => void exportIds(folderNotes(folder.id))}>
              {t('explorer.exportFolder')}
            </ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item
              onSelect={() => {
                setConfirm({ kind: 'folder', folder });
              }}
            >
              {t('explorer.deleteFolder')}
            </ContextMenu.Item>
          </>
        ) : (
          <ContextMenu.Item onSelect={() => void exportIds(notes.map((note) => note.id))}>
            {t('explorer.exportAll')}
          </ContextMenu.Item>
        )}
      </>
    );
  }

  function renderNote(note: Note, depth: number, pinned = false) {
    return (
      <NoteRow
        key={pinned ? `pinned:${note.id}` : note.id}
        note={note}
        depth={depth}
        active={note.id === activeId}
        renaming={!pinned && renaming === note.id}
        onOpen={() => {
          nav.openNote(note.id);
        }}
        onRename={() => {
          setRenaming(note.id);
        }}
        onRenameDone={(title) => void renameDone(note, title)}
        menu={noteMenu(note)}
      />
    );
  }

  function renderFolder(parentId: string | null, depth: number): ReactNode[] {
    const children = folders
      .filter((folder) => folder.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
    const rows: ReactNode[] = [];
    for (const folder of children) {
      const open = !closed.has(folder.id);
      rows.push(
        <FolderRow
          key={folder.id}
          folder={folder}
          depth={depth}
          open={open}
          count={counts.get(folder.id) ?? 0}
          onToggle={() => {
            setClosed((current) => {
              const next = new Set(current);
              if (next.has(folder.id)) next.delete(folder.id);
              else next.add(folder.id);
              return next;
            });
          }}
          menu={folderMenu(folder)}
        />,
      );
      if (open) rows.push(...renderFolder(folder.id, depth + 1));
    }
    for (const note of sorted.filter((item) => item.folderId === parentId))
      rows.push(renderNote(note, depth));
    return rows;
  }

  function pointer(event: DragMoveEvent | DragEndEvent) {
    const start = event.activatorEvent as Partial<PointerEvent>;
    return {
      x: (start.clientX ?? Number.NaN) + event.delta.x,
      y: (start.clientY ?? Number.NaN) + event.delta.y,
    };
  }

  function noteOf(event: DragMoveEvent | DragEndEvent): Note | null {
    const id = (event.active.data.current as { noteId?: string } | undefined)?.noteId;
    return notes.find((note) => note.id === id) ?? null;
  }

  function onDragEnd(event: DragEndEvent) {
    setDragging(null);
    const note = noteOf(event);
    if (!note) return;
    const { x, y } = pointer(event);
    if (reportAssetDrag([], x, y, 'drop', [{ kind: 'note', id: note.id }])) return;
    const over = event.over ? String(event.over.id) : null;
    if (!over) return;
    const folderId = over === ROOT ? null : over.replace(/^folder:/, '');
    if (folderId !== note.folderId) void updateNote(note.id, { folderId });
  }

  function onFileDrop(event: DragEvent<HTMLDivElement>) {
    const files = Array.from(event.dataTransfer.files).filter((file) => /\.(md|markdown)$/i.test(file.name));
    if (files.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    void Promise.all(files.map(async (file) => ({ path: file.name, body: await file.text() })))
      .then((inputs) => importNoteFiles(inputs, null))
      .then((ids) => {
        if (ids.length > 0)
          toast.show({ title: t('explorer.imported', { count: ids.length }), variant: 'success' });
      });
  }

  if (!loaded) {
    return (
      <div className={styles['loading']}>
        <Spinner />
      </div>
    );
  }

  const starred = sorted.filter((note) => note.starred);

  return (
    <div
      className={styles['explorer']}
      aria-label={t('explorer.label')}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) event.preventDefault();
      }}
      onDrop={onFileDrop}
    >
      <div className={styles['toolbar']}>
        <IconButton label={t('explorer.newNote')} size="sm" onClick={() => void createIn(null)}>
          <FilePlus aria-hidden="true" />
        </IconButton>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <IconButton label={t('explorer.newFromTemplate')} size="sm">
              <ChevronDown aria-hidden="true" />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="start">
            {templates.map((option) => (
              <DropdownMenu.Item key={option.key} onSelect={() => void createIn(null, option.choice)}>
                {option.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <IconButton
          label={t('explorer.newFolder')}
          size="sm"
          onClick={() => {
            setPrompt({ kind: 'folder', parentId: null });
          }}
        >
          <FolderPlus aria-hidden="true" />
        </IconButton>
        <IconButton
          label={t('explorer.daily')}
          size="sm"
          onClick={() =>
            void openDailyNote(t, notes, allFolders).then((note) => {
              nav.openNote(note.id);
            })
          }
        >
          <CalendarDays aria-hidden="true" />
        </IconButton>
        <span className={styles['spacer']} />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <IconButton label={t('explorer.import')} size="sm">
              <Upload aria-hidden="true" />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item onSelect={() => void importFrom('files', null)}>
              {t('explorer.importFiles')}
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => void importFrom('folder', null)}>
              {t('explorer.importFolder')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <IconButton label={t('explorer.export')} size="sm" disabled={notes.length === 0}>
              <Download aria-hidden="true" />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item onSelect={() => void exportIds(notes.map((note) => note.id))}>
              {t('explorer.exportAll')}
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.RadioGroup
              value={sort}
              onValueChange={(value) => {
                setState({ sort: value });
              }}
            >
              <DropdownMenu.RadioItem value="name">{t('explorer.sortName')}</DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="updated">{t('explorer.sortUpdated')}</DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
      <div className={styles['search']}>
        <Input
          size="sm"
          type="search"
          value={search}
          placeholder={t('explorer.search')}
          aria-label={t('explorer.search')}
          title={t('explorer.searchHint')}
          onChange={(event) => {
            setState({ search: event.target.value });
          }}
        />
      </div>
      <ScrollArea className={styles['scroll']}>
        {hits ? (
          <div role="list" aria-label={t('explorer.results', { count: hits.length })}>
            <div className={styles['section']}>{t('explorer.results', { count: hits.length })}</div>
            {hits.length === 0 ? <p className={styles['muted']}>{t('explorer.noResults')}</p> : null}
            {hits.map((hit) => (
              <button
                key={hit.note.id}
                type="button"
                role="listitem"
                className={cx(styles['hit'], hit.note.id === activeId && styles['active'])}
                onClick={() => {
                  nav.openNote(hit.note.id);
                }}
              >
                <span className={styles['hitTitle']}>{hit.note.title}</span>
                {hit.lines.slice(0, 2).map((line, position) => (
                  <span key={`${String(position)}-${line}`} className={styles['hitLine']}>
                    {line}
                  </span>
                ))}
              </button>
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={(event) => {
              setDragging(notes.find((note) => `note:${note.id}` === String(event.active.id)) ?? null);
            }}
            onDragMove={(event) => {
              const note = noteOf(event);
              if (!note) return;
              const { x, y } = pointer(event);
              reportAssetDrag([], x, y, 'move', [{ kind: 'note', id: note.id }]);
            }}
            onDragEnd={onDragEnd}
            onDragCancel={() => {
              setDragging(null);
              reportAssetDrag([], Number.NaN, Number.NaN, 'cancel');
            }}
          >
            {starred.length > 0 ? (
              <>
                <div className={styles['section']}>{t('explorer.bookmarks')}</div>
                {starred.map((note) => renderNote(note, 0, true))}
              </>
            ) : null}
            {notes.length === 0 && folders.length === 0 ? (
              <EmptyState
                icon={<NotebookText />}
                title={t('explorer.empty')}
                description={t('explorer.emptyHint')}
              />
            ) : (
              <>
                <FolderRow
                  folder={null}
                  depth={0}
                  open
                  count={notes.length}
                  onToggle={() => undefined}
                  menu={folderMenu(null)}
                />
                {renderFolder(null, 0)}
              </>
            )}
            <DragOverlay dropAnimation={null}>
              {dragging ? (
                <div className={styles['overlay']}>
                  <NotebookText aria-hidden="true" />
                  {dragging.title}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
        {tags.length > 0 && !hits ? (
          <>
            <div className={styles['section']}>{t('explorer.tags')}</div>
            <div className={styles['tags']}>
              {tags.map((tag) => (
                <button
                  key={tag.name}
                  type="button"
                  className={styles['tag']}
                  onClick={() => {
                    setState({ search: `tag:#${tag.name}` });
                  }}
                >
                  <Hash aria-hidden="true" />
                  {tag.name}
                  <span className={styles['count']}>{tag.noteIds.length}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </ScrollArea>
      {prompt ? (
        <PromptDialog
          open
          onOpenChange={(open) => {
            if (!open) setPrompt(null);
          }}
          title={prompt.kind === 'folder' ? t('explorer.newFolder') : t('explorer.rename')}
          label={t('explorer.folderName')}
          initialValue={prompt.kind === 'renameFolder' ? prompt.folder.name : ''}
          submitLabel={prompt.kind === 'folder' ? t('explorer.newFolder') : t('explorer.rename')}
          onSubmit={async (name) => {
            if (prompt.kind === 'folder') {
              await folderActions.create({ name, parentId: prompt.parentId, scope: 'notes' });
            } else {
              await folderActions.update(prompt.folder.id, { name });
            }
          }}
        />
      ) : null}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={
          confirm?.kind === 'folder'
            ? t('explorer.deleteFolderTitle', { name: confirm.folder.name })
            : t('explorer.deleteTitle', { count: confirm?.kind === 'notes' ? confirm.ids.length : 0 })
        }
        description={confirm?.kind === 'folder' ? t('explorer.deleteFolderHint') : t('explorer.deleteHint')}
        confirmLabel={t('explorer.delete')}
        cancelLabel={t('cancel')}
        closeLabel={t('close')}
        destructive
        onConfirm={async () => {
          if (confirm?.kind === 'notes') await deleteNotes(confirm.ids);
          if (confirm?.kind === 'folder') {
            await folderActions.remove(confirm.folder.id);
            await loadNotes();
          }
        }}
      />
    </div>
  );
}
