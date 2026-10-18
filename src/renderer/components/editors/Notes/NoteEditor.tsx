import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { Annotation, Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView, drawSelection, keymap, placeholder } from '@codemirror/view';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Code,
  FileText,
  MoreHorizontal,
  PencilLine,
  Star,
} from 'lucide-react';
import { formatLink, parseNote, wordCount, type LinkParts } from '@shared/markdown';
import { noteTitleSchema } from '@shared/notes';
import type { EditorProps } from '@renderer/lib/editors';
import { assetDropZoneProps, importFiles, useAssetDropZone, useAssetsSnapshot } from '@renderer/lib/assets';
import { useBoards } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import {
  deleteNotes,
  editNoteBody,
  exportNotes,
  findNote,
  importNoteFiles,
  resolveNote,
  setActiveNote,
  updateNote,
  useNote,
  useNoteIndex,
  useNotes,
} from '@renderer/lib/notes';
import { usePalettes } from '@renderer/lib/palettes';
import { ticketActions } from '@renderer/lib/tickets';
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  EmptyState,
  IconButton,
  ToggleGroup,
  cx,
  useToast,
} from '@renderer/ui';
import { noteCompletion, type CompletionData } from './codemirror/complete';
import {
  livePreview,
  refreshPreview,
  type PreviewHost,
  type ResolvedPreview,
} from './codemirror/livePreview';
import { noteTheme } from './codemirror/theme';
import { ExtractDialog, MergeDialog } from './ComposerDialogs';
import { HoverPreview } from './HoverPreview';
import { NoteMarkdown, headingAnchor } from './NoteMarkdown';
import { createFromTemplate, templateBody, templateOptions } from './noteTemplates';
import { useLoopyItems } from './useLoopyItems';
import { useNoteNavigation } from './useNoteNavigation';
import styles from './NoteEditor.module.scss';

type Mode = 'live' | 'source' | 'reading';

const remote = Annotation.define<boolean>();

function readMode(state: Record<string, unknown>): Mode {
  const value = state['mode'];
  return value === 'source' || value === 'reading' ? value : 'live';
}

