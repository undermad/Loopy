import type { EditorProps } from '@renderer/lib/editors';
import { useCardTemplates, useSavedCards } from '@renderer/lib/cards';
import { BoardCardDesigner } from './BoardCardDesigner';
import { Designer } from './designer/Designer';
import { cardDraft, templateDraft, type Target } from './designer/draft';

function readTarget(state: Record<string, unknown>): Target | null {
  const raw = state['target'];
  if (typeof raw !== 'object' || raw === null) return null;
  const { kind, id } = raw as Record<string, unknown>;
  return (kind === 'template' || kind === 'card') && typeof id === 'string' && id ? { kind, id } : null;
}

function readItem(state: Record<string, unknown>): { id: string; boardId: string } | null {
  const raw = state['target'];
  if (typeof raw !== 'object' || raw === null) return null;
  const { kind, id, boardId } = raw as Record<string, unknown>;
  return kind === 'item' && typeof id === 'string' && typeof boardId === 'string' ? { id, boardId } : null;
}

export function CardDesigner({ state, setState }: EditorProps) {
  const item = readItem(state);
  if (item) {
    return (
      <BoardCardDesigner
        boardId={item.boardId}
        nodeId={item.id}
        onOpenTemplate={(templateId) => {
          setState({ target: templateId ? { kind: 'template', id: templateId } : null });
        }}
        onSavedCard={(cardId) => {
          setState({ target: { kind: 'card', id: cardId } });
        }}
      />
    );
  }
  return <TemplateOrCardDesigner state={state} setState={setState} />;
}

function TemplateOrCardDesigner({ state, setState }: Pick<EditorProps, 'state' | 'setState'>) {
  const templates = useCardTemplates();
  const cards = useSavedCards();
  const target = readTarget(state);
  const stored =
    target?.kind === 'template'
      ? (templates?.find((item) => item.id === target.id) ?? null)
      : target?.kind === 'card'
        ? (cards?.find((item) => item.id === target.id) ?? null)
        : null;
  const initial = stored ? ('fields' in stored ? templateDraft(stored) : cardDraft(stored)) : null;
  const loaded = templates !== null && cards !== null;
  const key = [target?.kind ?? 'new', target?.id ?? '', loaded, stored !== null].join(':');
  return (
    <Designer
      key={key}
      target={target}
      stored={stored}
      initial={initial}
      setTarget={(next) => {
        setState({ target: next });
      }}
    />
  );
}
