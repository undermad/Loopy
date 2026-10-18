import type { EditorProps } from '@renderer/lib/editors';
import { NoteEditor } from './NoteEditor';

export function SplitNoteEditor(props: EditorProps) {
  return <NoteEditor {...props} variant="split" />;
}