function readString(state: Record<string, unknown>, key: string): string | null {
  const value = state[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function minimalChange(current: string, next: string) {
  let start = 0;
  while (start < current.length && start < next.length && current[start] === next[start]) start += 1;
  let endCurrent = current.length;
  let endNext = next.length;
  while (endCurrent > start && endNext > start && current[endCurrent - 1] === next[endNext - 1]) {
    endCurrent -= 1;
    endNext -= 1;
  }
  return { from: start, to: endCurrent, insert: next.slice(start, endNext) };
}

function linkFor(kind: 'board' | 'palette' | 'note' | 'asset', name: string, embed = false): string {
  return formatLink({ kind, target: name, subpath: null, alias: null }, embed);
}

export function NoteEditor({ state, setState }: EditorProps) {
  const { t } = useTranslation('notes');
  const toast = useToast();
  const noteId = readString(state, 'noteId');
  const anchor = readString(state, 'anchor');
  const mode = readMode(state);
  const note = useNote(noteId);
  const notes = useNotes();
  const index = useNoteIndex();
  const loopy = useLoopyItems();
  const { assets, folders } = useAssetsSnapshot();
  const boards = useBoards() ?? [];
  const palettes = usePalettes() ?? [];
  const [back, setBack] = useState<string[]>([]);
  const [forward, setForward] = useState<string[]>([]);
  const [draft, setDraft] = useState<{ noteId: string; value: string } | null>(null);
  const title = draft && draft.noteId === note?.id ? draft.value : (note?.title ?? '');
  const setTitle = (value: string) => {
    if (note) setDraft({ noteId: note.id, value });
  };
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [composer, setComposer] = useState<
    { kind: 'extract'; from: number; to: number; text: string } | { kind: 'merge' } | null
  >(null);
  const [hover, setHover] = useState<{ link: LinkParts; rect: DOMRect } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const current = useRef<string | null>(noteId);
  const modeCompartment = useRef(new Compartment());
  const extensionList = useRef<Extension[]>([]);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useCallback(
    (target: string, nextAnchor: string | null) => {
      if (noteId && target !== noteId) {
        setBack((items) => [...items.slice(-49), noteId]);
        setForward([]);
      }
      setState({ noteId: target, anchor: nextAnchor });
    },
    [noteId, setState],
  );
  const nav = useNoteNavigation(navigate);

  const nextHost: PreviewHost = {
    live: () => mode === 'live',
    resolve: (link): ResolvedPreview => {
      if (link.kind === 'note') {
        const target = link.target === '' ? note : resolveNote(index, link.target);
        const label =
          link.alias ??
          (link.subpath ? `${link.target}${link.target ? ' › ' : ''}${link.subpath}` : link.target);
        return { exists: target !== null, label, imageUrl: null, colours: [] };
      }
      const item = loopy.find(link.kind, link.target);
      return {
        exists: item !== null,
        label: link.alias ?? (item?.kind === 'ticket' ? item.detail : (item?.name ?? link.target)),
        imageUrl: loopy.imageUrl(item),
        colours: item?.colours ?? [],
      };
    },
    open: (link) => {
      setHover(null);
      void nav.openLink(link, current.current);
    },
    hover: (link, rect) => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (!link || !rect) {
        hoverTimer.current = setTimeout(() => {
          setHover(null);
        }, 250);
        return;
      }
      hoverTimer.current = setTimeout(() => {
        setHover({ link, rect });
      }, 450);
    },
    tag: (tag) => {
      nav.openTag(tag);
    },
  };

  const nextCompletion: CompletionData = {
    notes: notes.map((item) => {
      const parsed = index.parsed.get(item.id);
      return {
        title: item.title,
        aliases: parsed?.aliases ?? [],
        headings: parsed?.headings.map((heading) => heading.text) ?? [],
        blocks: parsed?.blocks ?? [],
      };
    }),
    items: {
      board: loopy.items.board.map((item) => ({ name: item.name, detail: '' })),
      palette: loopy.items.palette.map((item) => ({ name: item.name, detail: '' })),
      asset: loopy.items.asset.map((item) => ({ name: item.name, detail: item.detail })),
      ticket: loopy.items.ticket.map((item) => ({ name: item.name, detail: item.detail })),
    },
    tags: [...index.tags.values()].map((tag) => tag.name),
    kindLabel: (kind) => t(`kinds.${kind}`),
    aliasLabel: t('editor.alias'),
  };

  const previewHost = useRef(nextHost);
  const completion = useRef(nextCompletion);
  useEffect(() => {
    previewHost.current = nextHost;
    completion.current = nextCompletion;
  });

  const insertAt = useCallback((text: string, pos?: number) => {
    const editor = view.current;
    if (!editor) return;
    const at = pos ?? editor.state.selection.main.head;
    editor.dispatch({ changes: { from: at, insert: text }, selection: { anchor: at + text.length } });
    editor.focus();
  }, []);

  const importAndInsert = useCallback(
    async (files: File[], pos?: number) => {
      const markdownFiles = files.filter((file) => /\.(md|markdown)$/i.test(file.name));
      const others = files.filter((file) => !markdownFiles.includes(file));
      const texts: string[] = [];
      if (markdownFiles.length > 0) {
        const imported = await importNoteFiles(
          await Promise.all(
            markdownFiles.map(async (file) => ({ path: file.name, body: await file.text() })),
          ),
          findNote(current.current)?.folderId ?? null,
        );
        for (const id of imported) {
          const created = findNote(id);
          if (created) texts.push(linkFor('note', created.title));
        }
      }
      if (others.length > 0) {
        const outcome = await importFiles(others, 'auto');
        for (const file of others.slice(0, outcome.ids.length)) {
          texts.push(linkFor('asset', file.name, /^(image|audio|video)\//.test(file.type)));
        }
      }
      if (texts.length > 0) insertAt(texts.join(' '), pos);
    },
    [insertAt],
  );

  useEffect(() => {
    if (!host.current) return undefined;
    const extensions: Extension[] = [
      history(),
      drawSelection(),
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage }),
      noteTheme,
      highlightSelectionMatches(),
      noteCompletion(() => completion.current),
      livePreview(() => previewHost.current),
      modeCompartment.current.of(EditorView.editorAttributes.of({ 'data-mode': 'live' })),
      placeholder(t('editor.placeholder')),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      EditorView.contentAttributes.of({ 'aria-label': t('editor.label'), spellcheck: 'true' }),
      EditorView.updateListener.of((update) => {
        if (update.focusChanged && update.view.hasFocus && current.current) setActiveNote(current.current);
        if (!update.docChanged || !current.current) return;
        if (update.transactions.some((transaction) => transaction.annotation(remote))) return;
        editNoteBody(current.current, update.state.doc.toString());
      }),
      EditorView.domEventHandlers({
        drop: (event, editor) => {
          const files = Array.from(event.dataTransfer?.files ?? []);
          if (files.length === 0) return false;
          event.preventDefault();
          const pos = editor.posAtCoords({ x: event.clientX, y: event.clientY }) ?? undefined;
          void importAndInsert(files, pos);
          return true;
        },
        paste: (event) => {
          const files = Array.from(event.clipboardData?.files ?? []);
          if (files.length === 0) return false;
          event.preventDefault();
          void importAndInsert(files);
          return true;
        },
      }),
    ];
    extensionList.current = extensions;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({ doc: findNote(current.current)?.body ?? '', extensions }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
  }, [importAndInsert, t]);

  useEffect(() => {
    current.current = noteId;
    const editor = view.current;
    const body = findNote(noteId)?.body ?? '';
    if (editor) editor.setState(EditorState.create({ doc: body, extensions: extensionList.current }));
    if (noteId) setActiveNote(noteId);
  }, [noteId]);

  useEffect(() => {
    const editor = view.current;
    if (!editor || !note) return;
    const doc = editor.state.doc.toString();
    if (doc === note.body) return;
    editor.dispatch({ changes: minimalChange(doc, note.body), annotations: remote.of(true) });
  }, [note]);

  useEffect(() => {
    view.current?.dispatch({
      effects: modeCompartment.current.reconfigure(EditorView.editorAttributes.of({ 'data-mode': mode })),
    });
  }, [mode]);

  useEffect(() => {
    view.current?.dispatch({ effects: refreshPreview.of(null) });
  }, [index, loopy]);

  useEffect(() => {
    if (!anchor || !note) return;
    if (mode === 'reading') {
      const element = root.current?.querySelector(`#${CSS.escape(headingAnchor(anchor))}`);
      element?.scrollIntoView({ block: 'start' });
      return;
    }
    const editor = view.current;
    if (!editor) return;
    const lines = editor.state.doc.toString().split('\n');
    const block = anchor.startsWith('^') ? anchor.slice(1) : null;
    const wanted = anchor.toLowerCase();
    const line = lines.findIndex((text) =>
      block
        ? text.trimEnd().endsWith(`^${block}`)
        : /^#{1,6}\s/.test(text) &&
          text
            .replace(/^#{1,6}\s+/, '')
            .trim()
            .toLowerCase() === wanted,
    );
    if (line < 0) return;
    const pos = editor.state.doc.line(line + 1).from;
    editor.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
  }, [anchor, mode, note]);

  useAssetDropZone(root, (detail) => {
    if (detail.phase !== 'drop' || !note) return;
    const editor = view.current;
    const pos = editor?.posAtCoords({ x: detail.x, y: detail.y }) ?? undefined;
    const texts: string[] = [];
    for (const id of detail.ids) {
      const asset = assets.find((item) => item.id === id);
      if (asset) texts.push(linkFor('asset', asset.name, ['image', 'audio', 'video'].includes(asset.kind)));
    }
    for (const link of detail.links) {
      if (link.kind === 'note') {
        const target = findNote(link.id);
        if (target && target.id !== note.id) texts.push(linkFor('note', target.title));
      } else if (link.kind === 'board') {
        const board = boards.find((item) => item.id === link.id);
        if (board) texts.push(linkFor('board', board.name));
      } else {
        const palette = palettes.find((item) => item.id === link.id);
        if (palette) texts.push(linkFor('palette', palette.name, true));
      }
    }
    if (texts.length > 0) insertAt(texts.join(' '), pos);
  });

  async function commitTitle() {
    if (!note) return;
    const next = title.trim();
    setDraft(null);
    if (next === note.title) return;
    const parsed = noteTitleSchema.safeParse(next);
    if (!parsed.success) {
      toast.show({ title: t('editor.invalidTitle'), variant: 'danger' });
      return;
    }
    try {
      const changed = await updateNote(note.id, { title: parsed.data });
      if (changed.length > 1) {
        toast.show({ title: t('editor.linksUpdated', { count: changed.length - 1 }), variant: 'success' });
      }
    } catch {
      toast.show({ title: t('editor.titleTaken', { name: next }), variant: 'danger' });
    }
  }

  async function createTicket() {
    if (!note) return;
    const editor = view.current;
    const selection = editor
      ? editor.state.sliceDoc(editor.state.selection.main.from, editor.state.selection.main.to).trim()
      : '';
    const line = editor ? editor.state.doc.lineAt(editor.state.selection.main.head).text : '';
    const task = /^\s*[-*+]\s+\[[ xX]\]\s+(.*)$/.exec(line)?.[1];
    const ticketTitle = (selection.length > 0 ? selection : (task ?? note.title))
      .replace(/\s+/g, ' ')
      .slice(0, 200);
    const snapshot = await ticketActions.create({
      title: ticketTitle,
      description: linkFor('note', note.title),
    });
    const created = snapshot.tickets.reduce<{ number: number; id: string } | null>(
      (latest, ticket) => (latest === null || ticket.number > latest.number ? ticket : latest),
      null,
    );
    if (!created) return;
    await ticketActions.update(created.id, { links: [{ kind: 'note', id: note.id }] });
    if (editor) {
      const end = editor.state.selection.main.to;
      const at = selection ? end : editor.state.doc.lineAt(end).to;
      insertAt(
        ` ${formatLink({ kind: 'ticket', target: String(created.number), subpath: null, alias: null })}`,
        at,
      );
    }
    toast.show({ title: t('editor.ticketCreated', { number: created.number }), variant: 'success' });
  }

  function toggleTask(line: number) {
    if (!note) return;
    const lines = note.body.split('\n');
    const text = lines[line];
    if (text === undefined) return;
    lines[line] = text.replace(/\[( |x|X)\]/, (box) => (box === '[ ]' ? '[x]' : '[ ]'));
    editNoteBody(note.id, lines.join('\n'));
  }

  const parsed = useMemo(() => (note ? parseNote(note.body) : null), [note]);
  const backlinkCount = note ? (index.backlinks.get(note.id)?.length ?? 0) : 0;
  const templates = templateOptions(t, notes, folders);

  const empty = (
    <EmptyState
      icon={<FileText />}
      title={noteId ? t('editor.missing') : t('editor.none')}
      description={t('editor.noneHint')}
      action={
        <Button
          size="sm"
          icon={<PencilLine aria-hidden="true" />}
          onClick={() => {
            void createFromTemplate(t, { kind: 'builtIn', id: 'blank' }, null).then((created) => {
              navigate(created.id, null);
            });
          }}
        >
          {t('explorer.newNote')}
        </Button>
      }
    />
  );

  return (
    <div ref={root} className={styles['editor']} {...assetDropZoneProps}>
      {note ? (
        <header className={styles['header']}>
          <IconButton
            label={t('editor.back')}
            size="sm"
            disabled={back.length === 0}
            onClick={() => {
              const previous = back.at(-1);
              if (!previous) return;
              setBack((items) => items.slice(0, -1));
              setForward((items) => [noteId ?? '', ...items]);
              setState({ noteId: previous, anchor: null });
            }}
          >
            <ArrowLeft aria-hidden="true" />
          </IconButton>
          <IconButton
            label={t('editor.forward')}
            size="sm"
            disabled={forward.length === 0}
            onClick={() => {
              const next = forward[0];
              if (!next) return;
              setForward((items) => items.slice(1));
              setBack((items) => [...items, noteId ?? '']);
              setState({ noteId: next, anchor: null });
            }}
          >
            <ArrowRight aria-hidden="true" />
          </IconButton>
          <input
            className={styles['title']}
            value={title}
            aria-label={t('editor.title')}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            onBlur={() => void commitTitle()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                view.current?.focus();
              }
              if (event.key === 'Escape') {
                setDraft(null);
                view.current?.focus();
              }
            }}
          />
          <ToggleGroup
            aria-label={t('editor.mode')}
            size="sm"
            iconsOnly
            value={mode}
            onValueChange={(value) => {
              if (value) setState({ mode: value });
            }}
            items={[
              { value: 'live', label: t('editor.live'), icon: <PencilLine aria-hidden="true" /> },
              { value: 'source', label: t('editor.source'), icon: <Code aria-hidden="true" /> },
              { value: 'reading', label: t('editor.reading'), icon: <BookOpen aria-hidden="true" /> },
            ]}
          />
          <IconButton
            label={note.starred ? t('editor.unstar') : t('editor.star')}
            size="sm"
            active={note.starred}
            onClick={() => void updateNote(note.id, { starred: !note.starred })}
          >
            <Star aria-hidden="true" className={cx(note.starred && styles['starred'])} />
          </IconButton>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <IconButton label={t('editor.more')} size="sm">
                <MoreHorizontal aria-hidden="true" />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item onSelect={() => void exportNotes({ ids: [note.id], loopyLinks: 'keep' })}>
                {t('editor.exportMarkdown')}
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => void exportNotes({ ids: [note.id], loopyLinks: 'plain' })}>
                {t('editor.exportPlain')}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => {
                  void navigator.clipboard.writeText(linkFor('note', note.title));
                  toast.show({ title: t('editor.linkCopied'), variant: 'success' });
                }}
              >
                {t('editor.copyLink')}
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => void createTicket()}>
                {t('editor.createTicket')}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => {
                  const editor = view.current;
                  const range = editor?.state.selection.main;
                  const text = editor && range ? editor.state.sliceDoc(range.from, range.to) : '';
                  if (!range || text.trim().length === 0) {
                    toast.show({ title: t('composer.selectFirst'), variant: 'info' });
                    return;
                  }
                  setComposer({ kind: 'extract', from: range.from, to: range.to, text });
                }}
              >
                {t('composer.extractTitle')}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => {
                  setComposer({ kind: 'merge' });
                }}
              >
                {t('composer.mergeMenu')}
              </DropdownMenu.Item>
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger>{t('editor.insertTemplate')}</DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent>
                  {templates
                    .filter((option) => option.key !== 'builtIn:blank')
                    .map((option) => (
                      <DropdownMenu.Item
                        key={option.key}
                        onSelect={() => {
                          insertAt(templateBody(t, option.choice, note.title));
                        }}
                      >
                        {option.label}
                      </DropdownMenu.Item>
                    ))}
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                onSelect={() => {
                  setConfirmDelete(true);
                }}
              >
                {t('editor.delete')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </header>
      ) : null}
      {parsed && parsed.tags.length > 0 ? (
        <div className={styles['tags']} aria-label={t('editor.tags')}>
          {parsed.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={styles['tag']}
              onClick={() => {
                nav.openTag(tag);
              }}
            >
              #{tag}
            </button>
          ))}
        </div>
      ) : null}
      <div className={styles['body']}>
        <div ref={host} className={cx(styles['source'], (!note || mode === 'reading') && styles['hidden'])} />
        {note ? null : empty}
        {note && mode === 'reading' ? (
          <div className={styles['reading']}>
            <NoteMarkdown
              body={note.body}
              noteId={note.id}
              onLink={(link) => void nav.openLink(link, note.id)}
              onTag={nav.openTag}
              onToggleTask={toggleTask}
            />
          </div>
        ) : null}
      </div>
      {note ? (
        <footer className={styles['footer']}>
          <span>{t('editor.words', { count: wordCount(note.body) })}</span>
          <span>{t('editor.characters', { count: note.body.length })}</span>
          <span>{t('editor.backlinks', { count: backlinkCount })}</span>
        </footer>
      ) : null}
      {note && hover ? (
        <HoverPreview
          link={hover.link}
          rect={hover.rect}
          sourceId={note.id}
          onEnter={() => {
            if (hoverTimer.current) clearTimeout(hoverTimer.current);
          }}
          onLeave={() => {
            setHover(null);
          }}
          onLink={(link) => {
            setHover(null);
            void nav.openLink(link, note.id);
          }}
        />
      ) : null}
      {note && composer?.kind === 'extract' ? (
        <ExtractDialog
          note={note}
          text={composer.text}
          onClose={() => {
            setComposer(null);
          }}
          onExtracted={(created) => {
            const editor = view.current;
            const link = linkFor('note', created.title);
            if (editor) {
              const end = Math.min(composer.to, editor.state.doc.length);
              editor.dispatch({
                changes: { from: Math.min(composer.from, end), to: end, insert: link },
                selection: { anchor: Math.min(composer.from, end) + link.length },
              });
            }
            setComposer(null);
            toast.show({ title: t('composer.extracted', { name: created.title }), variant: 'success' });
          }}
        />
      ) : null}
      {note && composer?.kind === 'merge' ? (
        <MergeDialog
          note={note}
          onClose={() => {
            setComposer(null);
          }}
          onMerged={(targetId) => {
            setComposer(null);
            setState({ noteId: targetId, anchor: null });
            toast.show({ title: t('composer.merged'), variant: 'success' });
          }}
        />
      ) : null}
      {note ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t('editor.deleteTitle', { name: note.title })}
          description={t('editor.deleteHint')}
          confirmLabel={t('editor.delete')}
          cancelLabel={t('cancel')}
          closeLabel={t('close')}
          destructive
          onConfirm={async () => {
            await deleteNotes([note.id]);
            setState({ noteId: null });
          }}
        />
      ) : null}
    </div>
  );
}
