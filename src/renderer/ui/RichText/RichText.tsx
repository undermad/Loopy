import { useEffect, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { generateHTML, generateJSON } from '@tiptap/html';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Undo2,
} from 'lucide-react';
import { Button } from '../Button';
import { IconButton } from '../IconButton';
import { Input } from '../Input';
import { Popover } from '../Popover';
import { cx } from '../cx';
import { extensions } from './extensions';
import styles from './RichText.module.scss';

export interface RichTextLabels {
  editor: string;
  bold: string;
  italic: string;
  strike: string;
  code: string;
  heading1: string;
  heading2: string;
  bulletList: string;
  orderedList: string;
  taskList: string;
  blockquote: string;
  codeBlock: string;
  horizontalRule: string;
  link: string;
  linkUrl: string;
  linkApply: string;
  linkRemove: string;
  undo: string;
  redo: string;
}

export interface RichTextProps {
  value: string;
  labels: RichTextLabels;
  onChange?: (html: string) => void;
  onBlur?: (html: string) => void;
  onSubmit?: (html: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
  className?: string | undefined;
}

export function isEmptyRichText(html: string): boolean {
  return html.replace(/<p>(\s|<br\s*\/?>)*<\/p>/g, '').trim() === '';
}

export function toRichText(text: string): string {
  if (text.trim() === '') return '';
  if (text.trimStart().startsWith('<')) return text;
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function sanitizeRichText(html: string): string {
  return generateHTML(generateJSON(html, extensions()), extensions());
}

function LinkControl({ editor, labels }: { editor: Editor; labels: RichTextLabels }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const active = useEditorState({ editor, selector: (ctx) => ctx.editor.isActive('link') });

  function apply() {
    const href = url.trim();
    if (href) editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    setOpen(false);
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setUrl((editor.getAttributes('link')['href'] as string | undefined) ?? '');
      }}
    >
      <Popover.Trigger asChild>
        <IconButton label={labels.link} size="sm" active={active} tooltip={false}>
          <Link2 aria-hidden="true" />
        </IconButton>
      </Popover.Trigger>
      <Popover.Content align="start">
        <form
          className={styles['linkForm']}
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <Input
            size="sm"
            type="url"
            value={url}
            aria-label={labels.linkUrl}
            placeholder="https://"
            onChange={(event) => {
              setUrl(event.target.value);
            }}
          />
          <Button type="submit" size="sm" variant="primary">
            {labels.linkApply}
          </Button>
          {active ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                editor.chain().focus().unsetLink().run();
                setOpen(false);
              }}
            >
              {labels.linkRemove}
            </Button>
          ) : null}
        </form>
      </Popover.Content>
    </Popover.Root>
  );
}

function Toolbar({ editor, labels }: { editor: Editor; labels: RichTextLabels }) {
  const state = useEditorState({
    editor,
    selector: (ctx) => ({
      bold: ctx.editor.isActive('bold'),
      italic: ctx.editor.isActive('italic'),
      strike: ctx.editor.isActive('strike'),
      code: ctx.editor.isActive('code'),
      heading1: ctx.editor.isActive('heading', { level: 1 }),
      heading2: ctx.editor.isActive('heading', { level: 2 }),
      bulletList: ctx.editor.isActive('bulletList'),
      orderedList: ctx.editor.isActive('orderedList'),
      taskList: ctx.editor.isActive('taskList'),
      blockquote: ctx.editor.isActive('blockquote'),
      codeBlock: ctx.editor.isActive('codeBlock'),
      canUndo: ctx.editor.can().undo(),
      canRedo: ctx.editor.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const button = (key: keyof typeof state & keyof RichTextLabels, icon: React.ReactNode, run: () => void) => (
    <IconButton label={labels[key]} size="sm" active={state[key]} tooltip={false} onClick={run}>
      {icon}
    </IconButton>
  );

  return (
    <div className={styles['toolbar']} role="toolbar" aria-label={labels.editor}>
      {button('bold', <Bold aria-hidden="true" />, () => chain().toggleBold().run())}
      {button('italic', <Italic aria-hidden="true" />, () => chain().toggleItalic().run())}
      {button('strike', <Strikethrough aria-hidden="true" />, () => chain().toggleStrike().run())}
      {button('code', <Code aria-hidden="true" />, () => chain().toggleCode().run())}
      <span className={styles['divider']} />
      {button('heading1', <Heading1 aria-hidden="true" />, () => chain().toggleHeading({ level: 1 }).run())}
      {button('heading2', <Heading2 aria-hidden="true" />, () => chain().toggleHeading({ level: 2 }).run())}
      <span className={styles['divider']} />
      {button('bulletList', <List aria-hidden="true" />, () => chain().toggleBulletList().run())}
      {button('orderedList', <ListOrdered aria-hidden="true" />, () => chain().toggleOrderedList().run())}
      {button('taskList', <ListChecks aria-hidden="true" />, () => chain().toggleTaskList().run())}
      <span className={styles['divider']} />
      {button('blockquote', <Quote aria-hidden="true" />, () => chain().toggleBlockquote().run())}
      {button('codeBlock', <SquareCode aria-hidden="true" />, () => chain().toggleCodeBlock().run())}
      <IconButton
        label={labels.horizontalRule}
        size="sm"
        tooltip={false}
        onClick={() => chain().setHorizontalRule().run()}
      >
        <Minus aria-hidden="true" />
      </IconButton>
      <LinkControl editor={editor} labels={labels} />
      <span className={styles['divider']} />
      <IconButton
        label={labels.undo}
        size="sm"
        tooltip={false}
        disabled={!state.canUndo}
        onClick={() => chain().undo().run()}
      >
        <Undo2 aria-hidden="true" />
      </IconButton>
      <IconButton
        label={labels.redo}
        size="sm"
        tooltip={false}
        disabled={!state.canRedo}
        onClick={() => chain().redo().run()}
      >
        <Redo2 aria-hidden="true" />
      </IconButton>
    </div>
  );
}

export function RichText({
  value,
  labels,
  onChange,
  onBlur,
  onSubmit,
  placeholder = '',
  autoFocus = false,
  compact = false,
  className,
}: RichTextProps) {
  const editor = useEditor({
    extensions: extensions(placeholder),
    content: value,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        'aria-label': labels.editor,
        class: cx(styles['content'], compact && styles['compact']),
      },
      handleKeyDown: (_view, event) => {
        if (onSubmit && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          onSubmit(editor.getHTML());
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange?.(current.getHTML());
    },
    onBlur: ({ editor: current }) => {
      onBlur?.(current.getHTML());
    },
  });

  useEffect(() => {
    if (!editor.isFocused && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <div className={cx(styles['editor'], className)}>
      <Toolbar editor={editor} labels={labels} />
      <EditorContent editor={editor} />
    </div>
  );
}

export function RichContent({ html, className }: { html: string; className?: string | undefined }) {
  return (
    <div
      className={cx(styles['content'], styles['readOnly'], className)}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(toRichText(html)) }}
    />
  );
}
